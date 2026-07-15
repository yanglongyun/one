export async function dueSchedules(db, now) {
    const { results } = await db.prepare(`
      SELECT * FROM schedules WHERE enabled = 1 AND next_run_at IS NOT NULL AND next_run_at <= ?
      ORDER BY next_run_at ASC LIMIT 20
    `).bind(now).all();
    return results;
}
