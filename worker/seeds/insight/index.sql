-- 启示小应用数据表(平台打开应用时自动执行,幂等)
CREATE TABLE IF NOT EXISTS app_insight (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  day TEXT NOT NULL,
  content TEXT NOT NULL DEFAULT '',
  created_at INTEGER NOT NULL
);
