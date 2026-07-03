const COLS = 'id, title, description, body, visibility, created_at, updated_at';
const VISIBILITIES = new Set(['must', 'star', 'stored']);

let ensured = false;

export async function ensure(db) {
    if (ensured) return;
    await db.prepare(
        `CREATE TABLE IF NOT EXISTS memories (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            title TEXT NOT NULL,
            description TEXT NOT NULL DEFAULT '',
            body TEXT NOT NULL DEFAULT '',
            visibility TEXT NOT NULL DEFAULT 'stored',
            created_at INTEGER NOT NULL,
            updated_at INTEGER NOT NULL
        )`,
    ).run();
    await db.prepare('CREATE INDEX IF NOT EXISTS idx_memories_visibility ON memories(visibility, id DESC)').run();
    ensured = true;
}

const text = (v, max = 100000) => String(v ?? '').trim().slice(0, max);
const visibility = (v) => {
    const value = text(v || 'stored', 20);
    return VISIBILITIES.has(value) ? value : 'stored';
};

export async function list(db, { visibility: only = '', limit = 200, offset = 0 } = {}) {
    await ensure(db);
    if (only) {
        return (await db.prepare(
            `SELECT ${COLS} FROM memories WHERE visibility = ? ORDER BY id DESC LIMIT ? OFFSET ?`,
        ).bind(visibility(only), limit, offset).all()).results;
    }
    return (await db.prepare(`SELECT ${COLS} FROM memories ORDER BY id DESC LIMIT ? OFFSET ?`).bind(limit, offset).all()).results;
}

export async function search(db, { query = '', limit = 20 } = {}) {
    await ensure(db);
    const q = `%${text(query, 200)}%`;
    return (await db.prepare(
        `SELECT id, title, description, visibility, created_at, updated_at
         FROM memories
         WHERE title LIKE ? OR description LIKE ? OR body LIKE ?
         ORDER BY id DESC LIMIT ?`,
    ).bind(q, q, q, limit).all()).results;
}

export async function get(db, id) {
    await ensure(db);
    return db.prepare(`SELECT ${COLS} FROM memories WHERE id = ?`).bind(id).first();
}

export async function create(db, input = {}, now) {
    await ensure(db);
    const title = text(input.title, 500);
    if (!title) throw new Error('Memory title is required');
    const r = await db.prepare(
        'INSERT INTO memories (title, description, body, visibility, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)',
    ).bind(title, text(input.description, 2000), text(input.body), visibility(input.visibility), now, now).run();
    return get(db, Number(r.meta.last_row_id));
}

export async function update(db, id, patch = {}, now) {
    await ensure(db);
    const cur = await get(db, id);
    if (!cur) return null;
    const title = patch.title == null ? cur.title : text(patch.title, 500);
    if (!title) throw new Error('Memory title is required');
    await db.prepare(
        'UPDATE memories SET title = ?, description = ?, body = ?, visibility = ?, updated_at = ? WHERE id = ?',
    ).bind(
        title,
        patch.description == null ? cur.description : text(patch.description, 2000),
        patch.body == null ? cur.body : text(patch.body),
        patch.visibility == null ? cur.visibility : visibility(patch.visibility),
        now,
        id,
    ).run();
    return get(db, id);
}

export async function remove(db, id) {
    await ensure(db);
    return db.prepare('DELETE FROM memories WHERE id = ?').bind(id).run();
}

export async function promptContext(db) {
    await ensure(db);
    const must = (await db.prepare(`SELECT ${COLS} FROM memories WHERE visibility = 'must' ORDER BY id DESC LIMIT 100`).all()).results;
    const star = (await db.prepare(
        'SELECT id, title, description, visibility, created_at, updated_at FROM memories WHERE visibility = ? ORDER BY id DESC LIMIT 100',
    ).bind('star').all()).results;
    const stored = await db.prepare("SELECT COUNT(*) AS count FROM memories WHERE visibility = 'stored'").first();
    return { must, star, storedCount: Number(stored?.count || 0) };
}
