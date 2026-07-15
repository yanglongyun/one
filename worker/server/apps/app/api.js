// 自定义应用 REST:
//   GET    /api/apps                    应用列表(九宫格派生)
//   POST   /api/apps                    建/改应用 {slug,name,icon,color,description,files?}
//   GET    /api/apps/:slug              元信息详情
//   DELETE /api/apps/:slug              删应用(连同全部代码版本;app_* 数据表按需另行清理)
import * as repo from './repository.js';

export default async function appApi(request, ctx, { id: slug }) {
    const { db } = ctx;

    if (!slug) {
        if (request.method === 'GET') return Response.json({ apps: await repo.list(db) });
        if (request.method === 'POST') {
            const body = await request.json().catch(() => ({}));
            try {
                const input = repo.normalizeInput(body);
                const app = await repo.upsert(db, input);
                const files = await repo.writeFiles(db, app.id, input.files);
                await ctx.hub.notifyWeb({ type: 'apps.changed' });
                return Response.json({ app, files });
            } catch (error) {
                return Response.json({ error: error.message }, { status: 400 });
            }
        }
        return Response.json({ error: 'method not allowed' }, { status: 405 });
    }

    const app = await repo.bySlug(db, slug);
    if (!app) return Response.json({ error: 'not found' }, { status: 404 });

    if (request.method === 'GET') {
        return Response.json({ app });
    }
    if (request.method === 'DELETE') {
        await repo.remove(db, slug);
        await ctx.hub.notifyWeb({ type: 'apps.changed' });
        return Response.json({ ok: true });
    }
    return Response.json({ error: 'method not allowed' }, { status: 405 });
}
