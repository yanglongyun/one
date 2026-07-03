// goals REST:目标定义 CRUD。推进逻辑不在这 —— system/realtime 按 next_run_at 向 tasks 插行前进,
// 或用户给目标配一条 schedule 定期推进,目标表本身只存"是什么、到哪一步了"。
import * as repo from './repository.js';

export default async function goalsApi(request, ctx, { id }) {
    const { db } = ctx;
    const now = Date.now();

    if (!id) {
        if (request.method === 'GET') return Response.json({ goals: await repo.list(db) });
        if (request.method === 'POST') {
            const body = await request.json().catch(() => ({}));
            return Response.json({ goal: await repo.create(db, body, now) });
        }
    } else {
        if (request.method === 'GET') {
            const goal = await repo.get(db, id);
            if (!goal) return Response.json({ error: 'not found' }, { status: 404 });
            return Response.json({ goal });
        }
        if (request.method === 'PUT') {
            const body = await request.json().catch(() => ({}));
            return Response.json({ goal: await repo.update(db, id, body, now) });
        }
        if (request.method === 'DELETE') { await repo.remove(db, id); return Response.json({ ok: true }); }
    }
    return Response.json({ error: 'method not allowed' }, { status: 405 });
}
