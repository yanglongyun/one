// settings REST:GET /api/settings 读配置 · PUT /api/settings 改配置。基于 settings KV。
// 安全视图:不回 apiKey 明文,只给是否已设 + 预览;写入空 apiKey 视为不改。
import { settings, DEFAULTS } from '../../system/settings.js';

const EDITABLE = [
    'apiUrl', 'apiKey', 'model', 'authMode', 'system', 'recentRawMessages', 'compressThreshold', 'toolResultMaxChars', 'toolMaxRounds',
    'visionEnabled', 'visionApiUrl', 'visionApiKey', 'visionModel', 'visionAuthMode',
];
// 不回明文的 key 字段;空写入视为不改
const SECRET = ['apiKey', 'visionApiKey'];

function preview(k) {
    return !k ? '' : (k.length <= 8 ? '已设置' : `${k.slice(0, 4)}····${k.slice(-4)}`);
}

function publicView(all) {
    const view = {};
    for (const key of EDITABLE) if (!SECRET.includes(key)) view[key] = all[key] ?? DEFAULTS[key] ?? '';
    const ak = String(all.apiKey || '');
    view.hasKey = Boolean(ak);
    view.keyPreview = preview(ak);
    const vk = String(all.visionApiKey || '');
    view.hasVisionKey = Boolean(vk);
    view.visionKeyPreview = preview(vk);
    return view;
}

export default async function settingsApi(request, ctx) {
    const s = settings(ctx.db);

    if (request.method === 'GET') return Response.json({ config: publicView(await s.all()) });

    if (request.method === 'PUT') {
        const body = await request.json().catch(() => ({}));
        for (const key of EDITABLE) {
            if (!(key in body)) continue;
            if (SECRET.includes(key) && !String(body[key]).trim()) continue; // 空 = 不改
            await s.set(key, body[key]);
        }
        return Response.json({ config: publicView(await s.all()) });
    }
    return Response.json({ error: 'method not allowed' }, { status: 405 });
}
