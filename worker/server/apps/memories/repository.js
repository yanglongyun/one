const COLS = 'id, title, description, body, visibility, created_at, updated_at';
const VISIBILITIES = new Set(['must', 'star', 'stored']);

const text = (value, max = 100000) => String(value ?? '').trim().slice(0, max);
const visibility = (value) => {
    const normalized = text(value || 'stored', 20);
    return VISIBILITIES.has(normalized) ? normalized : 'stored';
};

export async function list(db, { visibility: only = '', limit = 50, cursor = 0 } = {}) {
    const before = Number(cursor) > 0 ? Number(cursor) : Number.MAX_SAFE_INTEGER;
    if (only) {
        return (await db.prepare(
            `SELECT ${COLS} FROM memories WHERE visibility = ? AND id < ? ORDER BY id DESC LIMIT ?`,
        ).bind(visibility(only), before, limit).all()).results;
    }
    return (await db.prepare(
        `SELECT ${COLS} FROM memories WHERE id < ? ORDER BY id DESC LIMIT ?`,
    ).bind(before, limit).all()).results;
}

export async function search(db, { query = '', limit = 20 } = {}) {
    const q = `%${text(query, 200)}%`;
    return (await db.prepare(
        `SELECT id, title, description, visibility, created_at, updated_at
         FROM memories
         WHERE title LIKE ? OR description LIKE ? OR body LIKE ?
         ORDER BY id DESC LIMIT ?`,
    ).bind(q, q, q, limit).all()).results;
}

export function get(db, id) {
    return db.prepare(`SELECT ${COLS} FROM memories WHERE id = ?`).bind(id).first();
}

export async function create(db, input = {}, now) {
    const title = text(input.title, 500);
    if (!title) throw new Error('Memory title is required');
    const result = await db.prepare(
        'INSERT INTO memories (title, description, body, visibility, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)',
    ).bind(title, text(input.description, 2000), text(input.body), visibility(input.visibility), now, now).run();
    return get(db, Number(result.meta.last_row_id));
}

export async function update(db, id, patch = {}, now) {
    const current = await get(db, id);
    if (!current) return null;
    const title = patch.title == null ? current.title : text(patch.title, 500);
    if (!title) throw new Error('Memory title is required');
    await db.prepare(
        'UPDATE memories SET title = ?, description = ?, body = ?, visibility = ?, updated_at = ? WHERE id = ?',
    ).bind(
        title,
        patch.description == null ? current.description : text(patch.description, 2000),
        patch.body == null ? current.body : text(patch.body),
        patch.visibility == null ? current.visibility : visibility(patch.visibility),
        now,
        id,
    ).run();
    return get(db, id);
}

export function remove(db, id) {
    return db.prepare('DELETE FROM memories WHERE id = ?').bind(id).run();
}

export async function promptContext(db) {
    const must = (await db.prepare(`SELECT ${COLS} FROM memories WHERE visibility = 'must' ORDER BY id DESC LIMIT 100`).all()).results;
    const star = (await db.prepare(
        'SELECT id, title, description, visibility, created_at, updated_at FROM memories WHERE visibility = ? ORDER BY id DESC LIMIT 100',
    ).bind('star').all()).results;
    const stored = await db.prepare("SELECT COUNT(*) AS count FROM memories WHERE visibility = 'stored'").first();
    return { must, star, storedCount: Number(stored?.count || 0) };
}
