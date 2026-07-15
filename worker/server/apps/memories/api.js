import * as repo from './repository.js';

const readLimit = (url, fallback = 50) => Math.max(1, Math.min(200, Number(url.searchParams.get('limit')) || fallback));

export default async function memoriesApi(request, ctx, { id }) {
    const { db } = ctx;
    const url = new URL(request.url);
    const now = Date.now();

    try {
        if (id === 'search' && request.method === 'GET') {
            return Response.json({
                memories: await repo.search(db, {
                    query: url.searchParams.get('q') || url.searchParams.get('query') || '',
                    limit: readLimit(url, 20),
                }),
            });
        }

        if (!id) {
            if (request.method === 'GET') {
                const limit = readLimit(url);
                const rows = await repo.list(db, {
                    visibility: url.searchParams.get('visibility') || '',
                    limit: limit + 1,
                    cursor: url.searchParams.get('cursor') || '',
                });
                const hasMore = rows.length > limit;
                const memories = hasMore ? rows.slice(0, limit) : rows;
                return Response.json({
                    memories,
                    nextCursor: hasMore ? String(memories.at(-1)?.id || '') : null,
                });
            }
            if (request.method === 'POST') {
                const body = await request.json().catch(() => ({}));
                const memory = await repo.create(db, body, now);
                await ctx.hub.notifyWeb({ type: 'memories.changed' });
                return Response.json({ memory });
            }
        } else {
            if (request.method === 'GET') return Response.json({ memory: await repo.get(db, id) });
            if (request.method === 'PUT') {
                const body = await request.json().catch(() => ({}));
                const memory = await repo.update(db, id, body, now);
                await ctx.hub.notifyWeb({ type: 'memories.changed' });
                return Response.json({ memory });
            }
            if (request.method === 'DELETE') {
                await repo.remove(db, id);
                await ctx.hub.notifyWeb({ type: 'memories.changed' });
                return Response.json({ ok: true });
            }
        }
    } catch (err) {
        return Response.json({ error: err.message || String(err) }, { status: 400 });
    }

    return Response.json({ error: 'method not allowed' }, { status: 405 });
}
