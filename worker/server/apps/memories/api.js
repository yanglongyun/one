import * as repo from './repository.js';

const readLimit = (url, fallback = 200) => Math.max(1, Math.min(500, Number(url.searchParams.get('limit')) || fallback));

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
                return Response.json({
                    memories: await repo.list(db, {
                        visibility: url.searchParams.get('visibility') || '',
                        limit: readLimit(url),
                        offset: Number(url.searchParams.get('offset')) || 0,
                    }),
                });
            }
            if (request.method === 'POST') {
                const body = await request.json().catch(() => ({}));
                return Response.json({ memory: await repo.create(db, body, now) });
            }
        } else {
            if (request.method === 'GET') return Response.json({ memory: await repo.get(db, id) });
            if (request.method === 'PUT') {
                const body = await request.json().catch(() => ({}));
                return Response.json({ memory: await repo.update(db, id, body, now) });
            }
            if (request.method === 'DELETE') {
                await repo.remove(db, id);
                return Response.json({ ok: true });
            }
        }
    } catch (err) {
        return Response.json({ error: err.message || String(err) }, { status: 400 });
    }

    return Response.json({ error: 'method not allowed' }, { status: 405 });
}
