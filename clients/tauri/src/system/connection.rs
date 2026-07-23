// 与 worker 的唯一连接:用「主域名 + 密码」连 wss://{域名}/api/realtime/ws,断线退避重连。
// 收到的每条消息交给 dispatch 独立任务处理(长命令不挡收);出口统一走一个 writer 任务。
use std::time::{Duration, Instant};

use futures_util::{SinkExt, StreamExt};
use serde_json::Value;
use tokio::sync::mpsc;
use tokio_tungstenite::tungstenite::Message;

use super::config::{self, Config};
use super::dispatch;

// 心跳参数:每 30s 主动 Ping;超过 75s 没收到任何消息判死。
const PING_INTERVAL: Duration = Duration::from_secs(30);
const DEAD_AFTER: Duration = Duration::from_secs(75);

pub async fn run() {
    let mut backoff = Duration::from_secs(3); // 指数退避:3s 起,上限 60s,连上即复位
    loop {
        let cfg = config::load();
        if cfg.worker_url.is_empty() {
            config::log("缺少主域名(设 WORKER_URL 或写 config.json 的 worker_url),5s 后重试");
            tokio::time::sleep(Duration::from_secs(5)).await;
            continue;
        }
        let started = Instant::now();
        let config_changed = match serve(&cfg).await {
            Ok(()) => false,
            Err(e) => {
                config::log(&format!("连接断开: {e}"));
                e == "连接配置已更新"
            }
        };
        crate::set_conn_status(false);
        if config_changed {
            backoff = Duration::from_secs(3);
            continue;
        }
        // 只要这次连接活过了 ping 周期,就视为「曾成功连上」,退避复位
        if started.elapsed() >= PING_INTERVAL {
            backoff = Duration::from_secs(3);
        }
        config::log(&format!("{}s 后重连…", backoff.as_secs()));
        tokio::time::sleep(backoff).await;
        backoff = (backoff * 2).min(Duration::from_secs(60));
    }
}

async fn serve(cfg: &Config) -> Result<(), String> {
    let config_revision = config::revision();
    // https→wss / http→ws / 无 scheme 的裸域名默认走 wss(与安卓端一致,避免明文传密码)
    let ws_base = match cfg.worker_url.strip_prefix("http") {
        Some(rest) => format!("ws{rest}"),
        None => format!("wss://{}", cfg.worker_url),
    };
    // 桌面手:密码 + role=device(密码即凭证)
    let url = format!(
        "{ws_base}/api/realtime/ws?password={}&role=device",
        urlencode(&cfg.password)
    );
    config::log(&format!("连接 {ws_base}/api/realtime/ws (role=device) …"));

    let (ws, _) = tokio_tungstenite::connect_async(&url)
        .await
        .map_err(|e| e.to_string())?;
    config::log("✅ 已连上 worker,听命中");
    crate::set_conn_status(true);
    let (mut write, mut read) = ws.split();
    let (tx, mut rx) = mpsc::unbounded_channel::<Message>();

    // 自报身份:唯一设备名(寻址键,缺省回退主机名)+ 类型 + 能力(shell 工具 + 文件/状态/终端视图)
    let name = if cfg.name.is_empty() {
        sysinfo::System::host_name().unwrap_or_else(|| "desktop".to_string())
    } else {
        cfg.name.clone()
    };
    // 平台分能力宣告:macOS / Windows 全量;其它平台(Linux)只报 shell/files/status。
    #[cfg(any(target_os = "macos", target_os = "windows"))]
    let caps: &[&str] = &[
        "shell",
        "read_file",
        "write_file",
        "edit_file",
        "files",
        "status",
        "terminal",
        "computer_screen",
        "computer_click",
        "computer_type",
        "computer_key",
        "computer_open_app",
    ];
    #[cfg(not(any(target_os = "macos", target_os = "windows")))]
    let caps: &[&str] = &["shell", "read_file", "write_file", "edit_file", "files", "status", "terminal"];
    let _ = tx.send(Message::Text(
        serde_json::json!({
            "type": "hello",
            "protocolVersion": 1,
            "clientVersion": env!("CARGO_PKG_VERSION"),
            "kind": "desktop",
            "name": name,
            "caps": caps
        })
            .to_string(),
    ));

    // 写出任务:统一出口,避免多任务争用 ws sink
    let writer = tokio::spawn(async move {
        while let Some(m) = rx.recv().await {
            if write.send(m).await.is_err() {
                break;
            }
        }
    });

    // 心跳 + 僵尸检测:每 30s 主动 Ping;记录最后一次收到任何消息(含 Pong)的时间,
    // 超过 75s 没消息 → 判死返回 Err,触发外层重连(应对睡眠/切网后 read 永远挂起)。
    let mut last_rx = Instant::now();
    let mut tick = tokio::time::interval(PING_INTERVAL);
    let mut config_tick = tokio::time::interval(Duration::from_secs(1));
    tick.set_missed_tick_behavior(tokio::time::MissedTickBehavior::Delay);
    tick.tick().await; // 第一个 tick 立即返回,跳过
    config_tick.tick().await;

    let result: Result<(), String> = loop {
        tokio::select! {
            msg = read.next() => match msg {
                Some(Ok(m)) => {
                    last_rx = Instant::now();
                    match m {
                        Message::Text(txt) => {
                            if let Ok(v) = serde_json::from_str::<Value>(&txt) {
                                let tx2 = tx.clone();
                                tokio::spawn(async move { dispatch::dispatch(v, tx2).await });
                            }
                        }
                        Message::Ping(p) => { let _ = tx.send(Message::Pong(p)); }
                        Message::Close(_) => break Ok(()),
                        _ => {} // Pong / Binary 等:只用于刷新 last_rx
                    }
                }
                Some(Err(e)) => break Err(e.to_string()),
                None => break Ok(()),
            },
            _ = tick.tick() => {
                if last_rx.elapsed() > DEAD_AFTER {
                    break Err(format!("{}s 未收到任何消息,判定连接已死", last_rx.elapsed().as_secs()));
                }
                let _ = tx.send(Message::Ping(Vec::new()));
            }
            _ = config_tick.tick() => {
                if config::revision() != config_revision {
                    break Err("连接配置已更新".to_string());
                }
            }
        }
    };
    drop(tx);
    let _ = writer.await;
    result
}

// 对密码做 URL 查询参数编码。
fn urlencode(s: &str) -> String {
    let mut out = String::with_capacity(s.len());
    for b in s.bytes() {
        match b {
            b'A'..=b'Z' | b'a'..=b'z' | b'0'..=b'9' | b'-' | b'_' | b'.' | b'~' => {
                out.push(b as char)
            }
            _ => out.push_str(&format!("%{b:02X}")),
        }
    }
    out
}
