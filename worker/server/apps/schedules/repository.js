import { nextCronOccurrence } from '../../system/realtime/cron.js';

const COLS = 'id, name, prompt, kind, cron, timezone, run_at, next_run_at, enabled, last_run_at, last_run_minute, created_at, updated_at';

const normKind = (kind) => (kind === 'once' ? 'once' : 'cron');
const normRunAt = (value) => { const number = Number(value); return Number.isFinite(number) && number > 0 ? Math.round(number) : null; };

export const list = async (db, { cursor = '', limit = 50 } = {}) => {
    const [timeRaw, idRaw] = String(cursor || '').split('.');
    const time = Number(timeRaw) || Number.MAX_SAFE_INTEGER;
    const id = Number(idRaw) || Number.MAX_SAFE_INTEGER;
    return (await db.prepare(`
      SELECT ${COLS} FROM schedules
      WHERE created_at < ? OR (created_at = ? AND id < ?)
      ORDER BY created_at DESC, id DESC LIMIT ?
    `).bind(time, time, id, limit + 1).all()).results;
};

export const get = (db, id) => db.prepare(`SELECT ${COLS} FROM schedules WHERE id = ?`).bind(id).first();

export const create = async (db, body, now) => {
    const kind = normKind(body.kind);
    const enabled = body.enabled === false ? 0 : 1;
    const timezone = String(body.timezone || 'UTC');
    const cron = kind === 'cron' ? String(body.cron || '').slice(0, 100) : '';
    const runAt = kind === 'once' ? normRunAt(body.run_at) : null;
    const nextRunAt = enabled ? (kind === 'once' ? runAt : nextCronOccurrence(cron, timezone, now)) : null;
    const statement = db.prepare(
        `INSERT INTO schedules (name, prompt, kind, cron, timezone, run_at, next_run_at, enabled, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).bind(
        String(body.name || '').slice(0, 200),
        String(body.prompt || ''),
        kind, cron, timezone, runAt, nextRunAt, enabled, now, now,
    );
    const result = await statement.run();
    return get(db, Number(result.meta?.last_row_id));
};

export const update = async (db, id, body, now) => {
    const fields = [];
    const values = [];
    const set = (column, value) => { fields.push(`${column} = ?`); values.push(value); };
    if (body.name !== undefined) set('name', String(body.name).slice(0, 200));
    if (body.prompt !== undefined) set('prompt', String(body.prompt));
    if (body.kind !== undefined) set('kind', normKind(body.kind));
    if (body.cron !== undefined) set('cron', String(body.cron).slice(0, 100));
    if (body.timezone !== undefined) set('timezone', String(body.timezone).slice(0, 100));
    if (body.run_at !== undefined) set('run_at', normRunAt(body.run_at));
    if (body.enabled !== undefined) set('enabled', body.enabled ? 1 : 0);
    if (fields.length) {
        set('updated_at', now);
        await db.prepare(`UPDATE schedules SET ${fields.join(', ')} WHERE id = ?`).bind(...values, id).run();
    }
    const current = await get(db, id);
    if (current) {
        const nextRunAt = current.enabled
            ? (current.kind === 'once' ? normRunAt(current.run_at) : nextCronOccurrence(current.cron, current.timezone, now))
            : null;
        await db.prepare('UPDATE schedules SET next_run_at = ? WHERE id = ?').bind(nextRunAt, id).run();
    }
    return get(db, id);
};

export const remove = (db, id) => db.prepare('DELETE FROM schedules WHERE id = ?').bind(id).run();
