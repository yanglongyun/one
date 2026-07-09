// apps —— 业务层。一个 app 一文件,事件以 app 名为前缀(files.* / status.* / terminal.*)。
// shell 归 chat(它是 agent 在对话里用的工具);terminal 是用户直接操作的长驻 PTY。
pub mod chat;
pub mod computer;
pub mod files;
pub mod status;
pub mod terminal;
