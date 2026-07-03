// 自定义应用:apps(元信息)+ codes(文件,按 version 追加)。
// 最新版生效;历史版本天然留存,坏了可回滚(写一条旧内容的新版本即可)。

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
    const existing = await bySlug(db, slug);
    if (existing) {
        await db.prepare(
            'UPDATE apps SET name = ?, icon = ?, color = ?, description = ?, updated_at = ? WHERE id = ?',
        ).bind(
            name ?? existing.name, icon ?? existing.icon, color ?? existing.color,
            description ?? existing.description, now, existing.id,
        ).run();
        return bySlug(db, slug);
    }
    await db.prepare(
        'INSERT INTO apps (slug, name, icon, color, description, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
    ).bind(String(slug), String(name || slug), String(icon || ''), String(color || 'blue'), String(description || ''), now, now).run();
    return bySlug(db, slug);
}

export async function remove(db, slug) {
    const app = await bySlug(db, slug);
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
