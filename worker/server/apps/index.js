// api 区路由:标准 REST。/api/<resource>/<id?>,按 HTTP 方法分发。
//   GET /api → 应用清单(前端导航派生)
import { byName, manifest } from './registry.js';

export default async function appsRoutes(request, ctx) {
    const parts = new URL(request.url).pathname.split('/').filter(Boolean); // ['api', app, id?]
    const app = parts[1];
    const id = parts[2];

    if (!app) return Response.json({ apps: manifest() });

    const entry = byName[app];
    if (!entry) return Response.json({ error: `unknown app: ${app}` }, { status: 404 });

    return entry.api(request, ctx, { id });
}
