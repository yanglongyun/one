export async function insertMessage(db, threadId, message, usage = {}, options = {}) {
    if (options.signal?.aborted) throw new DOMException('Aborted', 'AbortError');
    const requireChat = Boolean(options.requireChat && threadId);
    const result = await db.prepare(`
      INSERT OR IGNORE INTO messages (thread_id, role, body, usage, client_id, created_at)
      SELECT ?, ?, ?, ?, ?, ?
      WHERE ? = 0 OR EXISTS (SELECT 1 FROM chats WHERE id = ?)
    `).bind(
        threadId, message.role, JSON.stringify(message), JSON.stringify(usage || {}),
        options.clientId || null, Date.now(), requireChat ? 1 : 0, threadId,
    ).run();
    if (options.signal?.aborted) throw new DOMException('Aborted', 'AbortError');
    return Number(result.meta?.changes || 0);
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
