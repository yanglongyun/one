// 自定义应用的运行时服务(裸页面,SPA 壳经 iframe 装它):
//   GET /api/apps/<slug>/runtime           → index.html 最新版(自动注入 <base> + /api/apps/sdk.js)
//   GET /api/apps/<slug>/runtime/index.js  → 最新 JS
//   GET /api/apps/<slug>/runtime/index.css → 最新 CSS
//   GET /api/apps/<slug>/runtime/index.sql → 建表 DDL(SDK 打开应用时先逐条跑它建表,再加载 index.js)
//   GET /api/apps/sdk.js                   → window.one SDK(sql/proxy/llm/vision/agent 五个方法)
// 页面本身不鉴权(单用户;能力桥调用才需要 token,SDK 自动从 localStorage 带)。
import * as repo from './repository.js';

const TYPES = { 'index.html': 'text/html; charset=utf-8', 'index.js': 'text/javascript; charset=utf-8', 'index.css': 'text/css; charset=utf-8', 'index.sql': 'text/plain; charset=utf-8' };

// 只允许同源(主 SPA)把应用装进 iframe,挡掉外站框套 → 防点击劫持。
const FRAME_GUARD = { 'X-Frame-Options': 'SAMEORIGIN' };

const escapeHtml = (s) => String(s ?? '').replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

export async function serveApp(db, pathname) {
    const parts = pathname.split('/').filter(Boolean); // ['api', 'apps', slug, 'runtime', file?]
    const slug = parts[2];
    const file = parts[4] || 'index.html';
    if (!slug || !TYPES[file]) return new Response('not found', { status: 404 });

    const app = await repo.bySlug(db, slug);
    if (!app) return new Response('app not found', { status: 404 });
    const row = await repo.latestFile(db, app.id, file);
    if (!row) return new Response(file === 'index.html' ? emptyShell(app) : '', {
        headers: { 'Content-Type': TYPES[file], 'Cache-Control': 'no-cache', ...FRAME_GUARD },
    });

    let content = row.content;
    if (file === 'index.html') content = injectSdk(injectBase(stripAppScript(content), slug));
    return new Response(content, { headers: { 'Content-Type': TYPES[file], 'Cache-Control': 'no-cache', ...FRAME_GUARD } });
}

// 注入 <base>:无论访问 runtime 还是 runtime/,相对引用(./index.css)都解析到应用目录下
function injectBase(html, slug) {
    if (/<base\s/i.test(html)) return html;
    const tag = `<base href="/api/apps/${slug}/runtime/">`;
    if (/<head[^>]*>/i.test(html)) return html.replace(/<head[^>]*>/i, (m) => `${m}\n${tag}`);
    return tag + '\n' + html;
}

// 剥离应用自带的 <script src="./index.js">:平台改由 SDK 在跑完 index.sql(建表)后再加载它,
// 保证「建表 → 主脚本」顺序。应用只管写 index.html(引 index.css)+ index.js + index.sql,不必自己引 index.js。
function stripAppScript(html) {
    return html.replace(/<script\b[^>]*\bsrc\s*=\s*["']\.?\/?index\.js["'][^>]*>\s*<\/script>/gi, '');
}

// index.html 里没引 SDK 就注入(容错 AI 忘写);css 由 AI 自己在 html 里引用 ./index.css
function injectSdk(html) {
    if (html.includes('/api/apps/sdk.js')) return html;
    const tag = '<script src="/api/apps/sdk.js"></script>';
    if (/<head[^>]*>/i.test(html)) return html.replace(/<head[^>]*>/i, (m) => `${m}\n${tag}`);
    return tag + '\n' + html;
}

function emptyShell(app) {
    const name = escapeHtml(app.name);
    return `<!DOCTYPE html><html lang="zh-CN"><head><meta charset="UTF-8"><title>${name}</title></head>
<body style="font-family:system-ui;display:grid;place-items:center;height:100vh;margin:0;color:#54688a">
<div>「${name}」还没有界面 —— 让 one 用 app_update 写入 index.html。</div></body></html>`;
}

// window.one —— 应用前端的全部能力面。
export const SDK_SOURCE = `// one SDK · window.one —— 自定义应用的能力面:sql / proxy / llm / vision / agent
(() => {
    const token = () => { try { return localStorage.getItem('one_token') || ''; } catch { return ''; } };

    async function call(method, body) {
        const res = await fetch('/api/apps/bridge/' + method, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token() },
            body: JSON.stringify(body || {}),
        });
        const json = await res.json().catch(() => ({ error: 'bad response' }));
        if (json.error) throw new Error(json.error);
        return json;
    }

    async function getTask(id) {
        const res = await fetch('/api/tasks/' + id, { headers: { Authorization: 'Bearer ' + token() } });
        const json = await res.json().catch(() => ({}));
        return json.task || null;
    }

    // summary 是纯文本;约定了 responseFormat 时通常是 JSON,尝试顺手解析好挂在 .json 上,失败就不挂(不抛错)
    function attachJson(task) {
        if (task && typeof task.summary === 'string') {
            try { task.json = JSON.parse(task.summary); } catch { /* 不是 JSON 就算了,summary 原样还在 */ }
        }
        return task;
    }

    const toDataUrl = (img) => new Promise((resolve, reject) => {
        if (typeof img === 'string') return resolve(img);
        const r = new FileReader();
        r.onload = () => resolve(r.result);
        r.onerror = reject;
        r.readAsDataURL(img);
    });

    window.one = {
        // SQL 直达 D1。SELECT 返回行数组;其余返回 {ok, changes, lastRowId}
        async sql(query, params) {
            const r = await call('sql', { query, params });
            return 'rows' in r ? r.rows : r;
        },
        // 服务端代发请求(免跨域)。返回 {status, headers, body(文本)}
        proxy(url, opts) { return call('proxy', { url, ...(opts || {}) }); },
        // 主模型一次性推理,返回文本
        async llm(prompt, opts) { return (await call('llm', { prompt, ...(opts || {}) })).text; },
        // 视觉模型看图(dataURL / Blob / File),返回文本
        async vision(image, prompt) {
            return (await call('vision', { image: await toDataUrl(image), prompt })).text;
        },
        // 开一个任务走系统 agent 内核(与主对话同一个大脑),默认等它跑完并返回任务对象
        // opts: {title, wait=true, interval=2000, timeout=300000, responseFormat}
        //   responseFormat 走 OpenAI 兼容 response_format(如 {type:'json_object'}):
        //   任务最终回复会被约束成合法 JSON,写进返回对象的 summary;能解析时额外挂一份到 .json 上,免得每个应用重复解析。
        async agent(prompt, opts = {}) {
            const app = location.pathname.split('/').filter(Boolean)[2] || '';
            const { taskId } = await call('agent', { prompt, title: opts.title, app, responseFormat: opts.responseFormat });
            if (opts.wait === false) return { taskId };
            const deadline = Date.now() + (opts.timeout || 300000);
            for (;;) {
                await new Promise((r) => setTimeout(r, opts.interval || 2000));
                const task = await getTask(taskId);
                if (task && ['done', 'failed', 'aborted'].includes(task.status)) return attachJson(task);
                if (Date.now() > deadline) return attachJson({ ...(task || {}), taskId, timeout: true });
            }
        },
    };

    // ── 平台引导:先按 index.sql 建表(逐条幂等、单条失败不影响后续),再加载应用主脚本 index.js ──
    // 应用只需在同目录放一个 index.sql 声明表结构(不放也行,空则跳过);相对地址经 <base> 解析到本应用目录。
    (async () => {
        try {
            const res = await fetch('index.sql', { cache: 'no-store' });
            if (res.ok) {
                const ddl = (await res.text()).trim();
                for (const raw of ddl.split(';')) {
                    const stmt = raw.trim();
                    if (!stmt) continue;
                    if (!stmt.replace(/--[^\\n]*/g, '').trim()) continue; // 整段只剩注释就跳过
                    try { await window.one.sql(stmt); } catch (e) { console.warn('[one] 建表语句失败(已跳过):', e.message); }
                }
            }
        } catch (e) { console.warn('[one] index.sql 处理跳过:', e.message); }
        const boot = () => { const el = document.createElement('script'); el.src = 'index.js'; document.body.appendChild(el); };
        if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
    })();
})();
`;
