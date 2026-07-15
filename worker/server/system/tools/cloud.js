import { boundedFetch } from '../net/bounded-fetch.js';
import { executeSql } from '../services/sql.js';
import { executeManagement } from '../services/manage.js';

export async function executeCloudTool(name, args, { hub, signal } = {}) {
    if (name === 'fetch') return fetchTool(args, signal);
    if (name === 'sql') return sqlTool(args, hub);
    if (name === 'one_manage') return manageTool(args, hub);
    return { error: `未知云端工具: ${name}` };
}

async function manageTool(args, hub) {
    try { return await executeManagement(args, hub); }
    catch (err) { return { error: err.message || String(err) }; }
}

async function fetchTool(args, signal) {
    const url = String(args.url || '').trim();
    if (!/^https?:\/\//i.test(url)) return { error: 'url 需以 http(s):// 开头' };
    try {
        const { response: res, body, truncated } = await boundedFetch(url, {
            method: String(args.method || 'GET').toUpperCase(),
            headers: args.headers && typeof args.headers === 'object' ? args.headers : undefined,
            body: args.body != null ? String(args.body) : undefined,
            signal,
        }, { timeoutMs: 15000, maxResponseBytes: 200000, maxRequestBytes: 200000, maxRedirects: 3 });
        return { status: res.status, contentType: res.headers.get('content-type') || '', body, truncated };
    } catch (err) {
        return { error: err.message || String(err) };
    }
}

async function sqlTool(args, hub) {
    try { return await executeSql(hub.db, args.query, args.params); }
    catch (err) { return { error: err.message || String(err) }; }
}
