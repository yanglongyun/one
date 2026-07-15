-- one 云端库(D1)。单用户 · 单设备:整库即这个用户的数据,无 account_id。
-- 设备配对信息存进 settings(单设备),不再有 devices 表。

-- ═══════════ 设置(全局 KV)═══════════
-- pass_hash + 模型配置(apiUrl/model/apiKey…)
-- + 单设备配对:device_name / device_secret_hash / device_capabilities
CREATE TABLE settings (
  key   TEXT PRIMARY KEY,
  value TEXT NOT NULL DEFAULT ''
);

-- ═══════════ 任务(执行单元:ai/schedule/goal/app 四种来源发起,可并行跑)═══════════
CREATE TABLE tasks (
  id           TEXT PRIMARY KEY,
  title        TEXT NOT NULL DEFAULT '',
  prompt       TEXT NOT NULL DEFAULT '',
  status       TEXT NOT NULL DEFAULT 'pending',  -- pending/running/done/failed/aborted/cancelled
  origin       TEXT NOT NULL DEFAULT 'ai',       -- ai/schedule/goal/goal_review/app
  origin_id    TEXT,                             -- 对应 schedules.id 或 goals.id(origin 相应时)
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

-- ═══════════ 日程(定时定义,到点向 tasks 插一行 origin='schedule')═══════════
CREATE TABLE schedules (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  name            TEXT NOT NULL DEFAULT '',
  prompt          TEXT NOT NULL DEFAULT '',
  kind            TEXT NOT NULL DEFAULT 'cron',  -- cron/once
  cron            TEXT NOT NULL DEFAULT '',
  timezone        TEXT NOT NULL DEFAULT 'UTC',
  run_at          INTEGER,
  next_run_at     INTEGER,
  enabled         INTEGER NOT NULL DEFAULT 1,
  last_run_at     INTEGER,
  last_run_minute INTEGER,
  created_at      INTEGER NOT NULL,
  updated_at      INTEGER NOT NULL
);
CREATE INDEX idx_schedules_due ON schedules(enabled, next_run_at);

-- ═══════════ 目标(自调度推进循环:到点开 origin='goal' 任务,系统验收后写回状态与下次时间)═══════════
CREATE TABLE goals (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  title       TEXT NOT NULL DEFAULT '',
  prompt      TEXT NOT NULL DEFAULT '',
  status      TEXT NOT NULL DEFAULT 'active',  -- active/paused/done/abandoned
  next_run_at INTEGER,                         -- 下次推进时间;NULL = 不排
  last_report TEXT NOT NULL DEFAULT '',        -- 最近一次推进的自评
  created_at  INTEGER NOT NULL,
  updated_at  INTEGER NOT NULL
);
CREATE INDEX idx_goals_due ON goals(status, next_run_at);

-- 笔记不再是系统表:已改为「笔记」种子小应用,数据表 app_notes 由该应用运行时自建(见 seeds/notes)。

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

-- ═══════════ 自定义应用(AI 在线创造:纯前端 + 能力桥)═══════════
-- 一个应用 = apps 一行(元信息)+ codes 若干行(index.html/index.js/index.css,按 version 只追加不覆盖)。
-- 应用的数据表由 AI 用 sql 工具自建,表名必须使用 app_ 前缀。
CREATE TABLE apps (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  slug        TEXT NOT NULL UNIQUE,            -- URL 段:/apps/<slug>
  name        TEXT NOT NULL DEFAULT '',
  icon        TEXT NOT NULL DEFAULT '',        -- 单个字符/emoji,九宫格瓷砖上显示
  color       TEXT NOT NULL DEFAULT 'blue',    -- 瓷砖配色键:blue/orange/purple/red/pink/green/teal/slate
  description TEXT NOT NULL DEFAULT '',
  created_at  INTEGER NOT NULL,
  updated_at  INTEGER NOT NULL
);

CREATE TABLE codes (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  app_id     INTEGER NOT NULL REFERENCES apps(id) ON DELETE CASCADE,
  filename   TEXT NOT NULL,                    -- index.html / index.js / index.css / index.sql
  content    TEXT NOT NULL DEFAULT '',
  version    INTEGER NOT NULL DEFAULT 1,       -- 同一 filename 递增,最新版生效;旧版留作回滚
  created_at INTEGER NOT NULL
);
CREATE INDEX idx_codes_latest ON codes(app_id, filename, version DESC);
CREATE UNIQUE INDEX idx_codes_version ON codes(app_id, filename, version);
