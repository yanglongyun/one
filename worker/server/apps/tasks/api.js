// tasks REST:
//   GET /api/tasks?status=            列表(可按状态过滤)
//   GET/DELETE /api/tasks/:id         详情 / 删除
//   GET /api/tasks/:id/messages       该 task 自己的对话线,分页
import * as repo from './repository.js';

export default async function tasksApi(request, ctx, { id }) {
    const { db } = ctx;
    const url = new URL(request.url);

    if (!id) {
        if (request.method === 'GET') {
            return Response.json({ tasks: await repo.list(db, { status: url.searchParams.get('status') || '' }) });
        }
    } else {
        const parts = url.pathname.split('/').filter(Boolean); // ['apps','tasks',id,'messages'?]
        if (parts[3] === 'messages' && request.method === 'GET') {
            const beforeId = Number(url.searchParams.get('before')) || 0;
            const limit = Math.min(Number(url.searchParams.get('limit')) || 50, 200);
            const rows = await repo.messages(db, id, { beforeId, limit });
            return Response.json({ messages: rows, hasMore: rows.length === limit });
        }
        if (request.method === 'GET') {
            const task = await repo.get(db, id);
            if (!task) return Response.json({ error: 'not found' }, { status: 404 });
            return Response.json({ task });
        }
        if (request.method === 'DELETE') { await repo.remove(db, id); return Response.json({ ok: true }); }
    }
    return Response.json({ error: 'method not allowed' }, { status: 405 });
}
