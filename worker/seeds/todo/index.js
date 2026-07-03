// 待办种子小应用 —— 用 window.one.sql 直读写 app_todo 表,证明小应用平台能承载真实功能。
// 支持 AI 拆解:一条待办用 one.llm 拆成若干子步骤(parent_id 关联),子任务缩进挂在父任务下。
const $ = (s) => document.querySelector(s);
const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (m) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[m]));

const splitting = new Set(); // 正在拆解中的待办 id

async function init() {
    // 首屏自建表(存在则跳过);老表补 parent_id 列(已有则报错忽略)
    await one.sql(
        "CREATE TABLE IF NOT EXISTS app_todo (id INTEGER PRIMARY KEY AUTOINCREMENT, text TEXT NOT NULL DEFAULT '', done INTEGER NOT NULL DEFAULT 0, parent_id INTEGER, created_at INTEGER NOT NULL, done_at INTEGER)"
    );
    try { await one.sql('ALTER TABLE app_todo ADD COLUMN parent_id INTEGER'); } catch { /* 列已存在 */ }
    await load();
}

let byId = {};
async function load() {
    const rows = (await one.sql('SELECT id, text, done, parent_id, created_at, done_at FROM app_todo ORDER BY id ASC')) || [];
    byId = Object.fromEntries(rows.map((r) => [r.id, r]));
    const kids = {};
    rows.forEach((r) => { if (r.parent_id) (kids[r.parent_id] ||= []).push(r); });
    const tops = rows.filter((r) => !r.parent_id);
    // 进行中:最新的在上;已完成:最近完成的在上
    const active = tops.filter((t) => !t.done).sort((a, b) => b.id - a.id);
    const done = tops.filter((t) => t.done).sort((a, b) => (b.done_at || 0) - (a.done_at || 0) || b.id - a.id);
    render(active, done, kids);
}

function itemHtml(t, kids) {
    const on = t.done ? ' on' : '';
    const doneCls = t.done ? ' done' : '';
    const sub = kids ? '' : ' sub';
    const children = kids?.[t.id] || [];
    const doneKids = children.filter((k) => k.done).length;
    const busy = splitting.has(t.id);
    const splitBtn = (!kids || t.done) ? '' : `<button class="item-split${busy ? ' busy' : ''}" data-act="split" title="AI 拆解成小步骤">${busy ? '⏳' : '✨'}</button>`;
    const count = children.length ? `<span class="sub-count">${doneKids}/${children.length}</span>` : '';
    return `<div class="item${doneCls}${sub}" data-id="${t.id}">
        <button class="check${on}" data-act="toggle" aria-label="切换完成"></button>
        <div class="item-text">${esc(t.text)}</div>
        ${count}${splitBtn}
        <button class="item-trash" data-act="del" aria-label="删除">🗑</button>
    </div>` + (children.length ? `<div class="sub-list">${children.map((k) => itemHtml(k, null)).join('')}</div>` : '');
}

function render(active, done, kids) {
    const total = active.length + done.length;
    $('#empty').style.display = total ? 'none' : 'block';

    $('#sec-active').style.display = active.length ? 'block' : 'none';
    $('#c-active').textContent = active.length;
    $('#list-active').innerHTML = active.map((t) => itemHtml(t, kids)).join('');

    $('#sec-done').style.display = done.length ? 'block' : 'none';
    $('#c-done').textContent = done.length;
    $('#list-done').innerHTML = done.map((t) => itemHtml(t, kids)).join('');

    // 事件绑定
    document.querySelectorAll('.item').forEach((el) => {
        const t = byId[Number(el.dataset.id)];
        if (!t) return;
        el.querySelector('[data-act=toggle]')?.addEventListener('click', () => toggle(t));
        el.querySelector('[data-act=del]')?.addEventListener('click', () => del(t));
        el.querySelector('[data-act=split]')?.addEventListener('click', () => split(t));
    });
}

async function add(text) {
    const v = String(text || '').trim();
    if (!v) return;
    await one.sql('INSERT INTO app_todo (text, done, created_at) VALUES (?, 0, ?)', [v, Date.now()]);
    await load();
}

async function toggle(t) {
    if (t.done) {
        await one.sql('UPDATE app_todo SET done = 0, done_at = NULL WHERE id = ?', [t.id]);
    } else {
        await one.sql('UPDATE app_todo SET done = 1, done_at = ? WHERE id = ?', [Date.now(), t.id]);
    }
    await load();
}

async function del(t) {
    if (!confirm('删除这项待办?' + (t.parent_id ? '' : '(它拆出的子步骤会一并删除)'))) return;
    await one.sql('DELETE FROM app_todo WHERE id = ? OR parent_id = ?', [t.id, t.id]);
    await load();
}

// ── AI 拆解:让模型把一条待办拆成 3-6 个可勾选的小步骤 ──
async function split(t) {
    if (splitting.has(t.id)) return;
    splitting.add(t.id);
    await load(); // 刷出 ⏳ 状态
    try {
        const raw = await one.llm(
            `把下面这个待办拆解成 3 到 6 个具体、可执行、按先后顺序排列的小步骤。每步一句话,不带序号。只输出一个 JSON 字符串数组,不要任何其它文字。\n\n待办:${t.text}`,
            { system: '你是任务拆解助手。只输出合法 JSON 数组,例如 ["第一步","第二步"]。' }
        );
        const m = String(raw || '').match(/\[[\s\S]*\]/);
        const steps = m ? JSON.parse(m[0]).map((s) => String(s).trim()).filter(Boolean) : [];
        if (!steps.length) throw new Error('empty');
        const now = Date.now();
        for (const s of steps.slice(0, 8)) {
            await one.sql('INSERT INTO app_todo (text, done, parent_id, created_at) VALUES (?, 0, ?, ?)', [s, t.id, now]);
        }
    } catch (e) {
        console.warn('split failed', e);
        alert('这次没拆出来,再点一次试试。');
    } finally {
        splitting.delete(t.id);
        await load();
    }
}

// ── 录入 ──
const input = $('#q-input');
input.addEventListener('keydown', async (e) => {
    if (e.key === 'Enter') {
        e.preventDefault();
        const v = input.value;
        input.value = '';
        await add(v);
    }
});
// FAB 把焦点拉回顶部输入框(移动端也顺手滚到可见处)
$('#btn-new').addEventListener('click', () => {
    input.scrollIntoView({ behavior: 'smooth', block: 'start' });
    input.focus();
});

init();
