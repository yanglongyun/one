export async function dueGoals(db, now) {
    const { results } = await db.prepare(`
      SELECT * FROM goals WHERE status = 'active' AND next_run_at IS NOT NULL AND next_run_at <= ?
      ORDER BY next_run_at ASC LIMIT 20
    `).bind(now).all();
    return results;
}
