// 派发:按 app 前缀路由(app.xxx)。新增 app = 加一条分支 + 一个 apps/ 文件。
use serde_json::{json, Value};

use super::Tx;
use crate::apps::{chat, files, status, terminal};

pub async fn dispatch(v: Value, tx: Tx) {
    let t = v.get("type").and_then(|x| x.as_str()).unwrap_or("");

    // chat.tool.calls:agent 宣布的工具调用(广播)。本设备执行层自己捕捉归属自己的工具(shell)。
    if t == "chat.tool.calls" {
        chat::handle_calls(v, &tx).await;
        return;
    }
    // files.*:文件 app
    if t.starts_with("files.") {
        let data = v.get("data").cloned().unwrap_or_else(|| json!({}));
        files::handle(t, data, &tx).await;
        return;
    }
    // status.*:设备状态 app
    if t == "status.request" {
        let data = v.get("data").cloned().unwrap_or_else(|| json!({}));
        status::handle(data, &tx).await;
        return;
    }
    // terminal.*:用户直接操作的长驻 PTY 会话。
    if t.starts_with("terminal.") {
        let data = v.get("data").cloned().unwrap_or_else(|| json!({}));
        terminal::handle(t, data, &tx).await;
        return;
    }
    // 其余(screen./chat. 附件 等)未在此设备实现,忽略。
}
