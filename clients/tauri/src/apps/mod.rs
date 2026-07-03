// apps —— 业务层。一个 app 一文件,事件以 app 名为前缀(files.* / status.*)。
// shell 归 chat(它是 agent 在对话里用的工具);键鼠/截图/上传暂未实现。
pub mod chat;
pub mod computer;
pub mod files;
pub mod status;
