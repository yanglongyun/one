// tasks 表数据访问。创建/驱动执行不在这 —— 那是 DO 的 spawnTask(见 system/realtime/hub.js),
// 这里只管读(列表/详情/该 task 自己的对话线)和删。
const COLS = 'id, title, prompt, status, origin, origin_id, summary, created_at, started_at, finished_at';

export const list = async (db, { status = '' } = {}) => {
    const { results } = status
        ? await db.prepare(`SELECT ${COLS} FROM tasks WHERE status = ? ORDER BY created_at DESC`).bind(status).all()
        : await db.prepare(`SELECT ${COLS} FROM tasks ORDER BY created_at DESC`).all();
    return results;
};

export const get = (db, id) => db.prepare(`SELECT ${COLS} FROM tasks WHERE id = ?`).bind(id).first();

export const remove = (db, id) => db.prepare('DELETE FROM tasks WHERE id = ?').bind(id).run();

// 分页取该 task 自己的线(同 messages 表,thread_id = task id)
export const messages = async (db, taskId, { beforeId = 0, limit = 50 } = {}) => {
    const { results } = beforeId > 0
        ? await db.prepare('SELECT id, role, body, usage, created_at FROM messages WHERE thread_id = ? AND id < ? ORDER BY id DESC LIMIT ?').bind(taskId, beforeId, limit).all()
        : await db.prepare('SELECT id, role, body, usage, created_at FROM messages WHERE thread_id = ? ORDER BY id DESC LIMIT ?').bind(taskId, limit).all();
    return results.reverse();
};
