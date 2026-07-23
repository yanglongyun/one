// chat app:承载 agent 的工具调用。agent 跑在 worker 的对话流里,把 chat.tool.calls 广播给
// 各端;本设备执行层**自己捕捉归属自己的工具**(shell),跑完回 chat.tool.result。
//
// 线协议:收 chat.tool.calls{threadId, calls:[{id,name,args}]}
//         → 对归属本设备的每个 call 回 chat.tool.result{threadId, id, result}(扁平)。
use std::process::Stdio;
use std::time::Duration;

use serde_json::{json, Value};
use tokio::io::AsyncReadExt;
use tokio::process::Command;

use crate::system::{send, Tx};

const MAX_BUFFER: usize = 4 * 1024 * 1024; // shell 输出上限 4MB

pub async fn handle_calls(v: Value, tx: &Tx) {
    let thread_id = v.get("threadId").cloned().unwrap_or(Value::Null);
    let calls = v.get("calls").and_then(|x| x.as_array()).cloned().unwrap_or_default();
    for call in calls {
        let name = call.get("name").and_then(|x| x.as_str()).unwrap_or("");
        let id = call.get("id").cloned().unwrap_or(Value::Null);
        let args = call.get("args").cloned().unwrap_or_else(|| json!({}));
        // 只捕捉归属本设备的工具:shell + 文件三件套 + computer_*(mac 控制);其余交给别的执行层
        let result: Value = if name == "shell" {
            Value::String(run_shell(&args).await)
        } else if name == "read_file" || name == "write_file" || name == "edit_file" {
            Value::String(run_file_tool(name, &args).await)
        } else if crate::apps::computer::owns(name) {
            crate::apps::computer::run(name, &args).await
        } else {
            continue;
        };
        send(tx, json!({ "type": "chat.tool.result", "threadId": thread_id, "id": id, "result": result }));
    }
}

// 文件三件套:read_file / write_file / edit_file。
// edit_file 是安全的局部修改:old_string 逐字符精确匹配,匹配不到或不唯一(未开 replace_all)一律报错拒改,
// 从机制上杜绝「shell 重定向写歪 → 整文件覆盖」这类事故。
async fn run_file_tool(name: &str, args: &Value) -> String {
    let path = args.get("path").and_then(|x| x.as_str()).unwrap_or("").trim().to_string();
    if path.is_empty() {
        return "缺 path".into();
    }
    if !std::path::Path::new(&path).is_absolute() {
        return format!("path 必须是绝对路径:{path}");
    }

    match name {
        "read_file" => {
            let bytes = match tokio::fs::read(&path).await {
                Ok(b) => b,
                Err(e) => return format!("读取失败 {path}: {e}"),
            };
            let text = String::from_utf8_lossy(&bytes).to_string();
            let total_lines = text.lines().count();
            let offset = args.get("offset").and_then(|v| v.as_u64()).unwrap_or(1).max(1) as usize;
            let limit = args.get("limit").and_then(|v| v.as_u64()).map(|v| v as usize);
            let sliced: String = match (offset > 1, limit) {
                (false, None) => text,
                _ => text
                    .lines()
                    .skip(offset - 1)
                    .take(limit.unwrap_or(usize::MAX))
                    .collect::<Vec<_>>()
                    .join("\n"),
            };
            let mut out = sliced;
            if out.len() > MAX_BUFFER {
                out.truncate(MAX_BUFFER);
                out.push_str("\n…(内容超长已截断)");
            }
            if offset > 1 || limit.is_some() {
                format!("(共 {total_lines} 行,以下为第 {offset} 行起的片段)\n{out}")
            } else if out.is_empty() {
                "(空文件)".into()
            } else {
                out
            }
        }
        "write_file" => {
            let content = args.get("content").and_then(|x| x.as_str()).unwrap_or("");
            if let Some(dir) = std::path::Path::new(&path).parent() {
                if let Err(e) = tokio::fs::create_dir_all(dir).await {
                    return format!("创建目录失败 {}: {e}", dir.display());
                }
            }
            match tokio::fs::write(&path, content).await {
                Ok(_) => format!("已写入 {path}({} 字节)", content.len()),
                Err(e) => format!("写入失败 {path}: {e}"),
            }
        }
        "edit_file" => {
            let old = args.get("old_string").and_then(|x| x.as_str()).unwrap_or("");
            let new = args.get("new_string").and_then(|x| x.as_str()).unwrap_or("");
            if old.is_empty() {
                return "old_string 不能为空".into();
            }
            if old == new {
                return "old_string 与 new_string 相同,无需修改".into();
            }
            let text = match tokio::fs::read_to_string(&path).await {
                Ok(t) => t,
                Err(e) => return format!("读取失败 {path}: {e}"),
            };
            let count = text.matches(old).count();
            let replace_all = args.get("replace_all").and_then(|v| v.as_bool()).unwrap_or(false);
            if count == 0 {
                return "未找到 old_string:必须与文件内容逐字符一致(含缩进与换行),先 read_file 核对".into();
            }
            if count > 1 && !replace_all {
                return format!("old_string 匹配到 {count} 处,不唯一:扩大上下文使其唯一,或明确传 replace_all");
            }
            let updated = if replace_all { text.replace(old, new) } else { text.replacen(old, new, 1) };
            match tokio::fs::write(&path, updated).await {
                Ok(_) => format!("已替换 {count} 处:{path}"),
                Err(e) => format!("写回失败 {path}: {e}"),
            }
        }
        _ => "未知文件工具".into(),
    }
}

fn resolve_timeout_ms(t: Option<&Value>) -> u64 {
    let secs = t.and_then(|v| v.as_f64()).unwrap_or(30.0);
    let ms = (secs * 1000.0) as i64;
    ms.clamp(1000, 300_000) as u64
}

// tokio::process + 独立进程组 + 超时整组杀(SIGTERM→最多3s→SIGKILL)+ 忽略 stdin,
// 杜绝「孙子进程占管道→永远执行中」的假死。
async fn run_shell(args: &Value) -> String {
    let command = args.get("command").and_then(|x| x.as_str()).unwrap_or("").to_string();
    #[cfg(unix)]
    let home = std::env::var("HOME").unwrap_or_else(|_| "/".into());
    #[cfg(windows)]
    let home = std::env::var("USERPROFILE").unwrap_or_else(|_| "C:\\".into());
    let cwd = args
        .get("cwd")
        .and_then(|x| x.as_str())
        .map(|s| s.trim().to_string())
        .filter(|s| !s.is_empty())
        .unwrap_or(home);
    let timeout_ms = resolve_timeout_ms(args.get("timeout"));

    // 平台分 shell:unix 用 $SHELL -c;Windows 用 cmd /C。
    #[cfg(unix)]
    let mut cmd = {
        let shell = std::env::var("SHELL").unwrap_or_else(|_| "/bin/sh".into());
        let mut c = Command::new(shell);
        c.arg("-c").arg(&command);
        c.process_group(0); // 自成进程组,pid==pgid,便于整组杀
        c
    };
    #[cfg(windows)]
    let mut cmd = {
        let mut c = Command::new("cmd");
        c.arg("/C").arg(&command);
        c
    };
    cmd.current_dir(&cwd)
        .stdin(Stdio::null())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .kill_on_drop(true);

    let mut child = match cmd.spawn() {
        Ok(c) => c,
        Err(e) => return format!("启动失败: {e}"),
    };
    #[cfg(unix)]
    let pid = child.id().map(|p| p as i32);

    let mut so = child.stdout.take().unwrap();
    let mut se = child.stderr.take().unwrap();
    let r_out = tokio::spawn(async move {
        let mut b = Vec::new();
        let _ = so.read_to_end(&mut b).await;
        b
    });
    let r_err = tokio::spawn(async move {
        let mut b = Vec::new();
        let _ = se.read_to_end(&mut b).await;
        b
    });

    let mut timed_out = false;
    let mut code: Option<i32> = None;
    match tokio::time::timeout(Duration::from_millis(timeout_ms), child.wait()).await {
        Ok(Ok(status)) => code = status.code(),
        Ok(Err(_)) => {}
        Err(_) => {
            timed_out = true;
            #[cfg(unix)]
            {
                if let Some(p) = pid {
                    unsafe { libc::kill(-p, libc::SIGTERM) };
                }
                // 等优雅退出,最多 3s;还赖着就强杀整组
                if tokio::time::timeout(Duration::from_secs(3), child.wait()).await.is_err() {
                    if let Some(p) = pid {
                        unsafe { libc::kill(-p, libc::SIGKILL) };
                    }
                    let _ = child.wait().await;
                }
            }
            #[cfg(not(unix))]
            {
                let _ = child.kill().await;
                let _ = child.wait().await;
            }
        }
    }

    let mut out = r_out.await.unwrap_or_default();
    out.extend_from_slice(&r_err.await.unwrap_or_default());
    let truncated = out.len() > MAX_BUFFER;
    if truncated {
        out.truncate(MAX_BUFFER);
    }
    let text = String::from_utf8_lossy(&out).to_string();
    let tail = if truncated { "\n…(输出超长已截断)" } else { "" };

    if timed_out {
        return format!("超时({}s)已终止\n{text}{tail}", timeout_ms / 1000);
    }
    match code {
        Some(0) => {
            if text.is_empty() {
                "(no output)".to_string()
            } else {
                format!("{text}{tail}")
            }
        }
        Some(c) => format!("exit code {c}\n{text}{tail}"),
        None => format!("进程被信号终止\n{text}{tail}"),
    }
}
