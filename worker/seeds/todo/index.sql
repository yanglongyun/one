-- 待办小应用数据表(平台打开应用时自动执行,幂等)
CREATE TABLE IF NOT EXISTS app_todo (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  text TEXT NOT NULL DEFAULT '',
  done INTEGER NOT NULL DEFAULT 0,
  parent_id INTEGER,
  created_at INTEGER NOT NULL,
  done_at INTEGER
);
-- 老库补列:新装的会因 parent_id 已存在而报错,平台逐条容错跳过
ALTER TABLE app_todo ADD COLUMN parent_id INTEGER;
