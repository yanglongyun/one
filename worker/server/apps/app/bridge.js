// 能力桥:自定义应用前端(/apps/<slug>)经 window.one SDK 调这里。
// 五个方法,与产品约定一一对应:
//   POST /api/apps/bridge/sql    {query, params?}          → D1 直接执行(单用户产品,能力全开)
//   POST /api/apps/bridge/proxy  {url, method?, headers?, body?} → 服务端代发外部请求,解决跨域
//   POST /api/apps/bridge/llm    {prompt, system?}         → 主模型一次性推理,返回文本
//   POST /api/apps/bridge/vision {image, prompt?}          → 视觉模型看图(走设置里的视觉配置)
//   POST /api/apps/bridge/agent  {prompt, title?, app?, responseFormat?} → 开一个 task 走系统 agent 内核,返回 taskId
//                                                       responseFormat 走 OpenAI 兼容(如 {type:'json_object'}),约束任务最终回复必须是合法 JSON
//                                                       (结果由 SDK 轮询 /api/tasks/:id 取)
import { settings } from '../../system/settings.js';
import { authHeaders } from '../../system/agent/auth.js';
import * as vision from '../../system/tools/vision.js';

const HANDLERS = {
    async sql(body, ctx) {
        const q = String(body.query || '').trim();
        if (!q) return { error: '空查询' };
        const params = Array.isArray(body.params) ? body.params : [];
        try {
            const stmt = ctx.db.prepare(q).bind(...params);
            if (/^(select|with|pragma)\b/i.test(q)) {
                const { results } = await stmt.all();
                return { rows: results, count: results.length };
            }
            const r = await stmt.run();
            return { ok: true, changes: r.meta?.changes ?? 0, lastRowId: Number(r.meta?.last_row_id) || 0 };
        } catch (err) {
            return { error: err.message || String(err) };
        }
    },

    async proxy(body) {
        const url = String(body.url || '');
        if (!/^https?:\/\//i.test(url)) return { error: 'url 必须是 http(s)' };
        try {
            const res = await fetch(url, {
                method: String(body.method || 'GET').toUpperCase(),
                headers: body.headers && typeof body.headers === 'object' ? body.headers : undefined,
                body: body.body != null ? (typeof body.body === 'string' ? body.body : JSON.stringify(body.body)) : undefined,
            });
            const headers = Object.fromEntries(res.headers.entries());
            return { status: res.status, headers, body: await res.text() };
        } catch (err) {
            return { error: err.message || String(err) };
        }
    },

    async llm(body, ctx) {
        const prompt = String(body.prompt || '').trim();
        if (!prompt) return { error: '缺 prompt' };
        const c = await settings(ctx.db).all();
        if (!c.apiUrl || !c.apiKey || !c.model) return { error: '主模型未配置' };
        const messages = [];
        if (body.system) messages.push({ role: 'system', content: String(body.system) });
        messages.push({ role: 'user', content: prompt });
        try {
            const res = await fetch(c.apiUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', ...authHeaders(c.authMode || 'bearer', c.apiKey) },
                body: JSON.stringify({ model: c.model, messages }),
            });
            if (!res.ok) return { error: `LLM ${res.status}: ${(await res.text()).slice(0, 300)}` };
            const json = await res.json();
            return { text: json.choices?.[0]?.message?.content || '' };
        } catch (err) {
            return { error: err.message || String(err) };
        }
    },

    async vision(body, ctx) {
        const image = String(body.image || '');
        if (!image.startsWith('data:image/')) return { error: 'image 需为 dataURL(data:image/…)' };
        const c = await settings(ctx.db).all();
        const cfg = c.visionEnabled
            ? { apiUrl: c.apiUrl, apiKey: c.apiKey, model: c.model, authMode: c.authMode || 'bearer' }
            : { apiUrl: c.visionApiUrl, apiKey: c.visionApiKey, model: c.visionModel, authMode: c.visionAuthMode || 'bearer' };
        if (!cfg.apiUrl || !cfg.apiKey || !cfg.model) return { error: '视觉模型未配置(设置 → 视觉能力)' };
        try {
            return { text: await vision.describe(cfg, image, String(body.prompt || '描述这张图片。')) };
        } catch (err) {
            return { error: err.message || String(err) };
        }
    },

    async agent(body, ctx) {
        const prompt = String(body.prompt || '').trim();
        if (!prompt) return { error: '缺 prompt' };
        const stub = ctx.env.HUB.get(ctx.env.HUB.idFromName('one'));
        const taskId = await stub.spawnTask({
            title: body.title,
            prompt,
            origin: 'app',
            originId: body.app ? String(body.app) : null,
            responseFormat: body.responseFormat && typeof body.responseFormat === 'object' ? body.responseFormat : null,
        });
        return { taskId, status: 'started' };
    },
};

export default async function bridgeApi(request, ctx, { id: method }) {
    if (request.method !== 'POST') return Response.json({ error: 'method not allowed' }, { status: 405 });
    const handler = HANDLERS[method];
    if (!handler) return Response.json({ error: `unknown bridge method: ${method}` }, { status: 404 });
    const body = await request.json().catch(() => ({}));
    return Response.json(await handler(body, ctx));
}
