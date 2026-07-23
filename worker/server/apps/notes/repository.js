const COLS = 'id, content, color, pinned, created_at, updated_at';
const COLORS = new Set(['yellow', 'blue', 'green', 'pink', 'purple', 'slate', 'plain']);

const text = (value, max = 100000) => String(value ?? '').trim().slice(0, max);
const color = (value) => {
    const normalized = text(value || 'yellow', 20);
    return COLORS.has(normalized) ? normalized : 'plain';
};
const pinned = (value) => (value ? 1 : 0);

// 置顶在前:首页返回全部置顶 + 最新一页未置顶;cursor(上一页末条 id)只翻未置顶,不会重复。
export async function list(db, { limit = 50, cursor = 0 } = {}) {
    const before = Number(cursor) > 0 ? Number(cursor) : Number.MAX_SAFE_INTEGER;
    const unpinned = (await db.prepare(
        `SELECT ${COLS} FROM notes WHERE pinned = 0 AND id < ? ORDER BY id DESC LIMIT ?`,
    ).bind(before, limit + 1).all()).results;
    const hasMore = unpinned.length > limit;
    const page = hasMore ? unpinned.slice(0, limit) : unpinned;
    const pinnedRows = Number(cursor) > 0 ? [] : (await db.prepare(
        `SELECT ${COLS} FROM notes WHERE pinned = 1 ORDER BY id DESC LIMIT 200`,
    ).all()).results;
    return { notes: [...pinnedRows, ...page], nextCursor: hasMore ? String(page.at(-1)?.id || '') : null };
}

export function get(db, id) {
    return db.prepare(`SELECT ${COLS} FROM notes WHERE id = ?`).bind(id).first();
}

export async function create(db, input = {}, now) {
    const content = text(input.content);
    if (!content) throw new Error('笔记内容不能为空');
    const result = await db.prepare(
        'INSERT INTO notes (content, color, pinned, created_at, updated_at) VALUES (?, ?, ?, ?, ?)',
    ).bind(content, color(input.color), pinned(input.pinned), now, now).run();
    return get(db, Number(result.meta.last_row_id));
}

export async function update(db, id, patch = {}, now) {
    const current = await get(db, id);
    if (!current) return null;
    const content = patch.content == null ? current.content : text(patch.content);
    if (!content) throw new Error('笔记内容不能为空');
    await db.prepare(
        'UPDATE notes SET content = ?, color = ?, pinned = ?, updated_at = ? WHERE id = ?',
    ).bind(
        content,
        patch.color == null ? current.color : color(patch.color),
        patch.pinned == null ? current.pinned : pinned(patch.pinned),
        now,
        id,
    ).run();
    return get(db, id);
}

export function remove(db, id) {
    return db.prepare('DELETE FROM notes WHERE id = ?').bind(id).run();
}
