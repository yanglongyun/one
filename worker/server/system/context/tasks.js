export async function recentTasksPrompt(db) {
    if (!db) return '';
    const { results } = await db.prepare(
        'SELECT title, status, summary FROM tasks ORDER BY created_at DESC LIMIT 8',
    ).all();
    if (!results.length) return '';
    const promptLines = ['## 最近任务(全局进度,供你掌握动态,不必逐条汇报)'];
    for (const task of results) promptLines.push(`- [${task.status}] ${task.title}${task.summary ? ` — ${task.summary}` : ''}`);
    promptLines.push('需要更细节时,用 sql 查 tasks / messages(thread_id = 该 task id)。');
    return promptLines.join('\n');
}
