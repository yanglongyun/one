import * as repo from './repository.js';

const readLimit = (url, fallback = 50) => Math.max(1, Math.min(200, Number(url.searchParams.get('limit')) || fallback));

export default async function notesApi(request, ctx, { id }) {
    const { db } = ctx;
    const url = new URL(request.url);
    const now = Date.now();

    try {
        if (!id) {
            if (request.method === 'GET') {
                return Response.json(await repo.list(db, {
                    limit: readLimit(url),
                    cursor: url.searchParams.get('cursor') || '',
                }));
            }
            if (request.method === 'POST') {
                const body = await request.json().catch(() => ({}));
                const note = await repo.create(db, body, now);
                await ctx.hub.notifyWeb({ type: 'notes.changed' });
                return Response.json({ note });
            }
        } else {
            if (request.method === 'GET') return Response.json({ note: await repo.get(db, id) });
            if (request.method === 'PUT') {
                const body = await request.json().catch(() => ({}));
                const note = await repo.update(db, id, body, now);
                await ctx.hub.notifyWeb({ type: 'notes.changed' });
                return Response.json({ note });
            }
            if (request.method === 'DELETE') {
                await repo.remove(db, id);
                await ctx.hub.notifyWeb({ type: 'notes.changed' });
                return Response.json({ ok: true });
            }
        }
    } catch (err) {
        return Response.json({ error: err.message || String(err) }, { status: 400 });
    }

    return Response.json({ error: 'method not allowed' }, { status: 405 });
}
