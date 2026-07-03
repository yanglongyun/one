// schedules REST:日程定义 CRUD。到点触发(cron 扫描)不在这 —— 见 system/realtime/hub.js#checkSchedules
// + server/index.js 的 scheduled handler,触发后向 tasks 插一行(origin=schedule)。
import * as repo from './repository.js';

export default async function schedulesApi(request, ctx, { id }) {
    const { db } = ctx;
    const now = Date.now();

    if (!id) {
        if (request.method === 'GET') return Response.json({ schedules: await repo.list(db) });
        if (request.method === 'POST') {
            const body = await request.json().catch(() => ({}));
            if (body.kind === 'once' && !Number(body.run_at)) return Response.json({ error: 'run_at required' }, { status: 400 });
            return Response.json({ schedule: await repo.create(db, body, now) });
        }
    } else {
        if (request.method === 'GET') {
            const schedule = await repo.get(db, id);
            if (!schedule) return Response.json({ error: 'not found' }, { status: 404 });
            return Response.json({ schedule });
        }
        if (request.method === 'PUT') {
            const body = await request.json().catch(() => ({}));
            if (body.kind === 'once' && !Number(body.run_at)) return Response.json({ error: 'run_at required' }, { status: 400 });
            return Response.json({ schedule: await repo.update(db, id, body, now) });
        }
        if (request.method === 'DELETE') { await repo.remove(db, id); return Response.json({ ok: true }); }
    }
    return Response.json({ error: 'method not allowed' }, { status: 405 });
}
