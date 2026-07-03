export async function needsFallbackRun(db, id) {
    return Boolean(await db.prepare(
        "SELECT 1 FROM goals WHERE id = ? AND status = 'active' AND next_run_at IS NULL",
    ).bind(id).first());
}

export async function scheduleGoal(db, id, nextRunAt) {
    await db.prepare('UPDATE goals SET next_run_at = ?, updated_at = ? WHERE id = ?')
        .bind(nextRunAt, Date.now(), id).run();
}

export async function dueGoals(db, now) {
    const { results } = await db.prepare(
        "SELECT * FROM goals WHERE status = 'active' AND next_run_at IS NOT NULL AND next_run_at <= ?",
    ).bind(now).all();
    return results;
}

export async function clearGoalSchedule(db, id) {
    await db.prepare('UPDATE goals SET next_run_at = NULL WHERE id = ?').bind(id).run();
}
