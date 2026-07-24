-- one 云端库(D1)。单用户 · 单设备:整库即这个用户的数据,无 account_id。
-- 设备配对信息存进 settings(单设备),不再有 devices 表。

-- ═══════════ 设置(全局 KV)═══════════
-- pass_hash + 模型配置(apiUrl/model/apiKey…)
-- + 单设备配对:device_name / device_secret_hash / device_capabilities
CREATE TABLE settings (
  key   TEXT PRIMARY KEY,
  value TEXT NOT NULL DEFAULT ''
);

-- ═══════════ 任务(执行单元,可并行跑)═══════════
CREATE TABLE tasks (
  id           TEXT PRIMARY KEY,
  title        TEXT NOT NULL DEFAULT '',
  prompt       TEXT NOT NULL DEFAULT '',
  status       TEXT NOT NULL DEFAULT 'pending',  -- pending/running/done/failed/aborted/cancelled
  origin       TEXT NOT NULL DEFAULT 'ai',
  origin_id    TEXT,
  response_format TEXT,                          -- 可选:要求最终回复走 OpenAI 兼容 response_format(如 {"type":"json_object"})
  summary      TEXT NOT NULL DEFAULT '',
  created_at   INTEGER NOT NULL,
  started_at   INTEGER,
  finished_at  INTEGER,
  lease_until  INTEGER,
  attempts     INTEGER NOT NULL DEFAULT 0,
  last_error   TEXT NOT NULL DEFAULT ''
);
CREATE INDEX idx_tasks_status ON tasks(status, id DESC);
CREATE INDEX idx_tasks_origin ON tasks(origin, origin_id);
CREATE INDEX idx_tasks_recovery ON tasks(status, lease_until, attempts);

-- ═══════════ 会话(多会话,可置顶;消息经 thread_id 挂在会话或任务下)═══════════
CREATE TABLE chats (
  id          TEXT PRIMARY KEY,
  title       TEXT NOT NULL DEFAULT '',
  pinned      INTEGER NOT NULL DEFAULT 0,
  created_at  INTEGER NOT NULL,
  updated_at  INTEGER NOT NULL
);
CREATE INDEX idx_chats_order ON chats(pinned DESC, updated_at DESC);

-- ═══════════ 消息(会话与任务共用一张表,thread_id = chats.id 或 tasks.id)═══════════
CREATE TABLE messages (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  thread_id   TEXT,                       -- chats.id(会话)或 tasks.id(任务线);删除方负责级联清理
  role        TEXT NOT NULL,               -- user / assistant / tool
  body        TEXT NOT NULL,               -- 消息 JSON(含 tool_calls / 结果)
  meta        TEXT NOT NULL DEFAULT '{}',
  usage       TEXT NOT NULL DEFAULT '{}',
  client_id   TEXT,
  created_at  INTEGER NOT NULL
);
CREATE INDEX idx_messages_thread ON messages(thread_id, id);
CREATE UNIQUE INDEX idx_messages_client ON messages(thread_id, client_id) WHERE client_id IS NOT NULL;

CREATE TABLE compactions (
  id               INTEGER PRIMARY KEY AUTOINCREMENT,
  thread_id        TEXT,                  -- 同 messages.thread_id
  start_message_id INTEGER NOT NULL,
  end_message_id   INTEGER NOT NULL,
  summary          TEXT NOT NULL,
  tokens           INTEGER NOT NULL DEFAULT 0,
  created_at       INTEGER NOT NULL
);
CREATE INDEX idx_compactions_thread ON compactions(thread_id, id);

-- ═══════════ 记忆(长期用户上下文;时间线走呈现层,created_at/updated_at 已够排)═══════════
CREATE TABLE memories (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  title       TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  body        TEXT NOT NULL DEFAULT '',
  visibility  TEXT NOT NULL DEFAULT 'stored', -- must/star/stored
  created_at  INTEGER NOT NULL,
  updated_at  INTEGER NOT NULL
);
CREATE INDEX idx_memories_visibility ON memories(visibility, id DESC);

-- ═══════════ 笔记(首行即标题;置顶在前)═══════════
CREATE TABLE notes (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  content    TEXT NOT NULL,
  color      TEXT NOT NULL DEFAULT 'yellow',   -- 便签纸色:yellow/blue/green/pink/purple/slate/plain
  pinned     INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);
CREATE INDEX idx_notes_list ON notes(pinned DESC, id DESC);
