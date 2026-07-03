// mac 电脑控制(经 AppleScript / System Events;按元素名操作,无需视觉)。
// 需用户在「系统设置 → 隐私与安全性 → 辅助功能 / 自动化」给 one 授权。
// 截图能力统一叫 screenshot,让「看屏」更可靠(自绘/画布类界面 AX 读不到)。
#[cfg(target_os = "macos")]
use std::process::Stdio;

#[cfg(target_os = "macos")]
use base64::Engine;
use serde_json::{json, Value};
#[cfg(target_os = "macos")]
use tokio::process::Command;

pub fn owns(name: &str) -> bool {
    name.starts_with("computer_") || name == "screenshot"
}

// 非 macOS:这些能力不宣告(见 connection.rs),即便被点名也礼貌拒绝。
#[cfg(not(target_os = "macos"))]
pub async fn run(_name: &str, _args: &Value) -> Value {
    json!({ "error": "此平台暂不支持" })
}

// 解析 sips 输出里的某个像素维度
#[cfg(target_os = "macos")]
fn parse_dim(s: &str, key: &str) -> u32 {
    s.lines()
        .find(|l| l.contains(key))
        .and_then(|l| l.rsplit(':').next())
        .and_then(|v| v.trim().parse().ok())
        .unwrap_or(0)
}

// 跑一段 AppleScript
#[cfg(target_os = "macos")]
async fn osa(script: &str) -> Result<String, String> {
    let out = Command::new("osascript")
        .arg("-e")
        .arg(script)
        .stdin(Stdio::null())
        .output()
        .await
        .map_err(|e| e.to_string())?;
    if out.status.success() {
        Ok(String::from_utf8_lossy(&out.stdout).trim().to_string())
    } else {
        Err(String::from_utf8_lossy(&out.stderr).trim().to_string())
    }
}

// AppleScript 字符串字面量(转义引号/反斜杠)
#[cfg(target_os = "macos")]
fn q(s: &str) -> String {
    format!("\"{}\"", s.replace('\\', "\\\\").replace('"', "\\\""))
}

#[cfg(target_os = "macos")]
pub async fn run(name: &str, args: &Value) -> Value {
    match name {
        // 读屏(best-effort):前台 app + 所有窗口的 AX 元素。AI 据此按名点。
        "computer_screen" => {
            let s = r#"set out to ""
set seen to 0
set maxItems to 300

on safeText(v)
  try
    if v is missing value then return ""
    set s to v as text
    if s is "missing value" then return ""
    return s
  on error
    return ""
  end try
end safeText

on firstText(a, b, c, d)
  if a is not "" then return a
  if b is not "" then return b
  if c is not "" then return c
  return d
end firstText

on roleLabel(roleName, className)
  if roleName is "AXButton" then return "按钮"
  if roleName is "AXTextField" or roleName is "AXTextArea" then return "输入框"
  if roleName is "AXStaticText" then return "文本"
  if roleName is "AXCheckBox" then return "复选框"
  if roleName is "AXRadioButton" or roleName is "AXRadioGroup" then return "单选"
  if roleName is "AXPopUpButton" then return "下拉"
  if roleName is "AXComboBox" then return "组合框"
  if roleName is "AXMenuButton" then return "菜单按钮"
  if roleName is "AXMenuItem" then return "菜单项"
  if roleName is "AXLink" then return "链接"
  if roleName is "AXTable" then return "表格"
  if roleName is "AXOutline" then return "大纲"
  if roleName is "AXList" then return "列表"
  if roleName is "AXScrollArea" then return "滚动区域"
  if roleName is "AXSlider" then return "滑块"
  if roleName is "AXProgressIndicator" then return "进度"
  if roleName is "AXImage" then return "图片"
  if roleName is "AXGroup" then return "分组"
  if roleName is "AXSheet" then return "弹窗"
  if roleName is "AXWindow" then return "窗口"
  if className is not "" then return className
  return "元素"
end roleLabel

on appendElement(e, depth)
  global out, seen, maxItems
  if seen >= maxItems then return

  set roleName to ""
  set subroleName to ""
  set className to ""
  set nameText to ""
  set valueText to ""
  set descText to ""
  set helpText to ""
  set titleText to ""
  set enabledText to ""

  try
    set roleName to my safeText(role of e)
  end try
  try
    set subroleName to my safeText(subrole of e)
  end try
  try
    set className to my safeText(class of e)
  end try
  try
    set nameText to my safeText(name of e)
  end try
  try
    set valueText to my safeText(value of e)
  end try
  try
    set descText to my safeText(description of e)
  end try
  try
    set helpText to my safeText(help of e)
  end try
  try
    set titleText to my safeText(title of e)
  end try
  try
    set enabledText to my safeText(enabled of e)
  end try

  set labelText to my firstText(nameText, titleText, descText, helpText)
  if labelText is not "" or valueText is not "" or roleName is not "" or className is not "" then
    set indentText to ""
    repeat depth times
      set indentText to indentText & "  "
    end repeat
    set lineText to indentText & my roleLabel(roleName, className)
    if roleName is not "" then set lineText to lineText & "(" & roleName & ")"
    if subroleName is not "" then set lineText to lineText & "/" & subroleName
    if labelText is not "" then set lineText to lineText & ": " & labelText
    if valueText is not "" and valueText is not labelText then set lineText to lineText & " = " & valueText
    if enabledText is "false" then set lineText to lineText & " [禁用]"
    set out to out & lineText & linefeed
    set seen to seen + 1
  end if
end appendElement

on walk(e, depth)
  global seen, maxItems
  if seen >= maxItems or depth > 8 then return
  my appendElement(e, depth)
  try
    repeat with child in (UI elements of e)
      my walk(child, depth + 1)
      if seen >= maxItems then exit repeat
    end repeat
  end try
end walk

tell application "System Events"
  set p to first application process whose frontmost is true
  set out to "前台应用: " & (name of p) & linefeed
  tell p
    try
      set windowCount to count of windows
      if windowCount is 0 then
        set out to out & "窗口: 无" & linefeed
      else
        repeat with w in windows
          my walk(w, 0)
          if seen >= maxItems then exit repeat
        end repeat
      end if
    on error errMsg
      set out to out & "读屏失败: " & errMsg & linefeed
    end try
  end tell
end tell

if seen >= maxItems then set out to out & "...已截断，仅显示前 " & maxItems & " 个元素" & linefeed
return out"#;
            match osa(s).await {
                Ok(v) => json!({ "screen": v }),
                Err(e) => json!({ "error": e }),
            }
        }

        // 截屏:给视觉模型用。返回 base64 PNG + 图像像素尺寸(w,h)+ 点击坐标空间尺寸(cw,ch=屏幕点)。
        "screenshot" => screenshot().await,

        // 点击:传 text → 按元素名(AX,稳);传 x,y → 坐标点击(点空间,视觉定位后用)
        "computer_click" => {
            let text = args.get("text").and_then(|x| x.as_str()).unwrap_or("");
            if !text.is_empty() {
                let s = format!(
                    r#"set targetText to {}

on safeText(v)
  try
    if v is missing value then return ""
    set s to v as text
    if s is "missing value" then return ""
    return s
  on error
    return ""
  end try
end safeText

on matchesTarget(e)
  global targetText
  try
    if my safeText(name of e) is targetText then return true
  end try
  try
    if my safeText(title of e) is targetText then return true
  end try
  try
    if my safeText(description of e) is targetText then return true
  end try
  try
    if my safeText(help of e) is targetText then return true
  end try
  try
    if my safeText(value of e) is targetText then return true
  end try
  return false
end matchesTarget

on clickNamed(e, depth)
  if depth > 8 then return false
  if my matchesTarget(e) then
    try
      click e
      return true
    end try
    try
      perform action "AXPress" of e
      return true
    end try
  end if
  try
    repeat with child in (UI elements of e)
      if my clickNamed(child, depth + 1) then return true
    end repeat
  end try
  return false
end clickNamed

tell application "System Events"
  set p to first application process whose frontmost is true
  tell p
    repeat with w in windows
      if my clickNamed(w, 0) then return "ok"
    end repeat
  end tell
end tell

error "未找到可点击元素: " & targetText"#,
                    q(text)
                );
                return match osa(&s).await {
                    Ok(_) => json!({ "ok": true }),
                    Err(e) => json!({ "error": e }),
                };
            }
            match (args.get("x").and_then(|v| v.as_f64()), args.get("y").and_then(|v| v.as_f64())) {
                (Some(x), Some(y)) => click_at(x as i32, y as i32),
                _ => json!({ "error": "缺少 text 或 x,y" }),
            }
        }

        // 输入文本(往当前聚焦处)
        "computer_type" => {
            let t = args.get("text").and_then(|x| x.as_str()).unwrap_or("");
            let s = format!("tell application \"System Events\" to keystroke {}", q(t));
            match osa(&s).await {
                Ok(_) => json!({ "ok": true }),
                Err(e) => json!({ "error": e }),
            }
        }

        // 按键:常用命名键 → key code;否则当作字符 keystroke
        "computer_key" => {
            let key = args.get("key").and_then(|x| x.as_str()).unwrap_or("");
            let action = match key {
                "enter" | "return" => "key code 36".to_string(),
                "tab" => "key code 48".to_string(),
                "space" => "key code 49".to_string(),
                "escape" | "esc" => "key code 53".to_string(),
                "delete" | "backspace" => "key code 51".to_string(),
                "up" => "key code 126".to_string(),
                "down" => "key code 125".to_string(),
                "left" => "key code 123".to_string(),
                "right" => "key code 124".to_string(),
                other => format!("keystroke {}", q(other)),
            };
            match osa(&format!("tell application \"System Events\" to {action}")).await {
                Ok(_) => json!({ "ok": true }),
                Err(e) => json!({ "error": e }),
            }
        }

        // 打开/切到一个 app
        "computer_open_app" => {
            let n = args.get("name").and_then(|x| x.as_str()).unwrap_or("");
            match Command::new("open").arg("-a").arg(n).stdin(Stdio::null()).status().await {
                Ok(st) if st.success() => json!({ "ok": true }),
                _ => json!({ "error": format!("打开失败: {n}") }),
            }
        }

        other => json!({ "error": format!("{other} 未实现") }),
    }
}

// 截屏 → base64 PNG + 尺寸。w,h=图像像素(已缩到宽1280);cw,ch=点击坐标空间(屏幕点)。
#[cfg(target_os = "macos")]
async fn screenshot() -> Value {
    let path = std::env::temp_dir().join("one-shot.png");
    let p = path.to_string_lossy().to_string();
    let captured = Command::new("screencapture")
        .arg("-x").arg(&p).stdin(Stdio::null()).status().await
        .map(|s| s.success()).unwrap_or(false);
    if !captured {
        return json!({ "error": "screencapture 失败(可能缺『屏幕录制』权限)" });
    }
    // 缩到宽 1280,省 token
    let _ = Command::new("sips").args(["-Z", "1280", &p]).stdin(Stdio::null()).output().await;
    let dims = Command::new("sips")
        .args(["-g", "pixelWidth", "-g", "pixelHeight", &p]).output().await
        .map(|o| String::from_utf8_lossy(&o.stdout).to_string()).unwrap_or_default();
    let w = parse_dim(&dims, "pixelWidth");
    let h = parse_dim(&dims, "pixelHeight");
    let (cw, ch) = desktop_points().await;
    let bytes = match tokio::fs::read(&p).await {
        Ok(b) => b,
        Err(e) => return json!({ "error": e.to_string() }),
    };
    let b64 = base64::engine::general_purpose::STANDARD.encode(&bytes);
    json!({ "image": format!("data:image/png;base64,{b64}"), "w": w, "h": h, "cw": cw, "ch": ch })
}

// 桌面点尺寸(Finder desktop bounds 返回的是点,正是 enigo 点击坐标空间)
#[cfg(target_os = "macos")]
async fn desktop_points() -> (u32, u32) {
    let out = osa("tell application \"Finder\" to get bounds of window of desktop").await.unwrap_or_default();
    let nums: Vec<i64> = out.split(',').filter_map(|s| s.trim().parse().ok()).collect();
    if nums.len() == 4 {
        (nums[2].max(0) as u32, nums[3].max(0) as u32)
    } else {
        (0, 0)
    }
}

// 坐标点击(点空间)。需『辅助功能』权限。
#[cfg(target_os = "macos")]
fn click_at(x: i32, y: i32) -> Value {
    use enigo::{Button, Coordinate, Direction, Enigo, Mouse, Settings};
    let mut e = match Enigo::new(&Settings::default()) {
        Ok(e) => e,
        Err(err) => return json!({ "error": format!("enigo 初始化失败(需辅助功能权限): {err}") }),
    };
    if let Err(err) = e.move_mouse(x, y, Coordinate::Abs) {
        return json!({ "error": err.to_string() });
    }
    if let Err(err) = e.button(Button::Left, Direction::Click) {
        return json!({ "error": err.to_string() });
    }
    json!({ "ok": true, "x": x, "y": y })
}
