// 笔记种子小应用 —— 用 window.one.sql 直读写系统 notes 表,证明小应用平台能承载真实功能。
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

async function load() {
    const rows = await one.sql('SELECT id, content, color, pinned, created_at, updated_at FROM notes ORDER BY pinned DESC, id DESC');
    render(rows || []);
}

function render(items) {
    $('#empty').style.display = items.length ? 'none' : 'block';
    const board = $('#board');
    board.innerHTML = items.map((n) => {
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
    }).join('');

    board.querySelectorAll('.note').forEach((el) => {
        const id = Number(el.dataset.id);
        const note = items.find((x) => x.id === id);
        el.addEventListener('click', (e) => {
            if (e.target.closest('.note-acts')) return;
            openEdit(note);
        });
        el.querySelectorAll('.cdot').forEach((d) => d.addEventListener('click', (e) => {
            e.stopPropagation();
            setColor(note, d.dataset.color);
        }));
        el.querySelector('[data-act=del]').addEventListener('click', (e) => { e.stopPropagation(); del(note); });
    });
}

async function setColor(n, c) {
    if (colorOf(n.color) === c) return;
    await one.sql('UPDATE notes SET color = ?, updated_at = ? WHERE id = ?', [c, Date.now(), n.id]);
    load();
}

async function del(n) {
    if (!confirm('删除这条笔记?')) return;
    await one.sql('DELETE FROM notes WHERE id = ?', [n.id]);
    load();
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
        await one.sql('UPDATE notes SET content = ?, color = ?, pinned = ?, updated_at = ? WHERE id = ?', [content, form.color, pinned, now, editingId]);
    } else {
        await one.sql('INSERT INTO notes (content, color, pinned, created_at, updated_at) VALUES (?, ?, ?, ?, ?)', [content, form.color, pinned, now, now]);
    }
    closeModal();
    load();
}

$('#btn-new').addEventListener('click', openCreate);
$('#btn-cancel').addEventListener('click', closeModal);
$('#btn-save').addEventListener('click', save);
$('#f-content').addEventListener('input', (e) => { form.content = e.target.value; });
$('#f-pin').addEventListener('click', () => { form.pinned = !form.pinned; $('#f-pin').classList.toggle('on', form.pinned); });
$('#modal').addEventListener('click', (e) => { if (e.target === $('#modal')) closeModal(); });

load();
