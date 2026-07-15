// 自定义应用:apps(元信息)+ codes(文件,按 version 追加)。

const COLORS = new Set(['blue', 'orange', 'purple', 'red', 'pink', 'green', 'teal', 'slate']);
const RESERVED_SLUGS = new Set(['bridge', 'new']);
const FILENAMES = new Set(['index.html', 'index.js', 'index.css', 'index.sql']);

export function normalizeInput(input = {}) {
    const slug = String(input.slug || '').trim().toLowerCase();
    if (!/^[a-z0-9][a-z0-9-]{0,40}$/.test(slug) || RESERVED_SLUGS.has(slug)) throw new Error('无效或保留的应用 slug');
    if (input.color != null && !COLORS.has(String(input.color))) throw new Error('无效应用配色');
    if (input.files != null && (typeof input.files !== 'object' || Array.isArray(input.files))) {
        throw new Error('应用 files 必须是文件名到内容的对象');
    }
    const files = input.files || {};
    const invalidFile = Object.keys(files).find((name) => !FILENAMES.has(name));
    if (invalidFile) throw new Error(`不支持的应用文件:${invalidFile}`);
    return { ...input, slug, files };
}

export async function list(db) {
    // id ASC:出厂种子按 笔记→待办→恋爱→启示 落座,新创建的应用排在末尾(紧挨「创建」入口)
    const { results } = await db.prepare('SELECT * FROM apps ORDER BY id ASC').all();
    return results;
}

export async function bySlug(db, slug) {
    return db.prepare('SELECT * FROM apps WHERE slug = ?').bind(String(slug)).first();
}

export async function upsert(db, { slug, name, icon, color, description }) {
    const now = Date.now();
    await db.prepare(`
      INSERT INTO apps (slug,name,icon,color,description,created_at,updated_at)
      VALUES (?,?,?,?,?,?,?)
      ON CONFLICT(slug) DO UPDATE SET
        name=COALESCE(?,apps.name),icon=COALESCE(?,apps.icon),color=COALESCE(?,apps.color),
        description=COALESCE(?,apps.description),updated_at=excluded.updated_at
    `).bind(
        String(slug), String(name ?? slug), String(icon ?? ''), String(color ?? 'blue'), String(description ?? ''), now, now,
        name == null ? null : String(name), icon == null ? null : String(icon),
        color == null ? null : String(color), description == null ? null : String(description),
    ).run();
    return bySlug(db, slug);
}

export async function writeFiles(db, appId, files) {
    const entries = Object.entries(files || {}).filter(([filename]) => FILENAMES.has(filename));
    if (!entries.length) return [];
    const now = Date.now();
    await db.batch(entries.map(([filename, content]) => db.prepare(`
      INSERT INTO codes (app_id,filename,content,version,created_at)
      SELECT ?,?,?,COALESCE(MAX(version),0)+1,? FROM codes WHERE app_id=? AND filename=?
    `).bind(appId, filename, String(content ?? ''), now, appId, filename)));
    return Promise.all(entries.map(async ([filename]) => ({
        filename,
        version: Number((await latestFile(db, appId, filename))?.version || 0),
    })));
}

export async function remove(db, slug) {
    const app = await bySlug(db, String(slug || '').trim().toLowerCase());
    if (!app) return false;
    await db.prepare('DELETE FROM codes WHERE app_id = ?').bind(app.id).run();
    await db.prepare('DELETE FROM apps WHERE id = ?').bind(app.id).run();
    return true;
}

// 读某文件最新版内容(无则 null)。
export async function latestFile(db, appId, filename) {
    const row = await db.prepare(
        'SELECT content, version FROM codes WHERE app_id = ? AND filename = ? ORDER BY version DESC LIMIT 1',
    ).bind(appId, String(filename)).first();
    return row || null;
}
