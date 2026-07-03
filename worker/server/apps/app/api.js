// 自定义应用 REST:
//   GET    /api/apps                    应用列表(九宫格派生)
//   POST   /api/apps                    建/改元信息 {slug,name,icon,color,description}
//   GET    /api/apps/:slug              元信息详情
//   DELETE /api/apps/:slug              删应用(连同全部代码版本;数据表由 AI 用 sql 自行清理)
import * as repo from './repository.js';

const RESERVED_SLUGS = new Set(['bridge', 'new']);

export default async function appApi(request, ctx, { id: slug }) {
    const { db } = ctx;

    if (!slug) {
        if (request.method === 'GET') return Response.json({ apps: await repo.list(db) });
        if (request.method === 'POST') {
            const body = await request.json().catch(() => ({}));
            const s = String(body.slug || '').trim().toLowerCase();
            if (!/^[a-z0-9][a-z0-9-]{0,40}$/.test(s)) return Response.json({ error: 'slug 需为小写字母/数字/连字符' }, { status: 400 });
            if (RESERVED_SLUGS.has(s)) return Response.json({ error: 'slug 是系统保留字' }, { status: 400 });
            return Response.json({ app: await repo.upsert(db, { ...body, slug: s }) });
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
        return Response.json({ ok: true });
    }
    return Response.json({ error: 'method not allowed' }, { status: 405 });
}
