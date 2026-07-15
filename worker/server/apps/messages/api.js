// messages REST:会话历史只读分页。发送/流式走 DO(/api/realtime/ws 的 chat.input{threadId=会话id})。
//   GET /api/messages?chat=<会话id>&before=&limit=
import * as repo from './repository.js';

export default async function messagesApi(request, ctx) {
    if (request.method !== 'GET') return Response.json({ error: 'method not allowed' }, { status: 405 });
    const url = new URL(request.url);
    const beforeId = Number(url.searchParams.get('before')) || 0;
    const limit = Math.min(Number(url.searchParams.get('limit')) || 50, 200);
    const chatId = String(url.searchParams.get('chat') || '').trim();
    if (!chatId) return Response.json({ error: 'chat required' }, { status: 400 });
    const rows = await repo.messages(ctx.db, { chatId, beforeId, limit: limit + 1 });
    const hasMore = rows.length > limit;
    return Response.json({ messages: hasMore ? rows.slice(1) : rows, hasMore });
}
