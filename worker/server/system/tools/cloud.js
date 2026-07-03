export async function executeCloudTool(name, args, { hub } = {}) {
    if (name === 'fetch') return fetchTool(args);
    if (name === 'sql') return sqlTool(args, hub);
    return { error: `未知云端工具: ${name}` };
}

async function fetchTool(args) {
    const url = String(args.url || '').trim();
    if (!/^https?:\/\//i.test(url)) return { error: 'url 需以 http(s):// 开头' };
    try {
        const res = await globalThis.fetch(url, {
            method: String(args.method || 'GET').toUpperCase(),
            headers: args.headers && typeof args.headers === 'object' ? args.headers : undefined,
            body: args.body != null ? String(args.body) : undefined,
        });
        let body = await res.text();
        const truncated = body.length > 200000;
        if (truncated) body = body.slice(0, 200000);
        return { status: res.status, contentType: res.headers.get('content-type') || '', body, truncated };
    } catch (err) {
        return { error: err.message || String(err) };
    }
}

async function sqlTool(args, hub) {
    const query = String(args.query || '').trim();
    if (!query) return { error: '空查询' };
    const params = Array.isArray(args.params) ? args.params : [];
    try {
        const stmt = hub.db.prepare(query).bind(...params);
        if (/^(select|with|pragma)\b/i.test(query)) {
            const { results } = await stmt.all();
            return { rows: results, count: results.length };
        }
        const r = await stmt.run();
        return { ok: true, changes: r.meta?.changes ?? 0, lastRowId: Number(r.meta?.last_row_id) || 0 };
    } catch (err) {
        return { error: err.message || String(err) };
    }
}
