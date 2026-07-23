# 参与贡献

欢迎 issue / PR。先读一遍 [README](README.md)(架构)与 [SECURITY.md](SECURITY.md)(信任模型),再动手。

## 仓库结构

```
worker/     云核(Cloudflare):server/(后端)+ ui/(Vue 前端)
clients/    各端的「壳 + 手」:tauri/(桌面)· android/(安卓)· browser/(扩展)
```

## 本地起步

```bash
# 云核
cd worker && npm install
cp wrangler.example.jsonc wrangler.jsonc      # 填 account_id / database_id
echo 'AUTH_SECRET=dev-local-only-change-me-32chars' > .dev.vars   # 本地也必须有密钥
npm run dev                                    # wrangler dev

# 前端(单独调试时)
cd worker/ui && npm install && npm run dev
```

`AUTH_SECRET` 是必填的:未配置时 worker 会拒绝签发/校验令牌(fail closed),这是刻意的安全默认值,不要为图省事去掉。

## 约定

- **风格随上下文**:注释密度、命名、习惯用法都向周围代码看齐;项目注释以简体中文为主。
- **改动小而聚焦**:一个 PR 只做一件事,便于 review。
- **不要提交机密**:`wrangler.jsonc`、`.dev.vars`、`config.json`、数据库备份、任何密钥都已 gitignore,别绕过。
- **数据库无迁移脚本**:`worker/schema.sql` 即全量真相;改表结构时同步更新它。

## 安全问题

请先私下报告(见 [SECURITY.md](SECURITY.md)),不要直接开公开 issue。
