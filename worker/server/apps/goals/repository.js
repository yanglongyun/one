const COLS = 'id, title, prompt, status, next_run_at, last_report, created_at, updated_at';
const STATUSES = new Set(['active', 'paused', 'done', 'abandoned']);
const status = (v) => (STATUSES.has(String(v)) ? String(v) : 'active');

export const list = async (db) => (await db.prepare(`SELECT ${COLS} FROM goals ORDER BY id DESC`).all()).results;

export const get = (db, id) => db.prepare(`SELECT ${COLS} FROM goals WHERE id = ?`).bind(id).first();

export const create = async (db, body, now) => {
    // next_run_at = now:创建即安排第一次推进(cron 一分钟内接手)
    const res = await db.prepare(
        'INSERT INTO goals (title, prompt, status, next_run_at, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)',
    ).bind(String(body.title || '').slice(0, 200), String(body.prompt || ''), status(body.status), now, now, now).run();
    return get(db, Number(res.meta?.last_row_id));
};

export const update = async (db, id, body, now) => {
    const fields = [];
    const vals = [];
    const set = (col, v) => { fields.push(`${col} = ?`); vals.push(v); };
    if (body.title !== undefined) set('title', String(body.title).slice(0, 200));
    if (body.prompt !== undefined) set('prompt', String(body.prompt));
    if (body.status !== undefined) {
        const st = status(body.status);
        set('status', st);
        // 重新激活且没排期 → 立即安排推进;停/达成/放弃 → 撤掉排期
        if (st === 'active') set('next_run_at', body.next_run_at !== undefined ? body.next_run_at : now);
        else set('next_run_at', null);
    } else if (body.next_run_at !== undefined) {
        set('next_run_at', body.next_run_at); // 「立即推进」按钮等显式排期
    }
    if (fields.length) {
        set('updated_at', now);
        await db.prepare(`UPDATE goals SET ${fields.join(', ')} WHERE id = ?`).bind(...vals, id).run();
    }
    return get(db, id);
};

export const remove = (db, id) => db.prepare('DELETE FROM goals WHERE id = ?').bind(id).run();
