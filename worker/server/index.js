// Worker 入口:后端能力全部收进 /api,其它路径交给前端 SPA。
//   /api/identity/...           → 身份/初始化
//   /api/realtime/ws            → 实时通道(WS)
//   /api/...                    → 云端数据应用 REST
//   /api/apps/:slug/runtime/... → 自定义应用运行资源
//   /api/apps/sdk.js            → 自定义应用 SDK
//   其余                        → 前端静态资源(ui/dist)
import appsRoutes from './apps/index.js';
import { serveApp, SDK_SOURCE } from './apps/app/serve.js';
import identityRoutes from './system/identity/api.js';
import { verify } from './system/identity/service.js';
import { releaseManifest, serveDownload } from './system/downloads.js';

export { OneHub } from './system/realtime/hub.js';

// 自鉴权端点(用口令/设备密钥自证,不需要 JWT)
const PUBLIC = new Set([
    '/api/identity/state',
    '/api/identity/setup',
    '/api/identity/login',
    '/api/identity/register-device',
]);

export default {
    async fetch(request, env) {
        const url = new URL(request.url);
        const area = url.pathname.slice(1).split('/')[0];

        if (area !== 'api') {
            // 前端。HTML 永不缓存(带哈希的 js/css 自身 immutable),避免部署后仍吃旧页面。
            const res = await env.ASSETS.fetch(request);
            if (res.headers.get('content-type')?.includes('text/html')) {
                const r = new Response(res.body, res);
                r.headers.set('Cache-Control', 'no-cache');
                // 主控 UI 不该被任何页面框套 → 防点击劫持;并收紧 referer 外泄。
                r.headers.set('X-Frame-Options', 'DENY');
                r.headers.set('Referrer-Policy', 'no-referrer');
                return r;
            }
            return res;
        }

        const parts = url.pathname.split('/').filter(Boolean);
        const resource = parts[1];

        if (resource === 'downloads') {
            if (!parts[2]) return Response.json(await releaseManifest(env));
            return serveDownload(env, parts[2]);
        }

        // 实时:单用户 → 唯一 hub 实例(WS 在 DO 内验 ?token= / ?password=)
        if (resource === 'realtime') {
            return env.HUB.get(env.HUB.idFromName('one')).fetch(request);
        }

        // 自定义应用运行时:/api/apps/<slug>/runtime(页面/js/css)+ /api/apps/sdk.js(能力 SDK)
        if (resource === 'apps' && parts[3] === 'runtime') {
            return serveApp(env.DB, url.pathname);
        }
        if (url.pathname === '/api/apps/sdk.js') {
            return new Response(SDK_SOURCE, { headers: { 'Content-Type': 'text/javascript; charset=utf-8', 'Cache-Control': 'no-cache' } });
        }

        const hub = env.HUB.get(env.HUB.idFromName('one'));
        const ctx = { env, db: env.DB, hub };

        // HTTP 鉴权:统一 Bearer JWT。public 端点放行,其余必须有效 token。
        if (!PUBLIC.has(url.pathname)) {
            const token = (request.headers.get('Authorization') || '').replace(/^Bearer\s+/i, '');
            const payload = await verify(ctx, token);
            if (!payload) return Response.json({ error: 'unauthorized' }, { status: 401 });
            ctx.auth = payload;
        }

        if (resource === 'identity') {
            return identityRoutes(request, ctx, parts[2]);
        }
        return appsRoutes(request, ctx);
    },
};
