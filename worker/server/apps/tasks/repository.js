// tasks 表数据访问。创建/驱动执行不在这 —— 那是 DO 的 spawnTask(见 system/realtime/hub.js),
// 这里只管读(列表/详情/该 task 自己的对话线)和删。
const COLS = 'id, title, prompt, status, origin, origin_id, summary, created_at, started_at, finished_at, attempts, last_error';

export const list = async (db, { status = '', origin = '', originId = '', cursor = '', limit = 100 } = {}) => {
    const clauses = []; const values = [];
    if (status) { clauses.push('status = ?'); values.push(status); }
    if (origin) { clauses.push('origin = ?'); values.push(origin); }
    if (originId) { clauses.push('origin_id = ?'); values.push(originId); }
    const [createdAt, cursorId] = String(cursor).split('.');
    if (Number.isFinite(Number(createdAt)) && cursorId) {
        clauses.push('(created_at < ? OR (created_at = ? AND id < ?))');
        values.push(Number(createdAt), Number(createdAt), cursorId);
    }
    const where = clauses.length ? ` WHERE ${clauses.join(' AND ')}` : '';
    const { results } = await db.prepare(`SELECT ${COLS} FROM tasks${where} ORDER BY created_at DESC, id DESC LIMIT ?`)
        .bind(...values, limit).all();
    return results;
};

export const get = (db, id) => db.prepare(`SELECT ${COLS} FROM tasks WHERE id = ?`).bind(id).first();

export const counts = async (db) => {
    const { results } = await db.prepare('SELECT status, COUNT(*) AS count FROM tasks GROUP BY status').all();
    const countsByStatus = Object.fromEntries(results.map((row) => [row.status, Number(row.count) || 0]));
    countsByStatus.all = Object.values(countsByStatus).reduce((sum, count) => sum + count, 0);
    return countsByStatus;
};

export const cancel = (db, id) => db.prepare(`
  UPDATE tasks SET status = 'cancelled', summary = CASE WHEN summary = '' THEN '用户已取消' ELSE summary END,
    last_error = '用户已取消', finished_at = ?, lease_until = NULL
  WHERE id = ? AND status IN ('pending','running','aborted')
`).bind(Date.now(), id).run();

// 分页取该 task 自己的线(同 messages 表,thread_id = task id)
export const messages = async (db, taskId, { beforeId = 0, limit = 50 } = {}) => {
    const { results } = beforeId > 0
        ? await db.prepare('SELECT id, role, body, usage, created_at FROM messages WHERE thread_id = ? AND id < ? ORDER BY id DESC LIMIT ?').bind(taskId, beforeId, limit).all()
        : await db.prepare('SELECT id, role, body, usage, created_at FROM messages WHERE thread_id = ? ORDER BY id DESC LIMIT ?').bind(taskId, limit).all();
    return results.reverse();
};
