// 配置:所有客户端统一三字段「主域名 + 密码 + 设备名(唯一)」。设备名是寻址键。
// 来源优先级:环境变量 WORKER_URL / ONE_PASSWORD / ONE_NAME > data_dir/config.json。
use serde_json::Value;
use std::path::{Path, PathBuf};
use std::sync::atomic::{AtomicU64, Ordering};

static REVISION: AtomicU64 = AtomicU64::new(0);

pub fn revision() -> u64 {
    REVISION.load(Ordering::Relaxed)
}

pub struct Config {
    pub worker_url: String,
    pub password: String,
    pub name: String,
    /// 开机自启(config.json 的 autostart 布尔项,缺省 true)。
    pub autostart: bool,
}

pub fn data_dir() -> Option<PathBuf> {
    #[cfg(target_os = "macos")]
    let d = Path::new(&std::env::var("HOME").ok()?).join("Library/Application Support/one");
    #[cfg(target_os = "windows")]
    let d = Path::new(&std::env::var("APPDATA").ok()?).join("one");
    #[cfg(not(any(target_os = "macos", target_os = "windows")))]
    let d = Path::new(&std::env::var("HOME").ok()?).join(".config/one");
    let _ = std::fs::create_dir_all(&d);
    Some(d)
}

pub fn load() -> Config {
    let mut url = std::env::var("WORKER_URL").unwrap_or_default();
    let mut pw = std::env::var("ONE_PASSWORD").unwrap_or_default();
    let mut name = std::env::var("ONE_NAME").unwrap_or_default();
    let mut autostart = true;
    if let Some(p) = data_dir().map(|d| d.join("config.json")) {
        if let Ok(s) = std::fs::read_to_string(&p) {
            if let Ok(v) = serde_json::from_str::<Value>(&s) {
                let get = |k: &str| v.get(k).and_then(|x| x.as_str()).unwrap_or("").to_string();
                if url.is_empty() { url = get("worker_url"); }
                if pw.is_empty() { pw = get("password"); }
                if name.is_empty() { name = get("name"); }
                autostart = v.get("autostart").and_then(|x| x.as_bool()).unwrap_or(true);
            }
        }
    }
    Config {
        worker_url: url.trim().trim_end_matches('/').to_string(),
        password: pw.trim().to_string(),
        name: name.trim().to_string(),
        autostart,
    }
}

// 原生设置页写入(主域名 + 密码 + 设备名),并通知执行臂立即重连。
pub fn save(worker_url: &str, password: &str, name: &str) {
    if let Some(dir) = data_dir() {
        let autostart = load().autostart; // 保留已有的 autostart 开关
        let v = serde_json::json!({
            "worker_url": worker_url.trim().trim_end_matches('/'),
            "password": password,
            "name": name.trim(),
            "autostart": autostart,
        });
        let _ = std::fs::write(dir.join("config.json"), serde_json::to_string_pretty(&v).unwrap_or_default());
        REVISION.fetch_add(1, Ordering::Relaxed);
    }
}

// 设置页写入开机自启开关(其余字段原样保留)。
pub fn set_autostart(enabled: bool) {
    if let Some(dir) = data_dir() {
        let c = load();
        let v = serde_json::json!({
            "worker_url": c.worker_url,
            "password": c.password,
            "name": c.name,
            "autostart": enabled,
        });
        let _ = std::fs::write(dir.join("config.json"), serde_json::to_string_pretty(&v).unwrap_or_default());
    }
}

pub fn log(msg: &str) {
    eprintln!("[one] {msg}");
    if let Some(d) = data_dir() {
        use std::io::Write;
        if let Ok(mut f) = std::fs::OpenOptions::new().create(true).append(true).open(d.join("agent.log")) {
            let _ = writeln!(f, "{msg}");
        }
    }
}
