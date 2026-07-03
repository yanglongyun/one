// 会话历史读取(thread_id = 会话 id)。直播走 DO,这里只管历史分页。
export const messages = async (db, { chatId, beforeId = 0, limit = 50 } = {}) => {
    const { results } = beforeId > 0
        ? await db.prepare('SELECT id, role, body, usage, created_at FROM messages WHERE thread_id = ? AND id < ? ORDER BY id DESC LIMIT ?').bind(chatId, beforeId, limit).all()
        : await db.prepare('SELECT id, role, body, usage, created_at FROM messages WHERE thread_id = ? ORDER BY id DESC LIMIT ?').bind(chatId, limit).all();
    return results.reverse();
};
