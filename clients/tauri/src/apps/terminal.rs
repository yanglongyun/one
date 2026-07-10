// terminal app:桌面进程内长驻的原生 PTY 会话。
// 线协议:
//   收 terminal.{list,create,input,resize,close,restart}{data:{...}}
//   回 terminal.{list,created,output,closed,error}{data:{...}}
// 输出按原始字节 base64 传输,保留 ANSI 序列和非 UTF-8 数据。
use std::collections::HashMap;
use std::io::{Read, Write};
use std::path::{Path, PathBuf};
use std::sync::atomic::{AtomicU64, Ordering};
use std::sync::{Arc, Mutex, OnceLock};
use std::time::{SystemTime, UNIX_EPOCH};

use base64::Engine as _;
use portable_pty::{native_pty_system, Child, CommandBuilder, MasterPty, PtySize};
use serde_json::{json, Value};

use crate::system::{send_data, Tx};

const DEFAULT_COLS: u16 = 100;
const DEFAULT_ROWS: u16 = 30;
const MAX_SESSIONS: usize = 8;
const MAX_INPUT_BYTES: usize = 64 * 1024;

static MANAGER: OnceLock<Arc<TerminalManager>> = OnceLock::new();
static NEXT_ID: AtomicU64 = AtomicU64::new(1);

fn manager() -> &'static Arc<TerminalManager> {
    MANAGER.get_or_init(|| Arc::new(TerminalManager::default()))
}

#[derive(Default)]
struct TerminalManager {
    sessions: Mutex<HashMap<String, Arc<TerminalSession>>>,
    tx: Mutex<Option<Tx>>,
    create_lock: Mutex<()>,
}

struct TerminalSession {
    id: String,
    title: String,
    cwd: PathBuf,
    cols: Mutex<u16>,
    rows: Mutex<u16>,
    created_at: u64,
    master: Mutex<Box<dyn MasterPty + Send>>,
    writer: Mutex<Box<dyn Write + Send>>,
    child: Mutex<Box<dyn Child + Send + Sync>>,
}

impl TerminalSession {
    fn meta(&self) -> Value {
        json!({
            "id": self.id,
            "title": self.title,
            "cwd": self.cwd.to_string_lossy(),
            "cols": *self.cols.lock().unwrap_or_else(|e| e.into_inner()),
            "rows": *self.rows.lock().unwrap_or_else(|e| e.into_inner()),
            "createdAt": self.created_at,
        })
    }
}

impl TerminalManager {
    fn set_tx(&self, tx: &Tx) {
        *self.tx.lock().unwrap_or_else(|e| e.into_inner()) = Some(tx.clone());
    }

    fn emit(&self, typ: &str, data: Value) {
        let tx = self.tx.lock().unwrap_or_else(|e| e.into_inner()).clone();
        if let Some(tx) = tx {
            send_data(&tx, typ, data);
        }
    }

    fn list(&self) -> Vec<Value> {
        let sessions = self.sessions.lock().unwrap_or_else(|e| e.into_inner());
        let mut list: Vec<_> = sessions.values().map(|s| s.meta()).collect();
        list.sort_by_key(|v| v.get("createdAt").and_then(Value::as_u64).unwrap_or(0));
        list
    }

    fn create(self: &Arc<Self>, data: &Value) -> Result<Value, String> {
        let _guard = self.create_lock.lock().unwrap_or_else(|e| e.into_inner());
        self.create_locked(data)
    }

    // terminal.list 可能因页面生命周期/重连被并发请求。锁内再次检查，确保默认会话只创建一次。
    fn ensure_default(self: &Arc<Self>) -> Result<Option<Value>, String> {
        let _guard = self.create_lock.lock().unwrap_or_else(|e| e.into_inner());
        if !self
            .sessions
            .lock()
            .unwrap_or_else(|e| e.into_inner())
            .is_empty()
        {
            return Ok(None);
        }
        self.create_locked(&json!({})).map(Some)
    }

    // 调用方必须持有 create_lock；同时让会话上限检查和插入保持原子。
    fn create_locked(self: &Arc<Self>, data: &Value) -> Result<Value, String> {
        if self
            .sessions
            .lock()
            .unwrap_or_else(|e| e.into_inner())
            .len()
            >= MAX_SESSIONS
        {
            return Err(format!("最多同时打开 {MAX_SESSIONS} 个终端"));
        }

        let cwd = resolve_cwd(data.get("cwd").and_then(Value::as_str))?;
        let cols = dimension(data.get("cols"), DEFAULT_COLS, 20, 500);
        let rows = dimension(data.get("rows"), DEFAULT_ROWS, 4, 200);
        let id = terminal_id();
        let title = data
            .get("title")
            .and_then(Value::as_str)
            .map(str::trim)
            .filter(|s| !s.is_empty())
            .map(ToOwned::to_owned)
            .unwrap_or_else(|| {
                cwd.file_name()
                    .map(|s| s.to_string_lossy().to_string())
                    .filter(|s| !s.is_empty())
                    .unwrap_or_else(|| "终端".into())
            });

        let pty_system = native_pty_system();
        let pair = pty_system
            .openpty(PtySize {
                rows,
                cols,
                pixel_width: 0,
                pixel_height: 0,
            })
            .map_err(|e| format!("创建 PTY 失败: {e}"))?;

        let mut command = CommandBuilder::new(default_shell());
        command.cwd(&cwd);
        command.env("TERM", "xterm-256color");
        let child = pair
            .slave
            .spawn_command(command)
            .map_err(|e| format!("启动 shell 失败: {e}"))?;
        drop(pair.slave);

        let mut reader = pair
            .master
            .try_clone_reader()
            .map_err(|e| format!("读取 PTY 失败: {e}"))?;
        let writer = pair
            .master
            .take_writer()
            .map_err(|e| format!("写入 PTY 失败: {e}"))?;
        let session = Arc::new(TerminalSession {
            id: id.clone(),
            title,
            cwd,
            cols: Mutex::new(cols),
            rows: Mutex::new(rows),
            created_at: now_ms(),
            master: Mutex::new(pair.master),
            writer: Mutex::new(writer),
            child: Mutex::new(child),
        });
        let meta = session.meta();
        self.sessions
            .lock()
            .unwrap_or_else(|e| e.into_inner())
            .insert(id.clone(), session);

        let weak = Arc::downgrade(self);
        let thread_id = id.clone();
        if let Err(error) = std::thread::Builder::new()
            .name(format!("one-terminal-{id}"))
            .spawn(move || {
                let mut buf = vec![0u8; 16 * 1024];
                loop {
                    match reader.read(&mut buf) {
                        Ok(0) | Err(_) => break,
                        Ok(n) => {
                            let Some(manager) = weak.upgrade() else { break };
                            let encoded =
                                base64::engine::general_purpose::STANDARD.encode(&buf[..n]);
                            manager.emit(
                                "terminal.output",
                                json!({ "terminalId": thread_id, "data": encoded }),
                            );
                        }
                    }
                }
                if let Some(manager) = weak.upgrade() {
                    manager.finish(&thread_id, "shell 已退出");
                }
            })
        {
            if let Some(session) = self
                .sessions
                .lock()
                .unwrap_or_else(|e| e.into_inner())
                .remove(&id)
            {
                let _ = session
                    .child
                    .lock()
                    .unwrap_or_else(|e| e.into_inner())
                    .kill();
            }
            return Err(format!("启动终端读取线程失败: {error}"));
        }

        Ok(meta)
    }

    fn with_session(&self, id: &str) -> Result<Arc<TerminalSession>, String> {
        self.sessions
            .lock()
            .unwrap_or_else(|e| e.into_inner())
            .get(id)
            .cloned()
            .ok_or_else(|| "终端不存在或已关闭".to_string())
    }

    fn input(&self, data: &Value) -> Result<(), String> {
        let id = required_id(data)?;
        let input = data
            .get("input")
            .and_then(Value::as_str)
            .ok_or("缺少 input")?;
        if input.len() > MAX_INPUT_BYTES {
            return Err("单次输入过长".into());
        }
        let session = self.with_session(id)?;
        let mut writer = session.writer.lock().unwrap_or_else(|e| e.into_inner());
        writer
            .write_all(input.as_bytes())
            .and_then(|_| writer.flush())
            .map_err(|e| format!("终端写入失败: {e}"))
    }

    fn resize(&self, data: &Value) -> Result<(), String> {
        let id = required_id(data)?;
        let session = self.with_session(id)?;
        let cols = dimension(data.get("cols"), DEFAULT_COLS, 20, 500);
        let rows = dimension(data.get("rows"), DEFAULT_ROWS, 4, 200);
        session
            .master
            .lock()
            .unwrap_or_else(|e| e.into_inner())
            .resize(PtySize {
                rows,
                cols,
                pixel_width: 0,
                pixel_height: 0,
            })
            .map_err(|e| format!("终端尺寸调整失败: {e}"))?;
        *session.cols.lock().unwrap_or_else(|e| e.into_inner()) = cols;
        *session.rows.lock().unwrap_or_else(|e| e.into_inner()) = rows;
        Ok(())
    }

    fn close(&self, id: &str, reason: &str) -> Result<(), String> {
        let session = self
            .sessions
            .lock()
            .unwrap_or_else(|e| e.into_inner())
            .remove(id)
            .ok_or_else(|| "终端不存在或已关闭".to_string())?;
        let mut child = session.child.lock().unwrap_or_else(|e| e.into_inner());
        let _ = child.kill();
        let _ = child.wait();
        self.emit(
            "terminal.closed",
            json!({ "terminalId": id, "reason": reason }),
        );
        Ok(())
    }

    fn finish(&self, id: &str, reason: &str) {
        let removed = self
            .sessions
            .lock()
            .unwrap_or_else(|e| e.into_inner())
            .remove(id);
        if let Some(session) = removed {
            let _ = session
                .child
                .lock()
                .unwrap_or_else(|e| e.into_inner())
                .wait();
            self.emit(
                "terminal.closed",
                json!({ "terminalId": id, "reason": reason }),
            );
        }
    }

    fn restart(self: &Arc<Self>, data: &Value) -> Result<Value, String> {
        let id = required_id(data)?.to_string();
        let old = self.with_session(&id)?;
        let cwd = old.cwd.to_string_lossy().to_string();
        let title = old.title.clone();
        let cols = *old.cols.lock().unwrap_or_else(|e| e.into_inner());
        let rows = *old.rows.lock().unwrap_or_else(|e| e.into_inner());
        self.close(&id, "正在重启")?;
        self.create(&json!({ "cwd": cwd, "title": title, "cols": cols, "rows": rows }))
    }
}

pub async fn handle(typ: &str, data: Value, tx: &Tx) {
    let manager = manager().clone();
    manager.set_tx(tx);

    let result: Result<(), String> = match typ {
        "terminal.list" => {
            match manager.ensure_default() {
                Ok(Some(meta)) => manager.emit("terminal.created", json!({ "terminal": meta })),
                Ok(None) => {}
                Err(error) => manager.emit("terminal.error", json!({ "error": error })),
            }
            manager.emit("terminal.list", json!({ "terminals": manager.list() }));
            Ok(())
        }
        "terminal.create" => manager
            .create(&data)
            .map(|meta| manager.emit("terminal.created", json!({ "terminal": meta }))),
        "terminal.input" => manager.input(&data),
        "terminal.resize" => manager.resize(&data),
        "terminal.close" => required_id(&data).and_then(|id| manager.close(id, "已关闭")),
        "terminal.restart" => manager
            .restart(&data)
            .map(|meta| manager.emit("terminal.created", json!({ "terminal": meta }))),
        _ => Err(format!("未知 terminal 操作: {typ}")),
    };

    if let Err(error) = result {
        manager.emit(
            "terminal.error",
            json!({
                "terminalId": data.get("terminalId").cloned().unwrap_or(Value::Null),
                "error": error,
            }),
        );
    }
}

fn required_id(data: &Value) -> Result<&str, String> {
    data.get("terminalId")
        .and_then(Value::as_str)
        .filter(|s| !s.is_empty())
        .ok_or_else(|| "缺少 terminalId".into())
}

fn dimension(value: Option<&Value>, fallback: u16, min: u16, max: u16) -> u16 {
    value
        .and_then(Value::as_u64)
        .and_then(|n| u16::try_from(n).ok())
        .unwrap_or(fallback)
        .clamp(min, max)
}

fn now_ms() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_millis() as u64)
        .unwrap_or(0)
}

fn terminal_id() -> String {
    format!(
        "term-{:x}-{:x}",
        now_ms(),
        NEXT_ID.fetch_add(1, Ordering::Relaxed)
    )
}

fn default_shell() -> String {
    #[cfg(windows)]
    {
        "powershell.exe".into()
    }
    #[cfg(not(windows))]
    {
        std::env::var("SHELL").unwrap_or_else(|_| {
            if cfg!(target_os = "macos") {
                "/bin/zsh".into()
            } else {
                "/bin/bash".into()
            }
        })
    }
}

fn resolve_cwd(raw: Option<&str>) -> Result<PathBuf, String> {
    let home = if cfg!(windows) {
        std::env::var("USERPROFILE")
    } else {
        std::env::var("HOME")
    }
    .map_err(|_| "无法确定用户目录".to_string())?;
    let mut path = raw
        .map(str::trim)
        .filter(|s| !s.is_empty())
        .map(PathBuf::from)
        .unwrap_or_else(|| {
            let desktop = Path::new(&home).join("Desktop");
            if desktop.is_dir() {
                desktop
            } else {
                PathBuf::from(&home)
            }
        });
    if !path.is_absolute() {
        path = Path::new(&home).join(path);
    }
    let resolved = path
        .canonicalize()
        .map_err(|e| format!("启动目录不可用: {e}"))?;
    if !resolved.is_dir() {
        return Err("启动目录不是文件夹".into());
    }
    Ok(resolved)
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::sync::Barrier;
    use tokio::sync::mpsc;
    use tokio::time::{timeout, Duration};
    use tokio_tungstenite::tungstenite::Message;

    #[test]
    fn concurrent_default_creation_is_idempotent() {
        let manager = Arc::new(TerminalManager::default());
        let barrier = Arc::new(Barrier::new(6));
        let workers: Vec<_> = (0..6)
            .map(|_| {
                let manager = manager.clone();
                let barrier = barrier.clone();
                std::thread::spawn(move || {
                    barrier.wait();
                    manager.ensure_default().expect("ensure default terminal")
                })
            })
            .collect();

        let created = workers
            .into_iter()
            .filter_map(|worker| worker.join().expect("join default terminal worker"))
            .count();
        let terminals = manager.list();
        assert_eq!(
            created, 1,
            "only one request may create the default terminal"
        );
        assert_eq!(
            terminals.len(),
            1,
            "manager must contain one default terminal"
        );

        let id = terminals[0]["id"].as_str().expect("terminal id");
        manager.close(id, "test complete").expect("close PTY");
    }

    #[tokio::test]
    async fn pty_round_trip_reaches_websocket_sink() {
        let manager = Arc::new(TerminalManager::default());
        let (tx, mut rx) = mpsc::unbounded_channel::<Message>();
        manager.set_tx(&tx);
        let meta = manager
            .create(&json!({ "cwd": default_test_cwd() }))
            .expect("create PTY");
        let id = meta["id"].as_str().expect("terminal id").to_string();
        manager
            .input(&json!({ "terminalId": id, "input": "printf '__one_pty_ok__\\n'\r" }))
            .expect("write command");

        let received = timeout(Duration::from_secs(8), async {
            let mut output = Vec::new();
            while let Some(Message::Text(raw)) = rx.recv().await {
                let msg: Value = serde_json::from_str(&raw).expect("json event");
                if msg["type"] != "terminal.output" || msg["data"]["terminalId"] != id {
                    continue;
                }
                let chunk = base64::engine::general_purpose::STANDARD
                    .decode(msg["data"]["data"].as_str().unwrap_or_default())
                    .expect("base64 output");
                output.extend(chunk);
                if output
                    .windows(b"__one_pty_ok__".len())
                    .any(|window| window == b"__one_pty_ok__")
                {
                    return true;
                }
            }
            false
        })
        .await
        .expect("PTY output timeout");

        assert!(received, "command marker missing from PTY output");
        manager.close(&id, "test complete").expect("close PTY");
    }

    fn default_test_cwd() -> String {
        if cfg!(windows) {
            std::env::var("USERPROFILE").expect("USERPROFILE")
        } else {
            std::env::var("HOME").expect("HOME")
        }
    }
}
