// chats REST:
//   GET    /api/chats        会话列表(置顶在前,按更新时间排)
//   POST   /api/chats        新建 {title?}
//   PUT    /api/chats/:id    改标题 / 置顶 {title?, pinned?}
//   DELETE /api/chats/:id    删除(连同消息与压缩记录)
import * as repo from './repository.js';

export default async function chatsApi(request, ctx, { id }) {
    const { db } = ctx;
    if (!id) {
        if (request.method === 'GET') {
            const url = new URL(request.url);
            const limit = Math.min(Math.max(Number(url.searchParams.get('limit')) || 100, 1), 200);
            const rows = await repo.list(db, { cursor: url.searchParams.get('cursor') || '', limit: limit + 1 });
            const hasMore = rows.length > limit;
            const chats = hasMore ? rows.slice(0, limit) : rows;
            const last = chats.at(-1);
            return Response.json({ chats, nextCursor: hasMore && last ? `${last.pinned}.${last.updated_at}.${last.id}` : null });
        }
        if (request.method === 'POST') {
            const body = await request.json().catch(() => ({}));
            return Response.json({ chat: await repo.create(db, body) });
        }
    } else {
        if (request.method === 'PUT') {
            const body = await request.json().catch(() => ({}));
            const chat = await repo.update(db, id, body);
            return chat ? Response.json({ chat }) : Response.json({ error: 'not found' }, { status: 404 });
        }
        if (request.method === 'DELETE') {
            const stopped = await ctx.hub.stopThread(id, '会话已删除');
            if (!stopped.stopped) return Response.json({ error: 'agent is still stopping' }, { status: 409 });
            await repo.remove(db, id);
            await ctx.hub.notifyWeb({ type: 'chat.deleted', threadId: id });
            await ctx.hub.notifyWeb({ type: 'chats.changed' });
            return Response.json({ ok: true });
        }
    }
    return Response.json({ error: 'method not allowed' }, { status: 405 });
}
