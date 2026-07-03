// system —— 基础设施层(与具体业务无关):配置 / 连接 / 派发。
// 与 worker、UI 同一套心智模型:system(底座) + apps(业务),事件一律 app.xxx。
pub mod config;
pub mod connection;
pub mod dispatch;

pub use connection::run;

use serde_json::{json, Value};
use tokio::sync::mpsc;
use tokio_tungstenite::tungstenite::Message;

/// 出口句柄:各 app 经此把消息回推给 worker(再由 worker 转发网页端)。
pub type Tx = mpsc::UnboundedSender<Message>;

/// 原样发一条消息(用于 chat.tool.result 这类扁平结构)。
pub fn send(tx: &Tx, msg: Value) {
    let _ = tx.send(Message::Text(msg.to_string()));
}

/// 发 app 事件:统一 { type, data } 包裹(如 files.result / status.result)。
pub fn send_data(tx: &Tx, typ: &str, data: Value) {
    send(tx, json!({ "type": typ, "data": data }));
}
