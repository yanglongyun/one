export async function enabledSchedules(db) {
    const { results } = await db.prepare('SELECT * FROM schedules WHERE enabled = 1').all();
    return results;
}

export async function markScheduleRun(db, id, now, minute) {
    await db.prepare('UPDATE schedules SET last_run_at = ?, last_run_minute = ? WHERE id = ?')
        .bind(now, minute, id).run();
}

export async function disableSchedule(db, id) {
    await db.prepare('UPDATE schedules SET enabled = 0 WHERE id = ?').bind(id).run();
}

