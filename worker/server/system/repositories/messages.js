export async function insertMessage(db, threadId, message, usage = {}) {
    await db.prepare(
        'INSERT INTO messages (thread_id, role, body, usage, created_at) VALUES (?, ?, ?, ?, ?)',
    ).bind(threadId, message.role, JSON.stringify(message), JSON.stringify(usage || {}), Date.now()).run();
}

export async function recentMessagesAfterCompaction(db, threadId, afterId, limit) {
    const { results } = await db.prepare(
        `SELECT role, body FROM (
            SELECT id, role, body FROM messages WHERE thread_id IS ? AND id > ? ORDER BY id DESC LIMIT ?
         ) ORDER BY id ASC`,
    ).bind(threadId, afterId, limit).all();
    return results;
}

export async function messagesAfter(db, threadId, afterId) {
    const { results } = await db.prepare(
        'SELECT id, body FROM messages WHERE thread_id IS ? AND id > ? ORDER BY id ASC',
    ).bind(threadId, afterId).all();
    return results;
}

export async function latestUsage(db, threadId) {
    return db.prepare(
        "SELECT usage FROM messages WHERE thread_id IS ? AND usage != '{}' ORDER BY id DESC LIMIT 1",
    ).bind(threadId).first();
}

