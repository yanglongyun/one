// settings REST:GET /api/settings 读配置 · PUT /api/settings 改配置。基于 settings KV。
// 安全视图:不回 apiKey 明文,只给是否已设 + 预览;写入空 apiKey 视为不改。
import { settings, DEFAULTS } from '../../system/settings.js';
import { authHeaders } from '../../system/agent/auth.js';
import { boundedFetch } from '../../system/net/bounded-fetch.js';
import { chatPayload } from '../../system/agent/payload.js';

const EDITABLE = [
    'apiUrl', 'apiKey', 'model', 'authMode', 'recentRawMessages', 'compressThreshold', 'toolResultMaxChars', 'toolMaxRounds',
    'thinkingEnabled', 'reasoningEffort', 'maxOutputTokens',
];
// 不回明文的 key 字段;空写入视为不改
const SECRET = ['apiKey'];

function preview(k) {
    return !k ? '' : (k.length <= 8 ? '已设置' : `${k.slice(0, 4)}····${k.slice(-4)}`);
}

function publicView(all) {
    const view = {};
    for (const key of EDITABLE) if (!SECRET.includes(key)) view[key] = all[key] ?? DEFAULTS[key] ?? '';
    const ak = String(all.apiKey || '');
    view.hasKey = Boolean(ak);
    view.keyPreview = preview(ak);
    return view;
}

function validateUrl(value) {
    const url = new URL(String(value || ''));
    if (url.protocol !== 'https:') throw new Error('模型接口必须使用 HTTPS');
    return url.toString();
}

function boundedInteger(value, min, max, label) {
    const number = Number(value);
    if (!Number.isInteger(number) || number < min || number > max) throw new Error(`${label}必须是 ${min}-${max} 的整数`);
    return String(number);
}

async function testModel(body, all) {
    const apiUrl = validateUrl(body.apiUrl || all.apiUrl);
    const apiKey = String(body.apiKey || all.apiKey || '').trim();
    const model = String(body.model || all.model || '').trim();
    const authMode = (body.authMode || all.authMode) === 'x-api-key' ? 'x-api-key' : 'bearer';
    if (!apiKey || !model) throw new Error('请先填写 API Key 和模型名');
    const payload = chatPayload({
        model,
        messages: [{ role: 'user', content: 'Reply OK.' }],
        stream: false,
        thinkingEnabled: all.thinkingEnabled,
        reasoningEffort: all.reasoningEffort,
        maxOutputTokens: 8,
    });
    const { response, body: text } = await boundedFetch(apiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders(authMode, apiKey) },
        body: JSON.stringify(payload),
    }, { timeoutMs: 15000, maxResponseBytes: 100000, maxRequestBytes: 100000, maxRedirects: 1 });
    const data = (() => { try { return JSON.parse(text); } catch { return {}; } })();
    if (!response.ok) throw new Error(data?.error?.message || `模型接口返回 ${response.status}`);
    if (!Array.isArray(data.choices)) throw new Error('接口响应不是 OpenAI chat/completions 格式');
    return { ok: true, model: data.model || model };
}

export default async function settingsApi(request, ctx, { id } = {}) {
    const s = settings(ctx.db);

    if (request.method === 'GET') return Response.json({ config: publicView(await s.all()) });

    if (id === 'test' && request.method === 'POST') {
        const body = await request.json().catch(() => ({}));
        try { return Response.json(await testModel(body, await s.all())); }
        catch (error) { return Response.json({ ok: false, error: error.message }, { status: 400 }); }
    }

    if (request.method === 'PUT') {
        const body = await request.json().catch(() => ({}));
        for (const key of ['apiUrl']) {
            if (!body[key]) continue;
            try { body[key] = validateUrl(body[key]); }
            catch (error) { return Response.json({ error: error.message }, { status: 400 }); }
        }
        for (const key of ['authMode']) {
            if (body[key] !== undefined && !['bearer', 'x-api-key'].includes(body[key])) {
                return Response.json({ error: '无效认证方式' }, { status: 400 });
            }
        }
        try {
            if (body.compressThreshold !== undefined) body.compressThreshold = boundedInteger(body.compressThreshold, 1000, 2_000_000, '上下文阈值');
            if (body.recentRawMessages !== undefined) body.recentRawMessages = boundedInteger(body.recentRawMessages, 1, 1000, '原文消息数');
            if (body.toolResultMaxChars !== undefined) body.toolResultMaxChars = boundedInteger(body.toolResultMaxChars, 1000, 200000, '工具结果长度');
            if (body.toolMaxRounds !== undefined) body.toolMaxRounds = boundedInteger(body.toolMaxRounds, 1, 500, '工具循环数');
            if (body.maxOutputTokens !== undefined && String(body.maxOutputTokens).trim()) {
                body.maxOutputTokens = boundedInteger(body.maxOutputTokens, 1, 384000, '最大输出');
            }
            if (body.reasoningEffort !== undefined && !['', 'low', 'medium', 'high', 'max'].includes(String(body.reasoningEffort))) {
                throw new Error('无效思考强度');
            }
        } catch (error) {
            return Response.json({ error: error.message }, { status: 400 });
        }
        if (body.clearApiKey === true) await s.set('apiKey', '');
        for (const key of EDITABLE) {
            if (!(key in body)) continue;
            if (SECRET.includes(key) && !String(body[key]).trim()) continue; // 空 = 不改
            await s.set(key, body[key]);
        }
        return Response.json({ config: publicView(await s.all()) });
    }
    return Response.json({ error: 'method not allowed' }, { status: 405 });
}
