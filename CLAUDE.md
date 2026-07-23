# AGENTS.md

给自动化 agent(Claude Code / Cursor / Copilot 等)的项目说明 —— 帮用户**部署**和**改**这个项目时读它。人类请看 [README.md](README.md) 与 [CONTRIBUTING.md](CONTRIBUTING.md)。

## 这是什么

**one** —— 云端常驻的个人 AI:大脑跑在 Cloudflare(Worker + D1 + Durable Objects),客户端(网页 / 桌面 / 安卓 / 浏览器扩展)是它连上来的「手」。用户对它说一句话,它在用户的设备上把活干完。

## 结构

```
worker/              云核(部署到 Cloudflare)
  server/            后端:AI 内核 + apps(云端数据应用)+ 鉴权 + D1
  ui/                前端(Vue 3),构建产物在 ui/dist
  schema.sql         数据库全量结构 —— 唯一真相,无迁移脚本
  wrangler.jsonc     部署配置(已 gitignore;从 wrangler.example.jsonc 复制)
clients/
  tauri/             桌面(Rust + WebView),含电脑控制「手」
  android/           安卓(Kotlin,WebView + 无障碍「手」)
  browser/           Chrome MV3 扩展(chrome.debugger「手」)
```

## 帮用户部署(最常见任务)

前提:一个 Cloudflare 账户、Node 18+。全程在 `worker/` 目录下:

```bash
npx wrangler login                                   # 未登录先登录

cd worker && npm install && npm --prefix ui install  # 顺带装前端依赖(部署会构建 ui/)
cp wrangler.example.jsonc wrangler.jsonc             # 待填 account_id / database_id

npx wrangler d1 create one                           # 把输出的 database_id 连同 account_id 填进 wrangler.jsonc
npx wrangler r2 bucket create one                    # 创建安装包下载桶
npx wrangler d1 execute one --remote --file=schema.sql

npx wrangler secret put AUTH_SECRET                  # 必填:值用 `openssl rand -hex 32` 生成

npm run deploy
```

部署完:打开输出的地址 → 设一个访问密码 → 进「设置」填模型(见下)→ 想让 AI 动手就连一只「手」(`clients/` 下各端,填同一个地址 + 密码即可上线)。

- 不绑自定义域名:删掉 `wrangler.jsonc` 里的 `routes`,直接用 `*.workers.dev` 地址。
- `AUTH_SECRET` 是**必填**的:没配 worker 会拒签/拒验令牌(fail-closed),这是刻意的安全默认,不要为省事去掉。

## 模型配置(部署后在网页「设置」里填)

- **主模型**:填写 OpenAI chat/completions 协议的完整地址、API Key、模型名和认证头。`authMode` 只决定使用 `Authorization: Bearer` 还是 `x-api-key`；上游必须返回 OpenAI 格式的流式响应。

## 改代码的硬约定(别踩)

- **不写兼容层**:协议、字段或工具名变更时同步修改所有生产端并发布新版本；只保留唯一现行实现。禁止旧名称别名、双路径、历史字段兜底和按版本分支，旧客户端直接淘汰并要求升级。
- **机密绝不入库**:`wrangler.jsonc` / `.dev.vars` / `config.json` / 数据库备份 / 任何 key 都已 gitignore,别绕过。`AUTH_SECRET` 只走 `wrangler secret`。
- **数据库无迁移**:`worker/schema.sql` 是唯一真相,改表结构就直接改它,不写迁移脚本。升级前用 `npm run db:backup` 导出备份。
- **AI 自建表用 `data_` 前缀**:`sql` 工具可读平台数据、可建表读写自己的 `data_*` 表;平台系统表对 AI 只读,只能经前端 REST 业务接口修改,别放宽这个边界。
- **路由**:后端能力全在 `/api/*`;`wrangler.jsonc` 的 `run_worker_first` 就是 `["/api/*"]`,其余路径交给前端 SPA。
- **风格随上下文**:注释以简体中文为主,命名/习惯向周围代码看齐;一次改动小而聚焦。

## 客户端构建

- 桌面:`cd clients/tauri && npx tauri build`(需当前平台的构建工具链;`frontendDist` 是本地 `web/`,改完要重新打包才生效)。
- 浏览器扩展:`chrome://extensions` → 开发者模式 → 加载 `clients/browser/`。
- 安卓:见 [clients/android/README.md](clients/android/README.md)。
