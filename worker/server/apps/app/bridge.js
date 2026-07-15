// 能力桥:自定义应用前端(/apps/<slug>)经 window.one SDK 调这里。
// 四个方法,与产品约定一一对应:
//   POST /api/apps/bridge/sql    {query, params?}          → 查询数据或写 app_* 小应用表
//   POST /api/apps/bridge/proxy  {url, method?, headers?, body?} → 服务端代发外部请求,解决跨域
//   POST /api/apps/bridge/llm    {prompt, system?}         → 主模型一次性推理,返回文本
//   POST /api/apps/bridge/agent  {prompt, title?, app?, responseFormat?} → 开一个 task 走系统 agent 内核,返回 taskId
//                                                       responseFormat 走 OpenAI 兼容(如 {type:'json_object'}),约束任务最终回复必须是合法 JSON
//                                                       (结果由 SDK 轮询 /api/tasks/:id 取)
import { settings } from '../../system/settings.js';
import { authHeaders } from '../../system/agent/auth.js';
import { boundedFetch } from '../../system/net/bounded-fetch.js';
import { executeSql } from '../../system/services/sql.js';
import { chatPayload } from '../../system/agent/payload.js';

const HANDLERS = {
    async sql(body, ctx) {
        try { return await executeSql(ctx.db, body.query, body.params); }
        catch (err) { return { error: err.message || String(err) }; }
    },

    async proxy(body) {
        const url = String(body.url || '');
        if (!/^https?:\/\//i.test(url)) return { error: 'url 必须是 http(s)' };
        try {
            const { response: res, body: responseBody, truncated } = await boundedFetch(url, {
                method: String(body.method || 'GET').toUpperCase(),
                headers: body.headers && typeof body.headers === 'object' ? body.headers : undefined,
                body: body.body != null ? (typeof body.body === 'string' ? body.body : JSON.stringify(body.body)) : undefined,
            }, { timeoutMs: 15000, maxResponseBytes: 512000, maxRequestBytes: 256000, maxRedirects: 3 });
            const headers = Object.fromEntries(res.headers.entries());
            return { status: res.status, headers, body: responseBody, truncated };
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
            const { response: res, body: text } = await boundedFetch(c.apiUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', ...authHeaders(c.authMode || 'bearer', c.apiKey) },
                body: JSON.stringify(chatPayload({
                    model: c.model,
                    messages,
                    stream: false,
                    thinkingEnabled: c.thinkingEnabled,
                    reasoningEffort: c.reasoningEffort,
                    maxOutputTokens: c.maxOutputTokens,
                })),
            }, { timeoutMs: 60000, maxResponseBytes: 500000, maxRequestBytes: 500000, maxRedirects: 1 });
            if (!res.ok) return { error: `LLM ${res.status}: ${text.slice(0, 300)}` };
            const json = JSON.parse(text);
            return { text: json.choices?.[0]?.message?.content || '' };
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
