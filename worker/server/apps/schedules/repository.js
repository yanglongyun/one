const COLS = 'id, name, prompt, kind, cron, run_at, enabled, last_run_at, last_run_minute, created_at, updated_at';

const normKind = (k) => (k === 'once' ? 'once' : 'cron');
const normRunAt = (v) => { const n = Number(v); return Number.isFinite(n) && n > 0 ? Math.round(n) : null; };

export const list = async (db) => (await db.prepare(`SELECT ${COLS} FROM schedules ORDER BY id DESC`).all()).results;

export const get = (db, id) => db.prepare(`SELECT ${COLS} FROM schedules WHERE id = ?`).bind(id).first();

export const create = async (db, body, now) => {
    const kind = normKind(body.kind);
    const stmt = db.prepare(
        `INSERT INTO schedules (name, prompt, kind, cron, run_at, enabled, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    ).bind(
        String(body.name || '').slice(0, 200),
        String(body.prompt || ''),
        kind,
        kind === 'cron' ? String(body.cron || '').slice(0, 100) : '',
        kind === 'once' ? normRunAt(body.run_at) : null,
        body.enabled === false ? 0 : 1,
        now, now,
    );
    const res = await stmt.run();
    return get(db, Number(res.meta?.last_row_id));
};

export const update = async (db, id, body, now) => {
    const fields = [];
    const vals = [];
    const set = (col, v) => { fields.push(`${col} = ?`); vals.push(v); };
    if (body.name !== undefined) set('name', String(body.name).slice(0, 200));
    if (body.prompt !== undefined) set('prompt', String(body.prompt));
    if (body.kind !== undefined) set('kind', normKind(body.kind));
    if (body.cron !== undefined) set('cron', String(body.cron).slice(0, 100));
    if (body.run_at !== undefined) set('run_at', normRunAt(body.run_at));
    if (body.enabled !== undefined) set('enabled', body.enabled ? 1 : 0);
    if (fields.length) {
        set('updated_at', now);
        await db.prepare(`UPDATE schedules SET ${fields.join(', ')} WHERE id = ?`).bind(...vals, id).run();
    }
    return get(db, id);
};

export const remove = (db, id) => db.prepare('DELETE FROM schedules WHERE id = ?').bind(id).run();
