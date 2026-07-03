// chats REST:
//   GET    /api/chats        会话列表(置顶在前,按更新时间排)
//   POST   /api/chats        新建 {title?}
//   PUT    /api/chats/:id    改标题 / 置顶 {title?, pinned?}
//   DELETE /api/chats/:id    删除(连同消息与压缩记录)
import * as repo from './repository.js';

export default async function chatsApi(request, ctx, { id }) {
    const { db } = ctx;
    if (!id) {
        if (request.method === 'GET') return Response.json({ chats: await repo.list(db) });
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
        if (request.method === 'DELETE') { await repo.remove(db, id); return Response.json({ ok: true }); }
    }
    return Response.json({ error: 'method not allowed' }, { status: 405 });
}
