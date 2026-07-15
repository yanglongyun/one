// tasks REST:
//   GET /api/tasks?status=            列表(可按状态过滤)
//   GET/DELETE /api/tasks/:id         详情 / 取消
//   GET /api/tasks/:id/messages       该 task 自己的对话线,分页
import * as repo from './repository.js';

export default async function tasksApi(request, ctx, { id }) {
    const { db } = ctx;
    const url = new URL(request.url);

    if (!id) {
        if (request.method === 'GET') {
            const limit = Math.min(Math.max(Number(url.searchParams.get('limit')) || 100, 1), 200);
            const rows = await repo.list(db, {
                status: url.searchParams.get('status') || '', origin: url.searchParams.get('origin') || '',
                originId: url.searchParams.get('origin_id') || '', cursor: url.searchParams.get('cursor') || '', limit: limit + 1,
            });
            const hasMore = rows.length > limit;
            const tasks = hasMore ? rows.slice(0, limit) : rows;
            const last = tasks.at(-1);
            return Response.json({
                tasks,
                counts: await repo.counts(db),
                nextCursor: hasMore && last ? `${last.created_at}.${last.id}` : null,
            });
        }
    } else {
        const parts = url.pathname.split('/').filter(Boolean); // ['api','tasks',id,'messages'?]
        if (parts[3] === 'messages' && request.method === 'GET') {
            const beforeId = Number(url.searchParams.get('before')) || 0;
            const limit = Math.min(Number(url.searchParams.get('limit')) || 50, 200);
            const rows = await repo.messages(db, id, { beforeId, limit: limit + 1 });
            const hasMore = rows.length > limit;
            return Response.json({ messages: hasMore ? rows.slice(1) : rows, hasMore });
        }
        if (request.method === 'GET') {
            const task = await repo.get(db, id);
            if (!task) return Response.json({ error: 'not found' }, { status: 404 });
            return Response.json({ task });
        }
        if (request.method === 'DELETE') {
            const before = await repo.get(db, id);
            if (!before) return Response.json({ error: 'not found' }, { status: 404 });
            const stopped = await ctx.hub.stopThread(id, '任务已取消');
            if (!stopped.stopped) return Response.json({ error: 'agent is still stopping' }, { status: 409 });
            await repo.cancel(db, id);
            if (['goal', 'goal_review'].includes(before.origin) && before.origin_id && ['pending', 'running'].includes(before.status)) {
                await db.prepare(`UPDATE goals SET next_run_at = COALESCE(next_run_at, ?),
                  last_report = '本轮任务被用户取消,稍后继续推进', updated_at = ?
                  WHERE id = ? AND status = 'active'`).bind(Date.now() + 60 * 60 * 1000, Date.now(), before.origin_id).run();
            }
            await ctx.hub.reconcileAlarm();
            const task = await repo.get(db, id);
            await ctx.hub.notifyWeb({ type: 'task.updated', task });
            return Response.json({ ok: true, task });
        }
    }
    return Response.json({ error: 'method not allowed' }, { status: 405 });
}
