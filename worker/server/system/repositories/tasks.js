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

export async function insertTask(db, { id, title, prompt, origin, originId, responseFormat, now }) {
    await db.prepare(
        `INSERT INTO tasks (id, title, prompt, status, origin, origin_id, response_format, created_at)
         VALUES (?, ?, ?, 'pending', ?, ?, ?, ?)`,
    ).bind(id, title, prompt, origin, originId, responseFormat ? JSON.stringify(responseFormat) : null, now).run();
}

export async function markRunning(db, id) {
    await db.prepare(
        "UPDATE tasks SET status = 'running', started_at = COALESCE(started_at, ?) WHERE id = ?",
    ).bind(Date.now(), id).run();
}

export async function markFinished(db, id, status, summary) {
    await db.prepare(
        'UPDATE tasks SET status = ?, summary = ?, finished_at = ? WHERE id = ?',
    ).bind(status, summary, Date.now(), id).run();
}

export async function taskOrigin(db, id) {
    return db.prepare('SELECT origin, origin_id FROM tasks WHERE id = ?').bind(id).first();
}

export async function recentGoalTasks(db, goalId) {
    const { results } = await db.prepare(
        "SELECT status, summary FROM tasks WHERE origin = 'goal' AND origin_id = ? ORDER BY created_at DESC LIMIT 3",
    ).bind(goalId).all();
    return results;
}

export async function hasInflightGoalTask(db, goalId) {
    return Boolean(await db.prepare(
        "SELECT 1 FROM tasks WHERE origin = 'goal' AND origin_id = ? AND status IN ('pending','running') LIMIT 1",
    ).bind(goalId).first());
}
