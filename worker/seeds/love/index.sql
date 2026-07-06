-- 恋爱小应用数据表(平台打开应用时自动执行,幂等)
CREATE TABLE IF NOT EXISTS app_love_config (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  name TEXT NOT NULL DEFAULT '',
  persona TEXT NOT NULL DEFAULT '',
  created_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS app_love_msgs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  role TEXT NOT NULL,
  content TEXT NOT NULL DEFAULT '',
  at INTEGER NOT NULL
);
