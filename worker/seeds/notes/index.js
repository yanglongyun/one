// 笔记种子小应用 —— 用 window.one.sql 自建并读写 app_notes 表(小应用数据表统一 app_ 前缀)。
const $ = (s) => document.querySelector(s);
const COLORS = ['yellow', 'blue', 'green', 'pink', 'plain'];
const colorOf = (c) => (COLORS.includes(c) ? c : 'plain');
const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (m) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[m]));

let editingId = null;
let form = { content: '', color: 'yellow', pinned: false };

const titleOf = (n) => (n.content || '').split('\n')[0].trim();
const bodyLines = (n) => (n.content || '').split('\n').slice(1).map((s) => s.trim()).filter(Boolean);

function fmtTime(ts) {
    const t = Number(ts) || 0;
    if (!t) return '';
    const diff = Date.now() - t;
    if (diff < 60000) return '刚刚';
    if (diff < 3600000) return `${Math.floor(diff / 60000)} 分钟前`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)} 小时前`;
    const d = new Date(t);
    return `${d.getMonth() + 1}月${d.getDate()}日`;
}

// ── 分页:每页 30 条,触底自动加载下一页;增删改色就地更新,不整表重载 ──
const PAGE = 30;
let offset = 0, loading = false, noMore = false;
const seen = new Map(); // id -> note 对象(供事件回调取用)

async function load(reset = false) {
    if (loading) return;
    loading = true;
    if (reset) { offset = 0; noMore = false; seen.clear(); $('#board').innerHTML = ''; }
    const rows = (await one.sql(
        'SELECT id, content, color, pinned, created_at, updated_at FROM app_notes ORDER BY pinned DESC, id DESC LIMIT ? OFFSET ?',
        [PAGE, offset],
    )) || [];
    rows.forEach((n) => seen.set(n.id, n));
    offset += rows.length;
    if (rows.length < PAGE) noMore = true;
    appendCards(rows);
    $('#empty').style.display = seen.size ? 'none' : 'block';
    loading = false;
}

function noteHtml(n) {
    const c = colorOf(n.color);
    const body = bodyLines(n).map((l) => `<p>${esc(l)}</p>`).join('');
    const dots = COLORS.map((cc) => `<button class="cdot cdot-${cc}${c === cc ? ' on' : ''}" data-color="${cc}"></button>`).join('');
    return `<div class="note note-${c}" data-id="${n.id}">
        ${n.pinned ? '<span class="pin">📌</span>' : ''}
        <div class="note-title">${esc(titleOf(n))}</div>
        ${body ? `<div class="note-body">${body}</div>` : ''}
        <div class="note-foot">
            <span class="time">${fmtTime(n.updated_at || n.created_at)}</span>
            <span class="note-acts">${dots}<button class="note-trash" data-act="del">🗑</button></span>
        </div>
    </div>`;
}

function bindCard(el) {
    const note = seen.get(Number(el.dataset.id));
    if (!note) return;
    el.addEventListener('click', (e) => { if (e.target.closest('.note-acts')) return; openEdit(note); });
    el.querySelectorAll('.cdot').forEach((d) => d.addEventListener('click', (e) => { e.stopPropagation(); setColor(el, note, d.dataset.color); }));
    el.querySelector('[data-act=del]').addEventListener('click', (e) => { e.stopPropagation(); del(el, note); });
}

function appendCards(items) {
    const board = $('#board');
    const tmp = document.createElement('div');
    tmp.innerHTML = items.map(noteHtml).join('');
    while (tmp.firstElementChild) {
        const el = tmp.firstElementChild;
        board.appendChild(el);
        bindCard(el);
    }
}

async function setColor(el, n, c) {
    if (colorOf(n.color) === c) return;
    await one.sql('UPDATE app_notes SET color = ?, updated_at = ? WHERE id = ?', [c, Date.now(), n.id]);
    n.color = c;
    el.className = 'note note-' + colorOf(c);
    el.querySelectorAll('.cdot').forEach((d) => d.classList.toggle('on', d.dataset.color === c));
}

async function del(el, n) {
    if (!confirm('删除这条笔记?')) return;
    await one.sql('DELETE FROM app_notes WHERE id = ?', [n.id]);
    seen.delete(n.id);
    el.remove();
    $('#empty').style.display = seen.size ? 'none' : 'block';
}

// ── 弹窗 ──
function paintColorPicker() {
    $('#f-colors').innerHTML = COLORS.map((c) => `<button class="cdot lg cdot-${c}${form.color === c ? ' on' : ''}" data-color="${c}"></button>`).join('');
    $('#f-colors').querySelectorAll('.cdot').forEach((d) => d.addEventListener('click', () => {
        form.color = d.dataset.color;
        paintColorPicker();
    }));
}
function openModal() {
    $('#f-content').value = form.content;
    $('#f-pin').classList.toggle('on', form.pinned);
    $('#modal-title').textContent = editingId ? '编辑笔记' : '新建笔记';
    paintColorPicker();
    $('#modal').style.display = 'grid';
}
function openCreate() { editingId = null; form = { content: '', color: 'yellow', pinned: false }; openModal(); }
function openEdit(n) { editingId = n.id; form = { content: n.content || '', color: colorOf(n.color), pinned: Boolean(n.pinned) }; openModal(); }
function closeModal() { $('#modal').style.display = 'none'; }

async function save() {
    const content = $('#f-content').value.trim();
    if (!content) return;
    const now = Date.now();
    const pinned = form.pinned ? 1 : 0;
    if (editingId) {
        await one.sql('UPDATE app_notes SET content = ?, color = ?, pinned = ?, updated_at = ? WHERE id = ?', [content, form.color, pinned, now, editingId]);
    } else {
        await one.sql('INSERT INTO app_notes (content, color, pinned, created_at, updated_at) VALUES (?, ?, ?, ?, ?)', [content, form.color, pinned, now, now]);
    }
    closeModal();
    load(true);
}

$('#btn-new').addEventListener('click', openCreate);
$('#btn-cancel').addEventListener('click', closeModal);
$('#btn-save').addEventListener('click', save);
$('#f-content').addEventListener('input', (e) => { form.content = e.target.value; });
$('#f-pin').addEventListener('click', () => { form.pinned = !form.pinned; $('#f-pin').classList.toggle('on', form.pinned); });
$('#modal').addEventListener('click', (e) => { if (e.target === $('#modal')) closeModal(); });

// 触底哨兵:滚到接近底部就自动加载下一页
const sentinel = document.createElement('div');
sentinel.style.cssText = 'height:1px';
$('#board').insertAdjacentElement('afterend', sentinel);
new IntersectionObserver((entries) => {
    if (entries[0].isIntersecting && !loading && !noMore) load();
}, { rootMargin: '240px' }).observe(sentinel);

// 数据表 app_notes 由平台在打开应用前按 index.sql 建好,这里加载首页
load();
