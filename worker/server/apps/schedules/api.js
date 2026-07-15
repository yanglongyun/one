// schedules REST:日程定义 CRUD。到点触发由唯一 OneHub alarm 驱动。
import * as repo from './repository.js';
import { validateScheduleInput } from '../../system/services/schedules.js';

export default async function schedulesApi(request, ctx, { id }) {
    const { db } = ctx;
    const now = Date.now();

    if (!id) {
        if (request.method === 'GET') {
            const url = new URL(request.url);
            const limit = Math.min(100, Math.max(1, Number(url.searchParams.get('limit')) || 50));
            const rows = await repo.list(db, { cursor: url.searchParams.get('cursor') || '', limit });
            const hasMore = rows.length > limit;
            const schedules = hasMore ? rows.slice(0, limit) : rows;
            return Response.json({ schedules, nextCursor: hasMore ? `${schedules.at(-1)?.created_at}.${schedules.at(-1)?.id}` : null });
        }
        if (request.method === 'POST') {
            const body = await request.json().catch(() => ({}));
            try { validateScheduleInput(body, now); } catch (error) { return Response.json({ error: error.message }, { status: 400 }); }
            const schedule = await repo.create(db, body, now);
            await ctx.hub.reconcileAlarm();
            await ctx.hub.notifyWeb({ type: 'schedules.changed' });
            return Response.json({ schedule });
        }
    } else {
        if (request.method === 'GET') {
            const schedule = await repo.get(db, id);
            if (!schedule) return Response.json({ error: 'not found' }, { status: 404 });
            return Response.json({ schedule });
        }
        if (request.method === 'PUT') {
            const body = await request.json().catch(() => ({}));
            const current = await repo.get(db, id);
            if (!current) return Response.json({ error: 'not found' }, { status: 404 });
            try { validateScheduleInput({ ...current, ...body }, now); } catch (error) { return Response.json({ error: error.message }, { status: 400 }); }
            const schedule = await repo.update(db, id, body, now);
            await ctx.hub.reconcileAlarm();
            await ctx.hub.notifyWeb({ type: 'schedules.changed' });
            return Response.json({ schedule });
        }
        if (request.method === 'DELETE') {
            await repo.remove(db, id);
            await ctx.hub.reconcileAlarm();
            await ctx.hub.notifyWeb({ type: 'schedules.changed' });
            return Response.json({ ok: true });
        }
    }
    return Response.json({ error: 'method not allowed' }, { status: 405 });
}
