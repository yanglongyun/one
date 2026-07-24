export async function taskSummary(db, id) {
    if (!id) return null;
    return db.prepare('SELECT title, prompt FROM tasks WHERE id = ?').bind(id).first();
}

// 任务发起时要求的 response_format(OpenAI 兼容,如 {type:'json_object'}),没有就 null
export async function taskResponseFormat(db, id) {
    const row = await db.prepare('SELECT response_format FROM tasks WHERE id = ?').bind(id).first();
    if (!row?.response_format) return null;
    try { return JSON.parse(row.response_format); } catch { return null; }
}

export function insertTask(db, { id, title, prompt, origin, originId, responseFormat, now }) {
    return db.prepare(
        `INSERT INTO tasks (id, title, prompt, status, origin, origin_id, response_format, created_at)
         VALUES (?, ?, ?, 'pending', ?, ?, ?, ?)`,
    ).bind(id, title, prompt, origin, originId, responseFormat ? JSON.stringify(responseFormat) : null, now);
}





export async function claimTask(db, id, leaseMs = 30 * 60 * 1000) {
    const now = Date.now();
    const result = await db.prepare(
        `UPDATE tasks SET status = 'running', started_at = COALESCE(started_at, ?),
         lease_until = ?, attempts = attempts + 1, last_error = ''
         WHERE id = ? AND attempts < 3 AND (status = 'pending' OR (status = 'running' AND (lease_until IS NULL OR lease_until <= ?)))`,
    ).bind(now, now + leaseMs, id, now).run();
    return Number(result.meta?.changes || 0) === 1;
}

export const renewTaskLease = (db, id, leaseMs = 30 * 60 * 1000) => db.prepare(
    "UPDATE tasks SET lease_until = ? WHERE id = ? AND status = 'running'",
).bind(Date.now() + leaseMs, id).run();

export async function markFinished(db, id, status, summary) {
    const result = await db.prepare(
        "UPDATE tasks SET status = ?, summary = ?, last_error = ?, finished_at = ?, lease_until = NULL WHERE id = ? AND status = 'running'",
    ).bind(status, summary, status === 'failed' ? summary : '', Date.now(), id).run();
    return Number(result.meta?.changes || 0) === 1;
}

export async function taskOrigin(db, id) {
    return db.prepare('SELECT origin, origin_id, status FROM tasks WHERE id = ?').bind(id).first();
}

export async function taskState(db, id) {
    return db.prepare('SELECT id,title,prompt,status,origin,origin_id,summary,created_at,started_at,finished_at FROM tasks WHERE id = ?').bind(id).first();
}



export async function recoverableTasks(db, now = Date.now()) {
    const { results } = await db.prepare(`
      SELECT id,prompt,status,attempts,lease_until FROM tasks
      WHERE attempts < 3 AND (status = 'pending' OR (status = 'running' AND (lease_until IS NULL OR lease_until <= ?)))
      ORDER BY created_at ASC LIMIT 20
    `).bind(now).all();
    return results;
}

export const failExhaustedTasks = (db, now = Date.now()) => db.prepare(`
  UPDATE tasks SET status = 'failed', last_error = '任务重试次数已耗尽', summary = '任务重试次数已耗尽',
    finished_at = ?, lease_until = NULL
  WHERE status = 'running' AND attempts >= 3 AND (lease_until IS NULL OR lease_until <= ?)
`).bind(now, now).run();
