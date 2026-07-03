// 会话:多会话 + 置顶。消息经 messages.thread_id = chats.id 挂载。
export async function list(db) {
    const { results } = await db.prepare('SELECT * FROM chats ORDER BY pinned DESC, updated_at DESC').all();
    return results;
}

export async function create(db, { title = '' } = {}) {
    const id = crypto.randomUUID();
    const now = Date.now();
    await db.prepare('INSERT INTO chats (id, title, pinned, created_at, updated_at) VALUES (?, ?, 0, ?, ?)')
        .bind(id, String(title || ''), now, now).run();
    return db.prepare('SELECT * FROM chats WHERE id = ?').bind(id).first();
}

export async function update(db, id, patch) {
    const cur = await db.prepare('SELECT * FROM chats WHERE id = ?').bind(id).first();
    if (!cur) return null;
    await db.prepare('UPDATE chats SET title = ?, pinned = ?, updated_at = ? WHERE id = ?')
        .bind(
            patch.title != null ? String(patch.title) : cur.title,
            patch.pinned != null ? (patch.pinned ? 1 : 0) : cur.pinned,
            Date.now(), id,
        ).run();
    return db.prepare('SELECT * FROM chats WHERE id = ?').bind(id).first();
}

export async function remove(db, id) {
    await db.prepare('DELETE FROM messages WHERE thread_id = ?').bind(id).run();
    await db.prepare('DELETE FROM compactions WHERE thread_id = ?').bind(id).run();
    await db.prepare('DELETE FROM chats WHERE id = ?').bind(id).run();
}

// turn 期间的触碰:第一条用户消息给未命名会话起标题 + 刷新排序时间
export async function touch(db, id, firstText = '') {
    const cur = await db.prepare('SELECT title FROM chats WHERE id = ?').bind(id).first();
    if (!cur) return;
    const title = cur.title || String(firstText || '').trim().replace(/\s+/g, ' ').slice(0, 24);
    await db.prepare('UPDATE chats SET title = ?, updated_at = ? WHERE id = ?').bind(title, Date.now(), id).run();
}
