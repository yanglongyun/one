// goals REST:目标定义 CRUD。推进逻辑不在这 —— system/realtime 按 next_run_at 向 tasks 插行前进,
// 或用户给目标配一条 schedule 定期推进,目标表本身只存"是什么、到哪一步了"。
import * as repo from './repository.js';

export default async function goalsApi(request, ctx, { id }) {
    const { db } = ctx;
    const now = Date.now();

    if (!id) {
        if (request.method === 'GET') {
            const url = new URL(request.url);
            const limit = Math.min(100, Math.max(1, Number(url.searchParams.get('limit')) || 50));
            const rows = await repo.list(db, { cursor: url.searchParams.get('cursor') || '', limit });
            const hasMore = rows.length > limit;
            const goals = hasMore ? rows.slice(0, limit) : rows;
            const last = goals.at(-1);
            return Response.json({ goals, nextCursor: hasMore && last ? `${last.created_at}.${last.id}` : null });
        }
        if (request.method === 'POST') {
            const body = await request.json().catch(() => ({}));
            const goal = await repo.create(db, body, now);
            await ctx.hub.reconcileAlarm();
            await ctx.hub.notifyWeb({ type: 'goals.changed' });
            return Response.json({ goal });
        }
    } else {
        if (request.method === 'GET') {
            const goal = await repo.get(db, id);
            if (!goal) return Response.json({ error: 'not found' }, { status: 404 });
            return Response.json({ goal });
        }
        if (request.method === 'PUT') {
            const body = await request.json().catch(() => ({}));
            const goal = await repo.update(db, id, body, now);
            await ctx.hub.reconcileAlarm();
            await ctx.hub.notifyWeb({ type: 'goals.changed' });
            return Response.json({ goal });
        }
        if (request.method === 'DELETE') {
            await repo.remove(db, id);
            await ctx.hub.reconcileAlarm();
            await ctx.hub.notifyWeb({ type: 'goals.changed' });
            return Response.json({ ok: true });
        }
    }
    return Response.json({ error: 'method not allowed' }, { status: 405 });
}
