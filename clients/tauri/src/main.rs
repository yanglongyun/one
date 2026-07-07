// one —— 桌面壳(纯 Rust)。
// 形态:首启显示原生设置页(主域名 + 密码,见 frontendDist 的本地 web/);填一次后跳转
// 加载云端 worker UI(带 #auth= 让网页自动登录),并由「执行臂」(connector,纯 Rust)
// 用同一份「主域名 + 密码」连 worker 的 system realtime 通道当一只手(shell / 文件 / 状态)。
// 代码按全平台统一心智模型组织:system(底座) + apps(业务),事件 app.xxx。
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod apps;
mod system;

use std::cell::RefCell;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::OnceLock;

use tauri::menu::{Menu, MenuItem, PredefinedMenuItem};
use tauri::tray::TrayIconBuilder;
use tauri::{AppHandle, Manager, WebviewUrl, WebviewWindowBuilder, WindowEvent, Wry};

static APP: OnceLock<AppHandle> = OnceLock::new();
static CONNECTED: AtomicBool = AtomicBool::new(false);
thread_local! {
    // 托盘「连接状态」菜单项只在主线程创建/更新(muda 菜单项非 Send)。
    static STATUS_ITEM: RefCell<Option<MenuItem<Wry>>> = const { RefCell::new(None) };
}

/// 执行臂连接状态变化 → 更新托盘菜单文字(任意线程可调,内部切主线程)。
pub fn set_conn_status(connected: bool) {
    CONNECTED.store(connected, Ordering::Relaxed);
    let Some(app) = APP.get() else { return };
    let _ = app.run_on_main_thread(move || {
        STATUS_ITEM.with(|c| {
            if let Some(item) = c.borrow().as_ref() {
                let _ = item.set_text(if connected { "状态:已连接" } else { "状态:未连接" });
            }
        });
    });
}

// 设置页查询:是否已配置 + 主域名(缺省给默认)+ 密码(用于跳转时自动登录网页)。
#[tauri::command]
fn app_state() -> serde_json::Value {
    let c = system::config::load();
    let configured = !c.worker_url.is_empty() && !c.name.is_empty();
    let worker = c.worker_url.clone();
    serde_json::json!({
        "configured": configured, "worker": worker, "password": c.password,
        "name": c.name, "autostart": c.autostart,
        "connected": CONNECTED.load(Ordering::Relaxed),
    })
}

/// 拼 worker 登录地址(带 #auth= 让网页自动登录)。
fn worker_login_url(worker: &str, password: &str) -> String {
    format!("{}/#auth={}", worker.trim().trim_end_matches('/'), urlencode(password))
}

fn urlencode(s: &str) -> String {
    let mut out = String::new();
    for b in s.bytes() {
        match b {
            b'A'..=b'Z' | b'a'..=b'z' | b'0'..=b'9' | b'-' | b'_' | b'.' | b'~' => out.push(b as char),
            _ => out.push_str(&format!("%{b:02X}")),
        }
    }
    out
}

// 设置页保存(主域名 + 密码 + 设备名)。执行臂每轮重读,几秒内自动连上。
// 保存后让主窗口(重新)加载新的 worker 地址,设置窗口自身不跳转。
// 第 1 步保存凭证(主域名 + 密码 + 设备名):只持久化,不跳转。
// 执行臂每轮重读 config,几秒内自动连上;进入云端由第 2 步「进入 one」显式触发。
#[tauri::command]
fn save_creds(worker: String, password: String, name: String) {
    system::config::save(&worker, &password, &name);
}

// 第 2 步:用已保存的凭证把主窗口导航进云端(设置窗口调用;主窗口自己在前端 go() 跳转)。
#[tauri::command]
fn enter(app: AppHandle) {
    let c = system::config::load();
    if c.worker_url.is_empty() {
        return;
    }
    if let Ok(url) = tauri::Url::parse(&worker_login_url(&c.worker_url, &c.password)) {
        // 优先主窗口;找不到就退到任意非设置窗口,避免 label 变动时静默失效
        let target = app.get_webview_window("main").or_else(|| {
            app.webview_windows()
                .into_iter()
                .find(|(label, _)| label != "settings")
                .map(|(_, w)| w)
        });
        if let Some(w) = target {
            let _ = w.navigate(url);
            let _ = w.show();
        }
    }
}

// 开机自启开关:持久化到 config.json 并即时生效。
#[tauri::command]
fn set_autostart(app: AppHandle, enabled: bool) {
    system::config::set_autostart(enabled);
    use tauri_plugin_autostart::ManagerExt;
    let al = app.autolaunch();
    let _ = if enabled { al.enable() } else { al.disable() };
}

/// 显示/聚焦独立设置窗口(加载本地 web/index.html)。
fn show_settings_window(app: &AppHandle) {
    if let Some(w) = app.get_webview_window("settings") {
        let _ = w.show();
        let _ = w.set_focus();
        return;
    }
    let _ = WebviewWindowBuilder::new(app, "settings", WebviewUrl::App("index.html".into()))
        .title("连接设置")
        .inner_size(420.0, 640.0)
        .resizable(false)
        .maximizable(false)
        .center()
        .build();
}

// 从任意 webview(含 worker 网页)打开设置窗口。
#[tauri::command]
fn open_settings(app: AppHandle) {
    show_settings_window(&app);
}

// mac 权限检测:辅助功能(AXIsProcessTrusted)+ 屏幕录制(CGPreflightScreenCaptureAccess)。
// 非 macOS 返回 supported:false,前端据此隐藏权限区。
#[tauri::command]
fn mac_permissions() -> serde_json::Value {
    #[cfg(target_os = "macos")]
    {
        #[link(name = "ApplicationServices", kind = "framework")]
        extern "C" {
            fn AXIsProcessTrusted() -> u8;
        }
        #[link(name = "CoreGraphics", kind = "framework")]
        extern "C" {
            fn CGPreflightScreenCaptureAccess() -> u8;
        }
        let (ax, screen) = unsafe { (AXIsProcessTrusted() != 0, CGPreflightScreenCaptureAccess() != 0) };
        serde_json::json!({ "supported": true, "accessibility": ax, "screenRecording": screen })
    }
    #[cfg(not(target_os = "macos"))]
    {
        serde_json::json!({ "supported": false })
    }
}

// 打开系统设置对应隐私页(macOS)。pane: "accessibility" | "screen"。
#[tauri::command]
#[allow(unused_variables)]
fn open_privacy_settings(pane: String) {
    #[cfg(target_os = "macos")]
    {
        let url = match pane.as_str() {
            "screen" => "x-apple.systempreferences:com.apple.preference.security?Privacy_ScreenCapture",
            _ => "x-apple.systempreferences:com.apple.preference.security?Privacy_Accessibility",
        };
        let _ = std::process::Command::new("open").arg(url).spawn();
    }
}

fn main() {
    // 执行臂跑在独立的多线程 tokio 运行时(enable_all 提供 process/io/time 驱动)。
    std::thread::spawn(|| {
        match tokio::runtime::Builder::new_multi_thread().enable_all().build() {
            Ok(rt) => rt.block_on(system::run()),
            Err(e) => eprintln!("[one] tokio 运行时启动失败: {e}"),
        }
    });

    tauri::Builder::default()
        .plugin(tauri_plugin_autostart::init(
            tauri_plugin_autostart::MacosLauncher::LaunchAgent,
            None,
        ))
        .invoke_handler(tauri::generate_handler![app_state, save_creds, enter, set_autostart, open_settings, mac_permissions, open_privacy_settings])
        .setup(|app| {
            let _ = APP.set(app.handle().clone());

            // 开机自启:按 config.json 的 autostart 开关(缺省 true)。
            {
                use tauri_plugin_autostart::ManagerExt;
                let al = app.autolaunch();
                if system::config::load().autostart {
                    let _ = al.enable();
                } else {
                    let _ = al.disable();
                }
            }

            // 系统托盘:显示主窗口 / 连接状态(disabled)/ 退出。
            let show = MenuItem::with_id(app, "show", "显示主窗口", true, None::<&str>)?;
            let settings = MenuItem::with_id(app, "settings", "连接设置", true, None::<&str>)?;
            let status = MenuItem::with_id(app, "status", "状态:未连接", false, None::<&str>)?;
            let sep = PredefinedMenuItem::separator(app)?;
            let quit = MenuItem::with_id(app, "quit", "退出", true, None::<&str>)?;
            let menu = Menu::with_items(app, &[&show, &settings, &status, &sep, &quit])?;
            STATUS_ITEM.with(|c| *c.borrow_mut() = Some(status));

            let mut tray = TrayIconBuilder::with_id("main")
                .menu(&menu)
                .show_menu_on_left_click(true)
                .on_menu_event(|app, event| match event.id().as_ref() {
                    "show" => {
                        if let Some(w) = app.get_webview_window("main").or_else(|| app.webview_windows().values().next().cloned()) {
                            let _ = w.show();
                            let _ = w.set_focus();
                        }
                    }
                    "settings" => show_settings_window(app),
                    "quit" => app.exit(0),
                    _ => {}
                });
            if let Some(icon) = app.default_window_icon() {
                tray = tray.icon(icon.clone());
            }
            tray.build(app)?;
            Ok(())
        })
        // 关窗不退出:拦截 close → 隐藏窗口,常驻托盘;托盘「退出」才真正退出。
        .on_window_event(|window, event| {
            if let WindowEvent::CloseRequested { api, .. } = event {
                api.prevent_close();
                let _ = window.hide();
            }
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
