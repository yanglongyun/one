// status app:设备状态快照(cpu/mem/disk/network/host)。
// 线协议:收 status.request{data:{reqId}} → 回 status.result{data:{reqId,ok,...snapshot}}。
use std::path::Path;
use std::time::{Duration, SystemTime, UNIX_EPOCH};

use serde_json::{json, Value};

use crate::system::{send_data, Tx};

pub async fn handle(d: Value, tx: &Tx) {
    let req = d.get("reqId").cloned().unwrap_or(Value::Null);
    let snap = snapshot().await;
    let mut o = json!({ "reqId": req, "ok": true });
    if let Value::Object(m) = snap {
        for (k, v) in m {
            o[k] = v;
        }
    }
    send_data(tx, "status.result", o);
}

fn now_ms() -> u128 {
    SystemTime::now().duration_since(UNIX_EPOCH).map(|d| d.as_millis()).unwrap_or(0)
}

fn platform_name() -> &'static str {
    match std::env::consts::OS {
        "macos" => "darwin",
        "windows" => "win32",
        o => o,
    }
}

fn round1(x: f64) -> f64 {
    (x * 10.0).round() / 10.0
}

async fn snapshot() -> Value {
    use sysinfo::{Disks, System};

    let mut sys = System::new();
    sys.refresh_cpu();
    tokio::time::sleep(Duration::from_millis(200)).await;
    sys.refresh_cpu();
    sys.refresh_memory();

    let cpus = sys.cpus();
    let count = cpus.len();
    let model = cpus.first().map(|c| c.brand().to_string()).unwrap_or_default();
    let speed = cpus.first().map(|c| c.frequency()).unwrap_or(0);
    let usage = sys.global_cpu_info().cpu_usage() as f64;

    let total = sys.total_memory();
    let free = sys.free_memory();
    let used = total.saturating_sub(free);
    let mem_percent = if total > 0 { round1(used as f64 / total as f64 * 100.0) } else { 0.0 };

    let load = System::load_average();
    let uptime = System::uptime();
    let hostname = System::host_name().unwrap_or_default();
    let release = System::kernel_version().unwrap_or_default();
    let arch = match std::env::consts::ARCH {
        "aarch64" => "arm64",
        "x86_64" => "x64",
        a => a,
    };

    let disks = Disks::new_with_refreshed_list();
    let mut disk = Value::Null;
    for dsk in disks.list() {
        if dsk.mount_point() == Path::new("/") {
            let dt = dsk.total_space();
            let da = dsk.available_space();
            let du = dt.saturating_sub(da);
            disk = json!({
                "mount": "/", "total": dt, "used": du, "free": da,
                "percent": if dt > 0 { round1(du as f64 / dt as f64 * 100.0) } else { 0.0 },
            });
            break;
        }
    }

    let mut net: Vec<Value> = Vec::new();
    if let Ok(ifaces) = if_addrs::get_if_addrs() {
        for i in ifaces {
            if i.is_loopback() {
                continue;
            }
            if let std::net::IpAddr::V4(v4) = i.ip() {
                net.push(json!({ "name": i.name, "address": v4.to_string(), "mac": "" }));
            }
        }
    }

    json!({
        "capturedAt": now_ms(),
        "host": {
            "hostname": hostname, "platform": platform_name(), "release": release,
            "arch": arch, "uptime": uptime,
        },
        "cpu": {
            "count": count, "model": model, "speed": speed,
            "usagePercent": round1(usage), "loadavg": [load.one, load.five, load.fifteen],
        },
        "mem": { "total": total, "free": free, "used": used, "percent": mem_percent },
        "disk": disk,
        "network": net,
    })
}
