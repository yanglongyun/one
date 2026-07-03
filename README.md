# one

掏出手机或打开网页,给 AI 发一句话,它就在你电脑上干活。

**云端为核心,客户端是壳和手。** 数据全在云端,网页随时访问;桌面 / 安卓 / 浏览器各提供一只「手」,听云端大脑差遣。

```
网页 ─┐
      ├──wss/web──▶  worker(Cloudflare 云核:AI 内核 DO + D1 数据 + 实时中继)
桌面 ─┤                         ▲
安卓 ─┘   各端内嵌的「手」──wss/device──┘
```

## 目录

```
worker/                  云核(部署到 Cloudflare)
├── ui/                  Vue 前端 → 构建成静态资源,由 worker 托管
└── server/             云端后端:AI 内核(DO agent)+ apps + 鉴权 + D1（main 入口 server/index.js）

clients/                 各端的「壳 + 手」
├── tauri/               桌面壳 + 桌面执行器(Rust/Tauri),主动外连 worker
├── android/             安卓壳 + 安卓的手(WebView + 无障碍点击/截图/输入)
└── browser/             浏览器的手 = Chrome 扩展(CDP 桥)
```

## 自定义应用(AI 在线创造)

对 one 说「帮我做一个记账本」,它会用 `sql` 直接写 `apps` + `codes` 两张表,生成一个纯前端应用(index.html/index.js/index.css,存在 `apps` + `codes` 表,代码按版本追加、可回滚),从九宫格或 `/apps/<slug>` 进入(应用本体在 `/api/apps/<slug>/runtime`,由 iframe 装载)。

应用页面里 `window.one`(由 `/api/apps/sdk.js` 提供)有五个能力方法:

| 方法 | 作用 |
|---|---|
| `one.sql(query, params?)` | 直达 D1 读写(应用数据表建议前缀 `app_<slug>_`) |
| `one.proxy(url, opts?)` | 服务端代发外部请求,免跨域 |
| `one.llm(prompt, {system}?)` | 主模型一次性推理,返回文本 |
| `one.vision(image, prompt?)` | 视觉模型看图(dataURL / Blob) |
| `one.agent(prompt, opts?)` | 开一个任务走系统 agent 内核(与主对话同一个大脑),默认等跑完返回任务结果 |

数据库没有迁移脚本:`schema.sql` 即全量真相,升级前用 `npm run db:backup` 导出备份。

## 跑起来

### 云端(worker)

```bash
cd worker && npm install
cp wrangler.example.jsonc wrangler.jsonc        # 填 account_id、database_id
npx wrangler d1 create one                       # 拿到 database_id 填回去
npx wrangler d1 execute one --remote --file=schema.sql
npx wrangler secret put AUTH_SECRET              # openssl rand -hex 32
npm run deploy                                    # 拿到线上 worker 地址
```

### 桌面手(Tauri)

```bash
cd clients/tauri && npm install
npm run tauri:build                               # 产物在 target/release/bundle
```

首启在设置里填 worker 地址 + 设备密钥,桌面这只手便上线待命。

### 安卓手

见 `clients/android/README.md`。

### 浏览器手

见 `clients/browser/README.md`。

## 开源安全说明

这份仓库只保留源码、配置模板和文档。真实部署配置不应该进仓库:

- `worker/wrangler.jsonc` 不包含在开源版本里,请从 `worker/wrangler.example.jsonc` 复制后本地填写。
- `AUTH_SECRET`、访问密码、模型密钥、D1 database_id 等生产值都不要提交。
- 浏览器扩展和各端执行器连上后具备真实操作能力,只连接你自己控制的部署。

## License

MIT
