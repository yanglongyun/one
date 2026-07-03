// files app:本机文件浏览/读取（**只读**,不提供写入)。事件 files.*。
//
// 线协议:收 files.{home,list,stat,read}{data:{reqId,...}}
//         回 files.result{data:{reqId,ok,...}};read 流式 files.read.meta + files.read.chunk。
use std::path::Path;
use std::time::UNIX_EPOCH;

use base64::Engine as _;
use serde_json::{json, Value};
use tokio::io::AsyncReadExt;

use crate::system::{send_data, Tx};

const READ_CHUNK: usize = 256 * 1024; // 256KB
const MAX_PREVIEW: u64 = 20 * 1024 * 1024; // 20MB

pub async fn handle(t: &str, d: Value, tx: &Tx) {
    let req = d.get("reqId").cloned().unwrap_or(Value::Null);
    let r: Result<Value, String> = match t {
        "files.home" => home(),
        "files.list" => list(&d).await,
        "files.stat" => stat(&d).await,
        "files.read" => match read(&d, &req, tx).await {
            Ok(()) => return, // read 自己流式发完
            Err(e) => Err(e),
        },
        _ => Err(format!("未知 files 操作: {t}(本设备文件只读)")),
    };
    match r {
        Ok(payload) => {
            let mut o = json!({ "reqId": req, "ok": true });
            if let Value::Object(m) = payload {
                for (k, v) in m {
                    o[k] = v;
                }
            }
            send_data(tx, "files.result", o);
        }
        Err(e) => send_data(tx, "files.result", json!({ "reqId": req, "ok": false, "error": e })),
    }
}

fn mtime_ms(md: &std::fs::Metadata) -> f64 {
    md.modified()
        .ok()
        .and_then(|t| t.duration_since(UNIX_EPOCH).ok())
        .map(|d| d.as_secs_f64() * 1000.0)
        .unwrap_or(0.0)
}

fn home() -> Result<Value, String> {
    #[cfg(windows)]
    let home = std::env::var("USERPROFILE").map_err(|_| "无 USERPROFILE".to_string())?;
    #[cfg(not(windows))]
    let home = std::env::var("HOME").map_err(|_| "无 HOME".to_string())?;
    let platform = match std::env::consts::OS { "macos" => "darwin", "windows" => "win32", o => o };
    Ok(json!({ "path": home, "sep": std::path::MAIN_SEPARATOR.to_string(), "platform": platform }))
}

async fn list(d: &Value) -> Result<Value, String> {
    let home = std::env::var("HOME").unwrap_or_default();
    let p = d
        .get("path")
        .and_then(|x| x.as_str())
        .filter(|s| !s.is_empty())
        .unwrap_or(&home)
        .to_string();
    let show_hidden = d.get("showHidden").and_then(|x| x.as_bool()).unwrap_or(false);

    let mut rd = tokio::fs::read_dir(&p).await.map_err(|e| e.to_string())?;
    let mut items: Vec<Value> = Vec::new();
    while let Some(e) = rd.next_entry().await.map_err(|e| e.to_string())? {
        let name = e.file_name().to_string_lossy().to_string();
        if !show_hidden && name.starts_with('.') {
            continue;
        }
        let is_link = e.file_type().await.map(|ft| ft.is_symlink()).unwrap_or(false);
        let full = Path::new(&p).join(&name);
        let (typ, size, mtime) = match tokio::fs::metadata(&full).await {
            // 跟随符号链接,与原 Node fsp.stat 一致
            Ok(md) => {
                let typ = if md.is_dir() {
                    "dir"
                } else if is_link {
                    "link"
                } else {
                    "file"
                };
                (typ.to_string(), md.len(), mtime_ms(&md))
            }
            Err(_) => ("unknown".to_string(), 0u64, 0f64),
        };
        items.push(json!({ "name": name, "type": typ, "size": size, "mtime": mtime }));
    }
    items.sort_by(|a, b| {
        let (ta, tb) = (a["type"].as_str().unwrap_or(""), b["type"].as_str().unwrap_or(""));
        if ta != tb {
            if ta == "dir" {
                return std::cmp::Ordering::Less;
            }
            if tb == "dir" {
                return std::cmp::Ordering::Greater;
            }
        }
        a["name"].as_str().unwrap_or("").cmp(b["name"].as_str().unwrap_or(""))
    });
    Ok(json!({ "path": p, "entries": items }))
}

async fn stat(d: &Value) -> Result<Value, String> {
    let p = d.get("path").and_then(|x| x.as_str()).ok_or("缺少 path")?.to_string();
    let md = tokio::fs::metadata(&p).await.map_err(|e| e.to_string())?;
    Ok(json!({
        "path": p,
        "type": if md.is_dir() { "dir" } else { "file" },
        "size": md.len(),
        "mtime": mtime_ms(&md),
    }))
}

async fn read(d: &Value, req: &Value, tx: &Tx) -> Result<(), String> {
    let p = d.get("path").and_then(|x| x.as_str()).ok_or("缺少 path")?.to_string();
    let limit = d.get("maxSize").and_then(|x| x.as_u64()).unwrap_or(MAX_PREVIEW).min(MAX_PREVIEW);
    let md = tokio::fs::metadata(&p).await.map_err(|e| e.to_string())?;
    if md.is_dir() {
        return Err("是目录，不能读取".into());
    }
    if md.len() > limit {
        return Err(format!("文件过大 ({} 字节 / 上限 {limit})", md.len()));
    }
    let name = Path::new(&p).file_name().map(|s| s.to_string_lossy().to_string()).unwrap_or_default();
    let mime = guess_mime(&name);
    send_data(tx, "files.read.meta", json!({ "reqId": req, "name": name, "size": md.len(), "mime": mime }));

    let size = md.len();
    if size == 0 {
        send_data(tx, "files.read.chunk", json!({ "reqId": req, "seq": 0, "data": "", "eof": true }));
        return Ok(());
    }
    let mut f = tokio::fs::File::open(&p).await.map_err(|e| e.to_string())?;
    let mut buf = vec![0u8; READ_CHUNK];
    let mut seq = 0u64;
    let mut total = 0u64;
    loop {
        let n = f.read(&mut buf).await.map_err(|e| e.to_string())?;
        if n == 0 {
            break;
        }
        total += n as u64;
        let eof = total >= size;
        let b64 = base64::engine::general_purpose::STANDARD.encode(&buf[..n]);
        send_data(tx, "files.read.chunk", json!({ "reqId": req, "seq": seq, "data": b64, "eof": eof }));
        seq += 1;
        if eof {
            break;
        }
    }
    Ok(())
}

fn guess_mime(name: &str) -> &'static str {
    let ext = Path::new(name).extension().and_then(|s| s.to_str()).unwrap_or("").to_ascii_lowercase();
    match ext.as_str() {
        "txt" => "text/plain",
        "md" => "text/markdown",
        "json" => "application/json",
        "js" | "mjs" | "jsx" => "text/javascript",
        "ts" | "tsx" => "text/typescript",
        "html" | "htm" => "text/html",
        "css" => "text/css",
        "xml" => "application/xml",
        "yml" | "yaml" => "text/yaml",
        "toml" | "ini" | "conf" => "text/plain",
        "sh" | "zsh" | "bash" => "text/x-shellscript",
        "py" => "text/x-python",
        "rb" => "text/x-ruby",
        "go" => "text/x-go",
        "rs" => "text/x-rust",
        "java" => "text/x-java",
        "c" | "h" => "text/x-c",
        "cpp" | "hpp" => "text/x-c++",
        "svg" => "image/svg+xml",
        "png" => "image/png",
        "jpg" | "jpeg" => "image/jpeg",
        "gif" => "image/gif",
        "webp" => "image/webp",
        "bmp" => "image/bmp",
        "ico" => "image/x-icon",
        "pdf" => "application/pdf",
        "zip" => "application/zip",
        "tar" => "application/x-tar",
        "gz" => "application/gzip",
        "mp3" => "audio/mpeg",
        "mp4" => "video/mp4",
        "mov" => "video/quicktime",
        _ => "application/octet-stream",
    }
}
