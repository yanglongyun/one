export async function latestCompaction(db, threadId) {
    return db.prepare(
        'SELECT summary, end_message_id FROM compactions WHERE thread_id IS ? ORDER BY id DESC LIMIT 1',
    ).bind(threadId).first();
}

export async function insertCompaction(db, threadId, { startId, endId, summary, tokens }) {
    await db.prepare(
        'INSERT INTO compactions (thread_id, start_message_id, end_message_id, summary, tokens, created_at) VALUES (?, ?, ?, ?, ?, ?)',
    ).bind(threadId, startId, endId, summary, tokens, Date.now()).run();
}

