-- 出厂种子小应用(由 seeds/build.mjs 生成,勿手改;apps.id 自增,codes.app_id 用 slug 子查询定位)
INSERT INTO apps (slug,name,icon,color,description,created_at,updated_at) VALUES ('notes','笔记','📝','yellow','随手记 —— 出厂自带的种子小应用',1783051262373,1783051262373);
INSERT INTO codes (app_id,filename,content,version,created_at) VALUES ((SELECT id FROM apps WHERE slug='notes'),'index.html','<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>笔记</title>
<link rel="stylesheet" href="./index.css">
</head>
<body>
    <main class="page">
        <div class="page-inner">
            <div id="empty" class="notes-empty" style="display:none">
                <div class="e-icon">📝</div>
                <div class="e-title">还没有笔记</div>
                <div class="e-sub">随手记点什么 —— 灵感、清单、AI 帮你整理的内容都放这</div>
            </div>
            <div id="board" class="board"></div>
        </div>
    </main>

    <button class="fab" id="btn-new" title="新建笔记"><span class="i-plus"></span></button>

    <!-- 新建 / 编辑 -->
    <div id="modal" class="modal-mask" style="display:none">
        <div class="modal">
            <div class="modal-title" id="modal-title">新建笔记</div>
            <div class="field">
                <label>正文 <span class="hint">第一行会当作标题</span></label>
                <textarea id="f-content" class="input" rows="5" placeholder="写点什么…"></textarea>
            </div>
            <div class="field" style="margin-top:12px">
                <label>颜色</label>
                <div class="row" id="f-colors" style="gap:10px"></div>
            </div>
            <div class="pin-row">
                <span>置顶 <span class="hint">排在最前面</span></span>
                <button type="button" class="toggle blue" id="f-pin" aria-label="置顶"></button>
            </div>
            <div class="modal-foot">
                <button class="btn btn-plain" id="btn-cancel">取消</button>
                <button class="btn btn-primary" id="btn-save">保存</button>
            </div>
        </div>
    </div>

    <!-- index.js 由平台在建表(index.sql)之后自动加载,应用无需自行引入 -->
</body>
</html>
',1,1783051262373);
INSERT INTO codes (app_id,filename,content,version,created_at) VALUES ((SELECT id FROM apps WHERE slug='notes'),'index.css','/* 笔记种子小应用 —— 晴空软糖(iframe 隔离,token 内联,与系统一致) */
:root {
    --ink: #22354e; --ink2: #54688a; --ink-3: #8ba1bb; --ink-4: #aebfd4;
    --candy: #3b9bf5; --candy-deep: #2b86e4; --candy-soft: #e2f0fe;
    --candy-ring: rgba(59,155,245,.22);
    --well: #f2f7fd; --line-soft: rgba(140,170,205,.14);
    --bad: #ee5d68; --bad-soft: #fde9eb;
    --paper-yellow: #fff6d9; --paper-yellow-deep: #eab308;
    --paper-blue: #e3f0fe; --paper-blue-deep: #3b9bf5;
    --paper-green: #e0f6ea; --paper-green-deep: #26b573;
    --paper-pink: #fde9f0; --paper-pink-deep: #ec6a9c;
    --paper-plain: #ffffff; --paper-plain-deep: #8ba1bb;
    --shadow-s: 0 1px 2px rgba(48,88,140,.06), 0 3px 10px -2px rgba(48,88,140,.08);
    --shadow-m: 0 2px 4px rgba(48,88,140,.05), 0 12px 28px -8px rgba(48,88,140,.14);
    --shadow-l: 0 4px 8px rgba(48,88,140,.06), 0 24px 56px -12px rgba(48,88,140,.22);
    --gloss: inset 0 1.5px 0 rgba(255,255,255,.5);
    --r-l: 22px;
    --spring: cubic-bezier(.34,1.3,.5,1);
    --ease: cubic-bezier(.25,.6,.3,1);
    --sans: -apple-system, BlinkMacSystemFont, "SF Pro SC", "PingFang SC", "Helvetica Neue", "Noto Sans SC", sans-serif;
}
* { box-sizing: border-box; }
html, body { height: 100%; }
body {
    margin: 0; font-family: var(--sans); font-size: 14px; color: var(--ink);
    -webkit-font-smoothing: antialiased;
    background: linear-gradient(180deg, #d5eafd 0%, #e9f4fe 34%, #f7fbff 78%);
    background-attachment: fixed;
}
button { font: inherit; color: inherit; border: 0; background: none; padding: 0; cursor: pointer; }
textarea { font: inherit; color: var(--ink); }


.i-plus { width: 20px; height: 20px; position: relative; display: inline-block; }
.i-plus::before, .i-plus::after { content: ""; position: absolute; background: currentColor; border-radius: 2px; }
.i-plus::before { left: 9px; top: 3px; width: 2px; height: 14px; }
.i-plus::after { top: 9px; left: 3px; height: 2px; width: 14px; }

.page { padding: 20px 20px 96px; }
.page-inner { max-width: 800px; margin: 0 auto; }

/* 两列瀑布 + 糖果纸便签 */
.board { columns: 2; column-gap: 12px; }
.note { break-inside: avoid; -webkit-column-break-inside: avoid; margin-bottom: 12px; position: relative;
    border-radius: var(--r-l); border: 1px solid rgba(255,255,255,.65); box-shadow: var(--shadow-s);
    padding: 16px 16px 11px; cursor: pointer; transition: transform .2s var(--spring), box-shadow .2s var(--ease); }
.note:hover { transform: translateY(-2px); box-shadow: var(--shadow-m); }
.note-yellow { background: var(--paper-yellow); }
.note-blue { background: var(--paper-blue); }
.note-green { background: var(--paper-green); }
.note-pink { background: var(--paper-pink); }
.note-plain { background: var(--paper-plain); }
.note .pin { position: absolute; top: 10px; right: 12px; font-size: 14px; transform: rotate(20deg); }
.note-title { font-size: 14px; font-weight: 700; padding-right: 22px; white-space: pre-wrap; word-break: break-word; }
.note-body { margin-top: 8px; font-size: 12.5px; line-height: 1.75; color: var(--ink2); }
.note-body p { margin: 0 0 7px; white-space: pre-wrap; word-break: break-word; }
.note-body p:last-child { margin-bottom: 0; }
.note-foot { margin-top: 10px; display: flex; align-items: center; gap: 8px; min-height: 26px; }
.note-foot .time { flex: 1; font-size: 11px; font-weight: 500; color: var(--ink-3); }
.note-acts { display: flex; align-items: center; gap: 6px; opacity: 0; transition: opacity .15s; }
.note:hover .note-acts { opacity: 1; }

.cdot { width: 14px; height: 14px; border-radius: 99px; border: 1.5px solid; cursor: pointer;
    transition: transform .15s var(--spring); }
.cdot:hover { transform: scale(1.2); }
.cdot-yellow { background: var(--paper-yellow); border-color: var(--paper-yellow-deep); }
.cdot-blue { background: var(--paper-blue); border-color: var(--paper-blue-deep); }
.cdot-green { background: var(--paper-green); border-color: var(--paper-green-deep); }
.cdot-pink { background: var(--paper-pink); border-color: var(--paper-pink-deep); }
.cdot-plain { background: var(--paper-plain); border-color: var(--paper-plain-deep); }
.cdot.on { box-shadow: 0 0 0 2px rgba(255,255,255,.95), 0 0 0 3.5px var(--candy); }
.cdot.lg { width: 24px; height: 24px; }
.note-trash { width: 26px; height: 26px; border-radius: 8px; display: grid; place-items: center;
    color: var(--ink-3); font-size: 13px; transition: all .15s; }
.note-trash:hover { background: var(--bad-soft); color: var(--bad); }

.notes-empty { padding: 56px 20px; text-align: center; }
.notes-empty .e-icon { font-size: 34px; margin-bottom: 8px; }
.notes-empty .e-title { font-size: 15px; font-weight: 800; margin-bottom: 4px; }
.notes-empty .e-sub { font-size: 13px; line-height: 1.7; color: var(--ink-3); }

/* 弹窗 */
.modal-mask { position: fixed; inset: 0; z-index: 95; background: rgba(50,85,130,.28);
    backdrop-filter: blur(6px); -webkit-backdrop-filter: blur(6px);
    display: grid; place-items: center; padding: 20px; animation: fade .18s ease-out; }
@keyframes fade { from { opacity: 0; } }
.modal { width: min(460px,100%); background: #fff; border-radius: 24px; box-shadow: var(--shadow-l);
    padding: 22px; animation: pop-in .26s var(--spring); }
@keyframes pop-in { from { opacity: 0; transform: scale(.92) translateY(-6px); } }
.modal-title { font-size: 16px; font-weight: 800; margin-bottom: 16px; }
.modal-foot { display: flex; justify-content: flex-end; gap: 8px; margin-top: 18px; }
.field { display: flex; flex-direction: column; gap: 6px; }
.field label { font-size: 12px; font-weight: 700; color: var(--ink2); }
.hint { font-weight: 500; color: var(--ink-4); }
.input { width: 100%; border: 1.5px solid rgba(140,170,205,.22); border-radius: 13px; background: #fff;
    padding: 10px 13px; font-size: 13.5px; outline: 0; resize: vertical; line-height: 1.6;
    transition: border-color .15s, box-shadow .15s; }
.input:focus { border-color: var(--candy); box-shadow: 0 0 0 3px var(--candy-ring); }
.row { display: flex; align-items: center; }
.pin-row { display: flex; align-items: center; justify-content: space-between; margin-top: 16px;
    background: var(--well); border-radius: 14px; padding: 12px 14px; font-size: 13px; font-weight: 600; }
.pin-row .hint { font-size: 12px; margin-left: 4px; color: var(--ink-3); }
.toggle { position: relative; width: 44px; height: 26px; border-radius: 99px; background: #dbe5f0;
    transition: background .2s; flex-shrink: 0; box-shadow: inset 0 1px 3px rgba(48,88,140,.15); }
.toggle::after { content: ""; position: absolute; top: 3px; left: 3px; width: 20px; height: 20px;
    border-radius: 99px; background: #fff; box-shadow: 0 2px 5px rgba(48,88,140,.3); transition: left .2s var(--spring); }
.toggle.on { background: linear-gradient(160deg,#58aef8,var(--candy-deep)); }
.toggle.on::after { left: 21px; }

@media (max-width: 640px) { .board { columns: 1; } .page { padding: 16px 12px 96px; } }
@media (hover: none), (max-width: 640px) { .note-acts { opacity: .7; } }

/* 浮动新建按钮(小应用无顶栏,动作走 FAB)*/
.fab {
    position: fixed; right: 20px; bottom: 20px; z-index: 30;
    width: 52px; height: 52px; border-radius: 99px;
    display: grid; place-items: center; color: #fff;
    background: linear-gradient(160deg, #58aef8, var(--candy-deep));
    box-shadow: var(--gloss), 0 8px 20px -4px rgba(43,134,228,.6);
    transition: transform .18s var(--spring), filter .15s;
}
.fab:hover { filter: brightness(1.05); transform: translateY(-2px); }
.fab:active { transform: scale(.94); }
',1,1783051262373);
INSERT INTO codes (app_id,filename,content,version,created_at) VALUES ((SELECT id FROM apps WHERE slug='notes'),'index.js','// 笔记种子小应用 —— 用 window.one.sql 自建并读写 app_notes 表(小应用数据表统一 app_ 前缀)。
const $ = (s) => document.querySelector(s);
const COLORS = [''yellow'', ''blue'', ''green'', ''pink'', ''plain''];
const colorOf = (c) => (COLORS.includes(c) ? c : ''plain'');
const esc = (s) => String(s ?? '''').replace(/[&<>"]/g, (m) => ({ ''&'': ''&amp;'', ''<'': ''&lt;'', ''>'': ''&gt;'', ''"'': ''&quot;'' }[m]));

let editingId = null;
let form = { content: '''', color: ''yellow'', pinned: false };

const titleOf = (n) => (n.content || '''').split(''\n'')[0].trim();
const bodyLines = (n) => (n.content || '''').split(''\n'').slice(1).map((s) => s.trim()).filter(Boolean);

function fmtTime(ts) {
    const t = Number(ts) || 0;
    if (!t) return '''';
    const diff = Date.now() - t;
    if (diff < 60000) return ''刚刚'';
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
    if (reset) { offset = 0; noMore = false; seen.clear(); $(''#board'').innerHTML = ''''; }
    const rows = (await one.sql(
        ''SELECT id, content, color, pinned, created_at, updated_at FROM app_notes ORDER BY pinned DESC, id DESC LIMIT ? OFFSET ?'',
        [PAGE, offset],
    )) || [];
    rows.forEach((n) => seen.set(n.id, n));
    offset += rows.length;
    if (rows.length < PAGE) noMore = true;
    appendCards(rows);
    $(''#empty'').style.display = seen.size ? ''none'' : ''block'';
    loading = false;
}

function noteHtml(n) {
    const c = colorOf(n.color);
    const body = bodyLines(n).map((l) => `<p>${esc(l)}</p>`).join('''');
    const dots = COLORS.map((cc) => `<button class="cdot cdot-${cc}${c === cc ? '' on'' : ''''}" data-color="${cc}"></button>`).join('''');
    return `<div class="note note-${c}" data-id="${n.id}">
        ${n.pinned ? ''<span class="pin">📌</span>'' : ''''}
        <div class="note-title">${esc(titleOf(n))}</div>
        ${body ? `<div class="note-body">${body}</div>` : ''''}
        <div class="note-foot">
            <span class="time">${fmtTime(n.updated_at || n.created_at)}</span>
            <span class="note-acts">${dots}<button class="note-trash" data-act="del">🗑</button></span>
        </div>
    </div>`;
}

function bindCard(el) {
    const note = seen.get(Number(el.dataset.id));
    if (!note) return;
    el.addEventListener(''click'', (e) => { if (e.target.closest(''.note-acts'')) return; openEdit(note); });
    el.querySelectorAll(''.cdot'').forEach((d) => d.addEventListener(''click'', (e) => { e.stopPropagation(); setColor(el, note, d.dataset.color); }));
    el.querySelector(''[data-act=del]'').addEventListener(''click'', (e) => { e.stopPropagation(); del(el, note); });
}

function appendCards(items) {
    const board = $(''#board'');
    const tmp = document.createElement(''div'');
    tmp.innerHTML = items.map(noteHtml).join('''');
    while (tmp.firstElementChild) {
        const el = tmp.firstElementChild;
        board.appendChild(el);
        bindCard(el);
    }
}

async function setColor(el, n, c) {
    if (colorOf(n.color) === c) return;
    await one.sql(''UPDATE app_notes SET color = ?, updated_at = ? WHERE id = ?'', [c, Date.now(), n.id]);
    n.color = c;
    el.className = ''note note-'' + colorOf(c);
    el.querySelectorAll(''.cdot'').forEach((d) => d.classList.toggle(''on'', d.dataset.color === c));
}

async function del(el, n) {
    if (!confirm(''删除这条笔记?'')) return;
    await one.sql(''DELETE FROM app_notes WHERE id = ?'', [n.id]);
    seen.delete(n.id);
    el.remove();
    $(''#empty'').style.display = seen.size ? ''none'' : ''block'';
}

// ── 弹窗 ──
function paintColorPicker() {
    $(''#f-colors'').innerHTML = COLORS.map((c) => `<button class="cdot lg cdot-${c}${form.color === c ? '' on'' : ''''}" data-color="${c}"></button>`).join('''');
    $(''#f-colors'').querySelectorAll(''.cdot'').forEach((d) => d.addEventListener(''click'', () => {
        form.color = d.dataset.color;
        paintColorPicker();
    }));
}
function openModal() {
    $(''#f-content'').value = form.content;
    $(''#f-pin'').classList.toggle(''on'', form.pinned);
    $(''#modal-title'').textContent = editingId ? ''编辑笔记'' : ''新建笔记'';
    paintColorPicker();
    $(''#modal'').style.display = ''grid'';
}
function openCreate() { editingId = null; form = { content: '''', color: ''yellow'', pinned: false }; openModal(); }
function openEdit(n) { editingId = n.id; form = { content: n.content || '''', color: colorOf(n.color), pinned: Boolean(n.pinned) }; openModal(); }
function closeModal() { $(''#modal'').style.display = ''none''; }

async function save() {
    const content = $(''#f-content'').value.trim();
    if (!content) return;
    const now = Date.now();
    const pinned = form.pinned ? 1 : 0;
    if (editingId) {
        await one.sql(''UPDATE app_notes SET content = ?, color = ?, pinned = ?, updated_at = ? WHERE id = ?'', [content, form.color, pinned, now, editingId]);
    } else {
        await one.sql(''INSERT INTO app_notes (content, color, pinned, created_at, updated_at) VALUES (?, ?, ?, ?, ?)'', [content, form.color, pinned, now, now]);
    }
    closeModal();
    load(true);
}

$(''#btn-new'').addEventListener(''click'', openCreate);
$(''#btn-cancel'').addEventListener(''click'', closeModal);
$(''#btn-save'').addEventListener(''click'', save);
$(''#f-content'').addEventListener(''input'', (e) => { form.content = e.target.value; });
$(''#f-pin'').addEventListener(''click'', () => { form.pinned = !form.pinned; $(''#f-pin'').classList.toggle(''on'', form.pinned); });
$(''#modal'').addEventListener(''click'', (e) => { if (e.target === $(''#modal'')) closeModal(); });

// 触底哨兵:滚到接近底部就自动加载下一页
const sentinel = document.createElement(''div'');
sentinel.style.cssText = ''height:1px'';
$(''#board'').insertAdjacentElement(''afterend'', sentinel);
new IntersectionObserver((entries) => {
    if (entries[0].isIntersecting && !loading && !noMore) load();
}, { rootMargin: ''240px'' }).observe(sentinel);

// 数据表 app_notes 由平台在打开应用前按 index.sql 建好,这里加载首页
load();
',1,1783051262373);
INSERT INTO codes (app_id,filename,content,version,created_at) VALUES ((SELECT id FROM apps WHERE slug='notes'),'index.sql','-- 笔记小应用数据表(平台打开应用时自动执行,幂等)
CREATE TABLE IF NOT EXISTS app_notes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  content TEXT NOT NULL DEFAULT '''',
  color TEXT NOT NULL DEFAULT ''yellow'',
  pinned INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);
',1,1783051262373);
INSERT INTO apps (slug,name,icon,color,description,created_at,updated_at) VALUES ('todo','待办','✅','green','勾选清单 —— 出厂自带的种子小应用',1783051262373,1783051262373);
INSERT INTO codes (app_id,filename,content,version,created_at) VALUES ((SELECT id FROM apps WHERE slug='todo'),'index.html','<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>待办</title>
<link rel="stylesheet" href="./index.css">
</head>
<body>
    <main class="page">
        <div class="page-inner">
            <!-- 常驻输入框:待办以「快速录入」为主,顶部回车即加比逐条开弹窗更顺手。FAB 只负责把焦点拉回这里。 -->
            <div class="quick">
                <span class="quick-dot">⭕</span>
                <input id="q-input" class="quick-input" type="text" placeholder="添加一项待办,回车保存…" autocomplete="off">
            </div>

            <div id="empty" class="todo-empty" style="display:none">
                <div class="e-icon">🌤️</div>
                <div class="e-title">还没有待办</div>
                <div class="e-sub">在上面输入点什么 —— 记下要做的事,点条目上的 ✨ 还能让 AI 帮你拆成小步骤</div>
            </div>

            <section id="sec-active" class="section" style="display:none">
                <div class="section-head"><span class="section-title">进行中</span><span class="section-count" id="c-active">0</span></div>
                <div id="list-active" class="list"></div>
            </section>

            <section id="sec-done" class="section" style="display:none">
                <div class="section-head"><span class="section-title">已完成</span><span class="section-count" id="c-done">0</span></div>
                <div id="list-done" class="list"></div>
            </section>
        </div>
    </main>

    <button class="fab" id="btn-new" title="添加待办"><span class="i-plus"></span></button>

    <!-- index.js 由平台在建表(index.sql)之后自动加载,应用无需自行引入 -->
</body>
</html>
',1,1783051262373);
INSERT INTO codes (app_id,filename,content,version,created_at) VALUES ((SELECT id FROM apps WHERE slug='todo'),'index.css','/* 待办种子小应用 —— 晴空软糖(iframe 隔离,token 内联,与笔记一致) */
:root {
    --ink: #22354e; --ink2: #54688a; --ink-3: #8ba1bb; --ink-4: #aebfd4;
    --candy: #3b9bf5; --candy-deep: #2b86e4; --candy-soft: #e2f0fe;
    --candy-ring: rgba(59,155,245,.22);
    --well: #f2f7fd; --line-soft: rgba(140,170,205,.14);
    --bad: #ee5d68; --bad-soft: #fde9eb;
    --paper-yellow: #fff6d9; --paper-yellow-deep: #eab308;
    --paper-blue: #e3f0fe; --paper-blue-deep: #3b9bf5;
    --paper-green: #e0f6ea; --paper-green-deep: #26b573;
    --paper-pink: #fde9f0; --paper-pink-deep: #ec6a9c;
    --paper-plain: #ffffff; --paper-plain-deep: #8ba1bb;
    --shadow-s: 0 1px 2px rgba(48,88,140,.06), 0 3px 10px -2px rgba(48,88,140,.08);
    --shadow-m: 0 2px 4px rgba(48,88,140,.05), 0 12px 28px -8px rgba(48,88,140,.14);
    --shadow-l: 0 4px 8px rgba(48,88,140,.06), 0 24px 56px -12px rgba(48,88,140,.22);
    --gloss: inset 0 1.5px 0 rgba(255,255,255,.5);
    --r-l: 22px;
    --spring: cubic-bezier(.34,1.3,.5,1);
    --ease: cubic-bezier(.25,.6,.3,1);
    --sans: -apple-system, BlinkMacSystemFont, "SF Pro SC", "PingFang SC", "Helvetica Neue", "Noto Sans SC", sans-serif;
}
* { box-sizing: border-box; }
html, body { height: 100%; }
body {
    margin: 0; font-family: var(--sans); font-size: 14px; color: var(--ink);
    -webkit-font-smoothing: antialiased;
    background: linear-gradient(180deg, #d5eafd 0%, #e9f4fe 34%, #f7fbff 78%);
    background-attachment: fixed;
}
button { font: inherit; color: inherit; border: 0; background: none; padding: 0; cursor: pointer; }
input { font: inherit; color: var(--ink); }


.i-plus { width: 20px; height: 20px; position: relative; display: inline-block; }
.i-plus::before, .i-plus::after { content: ""; position: absolute; background: currentColor; border-radius: 2px; }
.i-plus::before { left: 9px; top: 3px; width: 2px; height: 14px; }
.i-plus::after { top: 9px; left: 3px; height: 2px; width: 14px; }

.page { padding: 20px 20px 96px; }
.page-inner { max-width: 640px; margin: 0 auto; }

/* 顶部常驻录入框 —— 糖果纸质感,回车即加 */
.quick { display: flex; align-items: center; gap: 10px; margin-bottom: 18px;
    background: #fff; border: 1px solid rgba(255,255,255,.65); border-radius: var(--r-l);
    box-shadow: var(--shadow-s); padding: 4px 16px 4px 15px; transition: box-shadow .15s var(--ease); }
.quick:focus-within { box-shadow: var(--shadow-m), 0 0 0 3px var(--candy-ring); }
.quick-dot { font-size: 16px; line-height: 1; flex-shrink: 0; }
.quick-input { flex: 1; border: 0; outline: 0; background: none; padding: 13px 0; font-size: 14px; }
.quick-input::placeholder { color: var(--ink-4); }

/* 分组 */
.section { margin-bottom: 20px; }
.section-head { display: flex; align-items: center; gap: 8px; padding: 0 6px 8px; }
.section-title { font-size: 12px; font-weight: 800; letter-spacing: .04em; color: var(--ink2); text-transform: uppercase; }
.section-count { font-size: 11px; font-weight: 700; color: var(--ink-3); background: var(--well);
    border-radius: 99px; padding: 2px 9px; min-width: 22px; text-align: center; }

/* 列表行 —— 每行一张软糖便签 */
.list { display: flex; flex-direction: column; gap: 8px; }
.item { display: flex; align-items: center; gap: 12px; position: relative;
    background: var(--paper-plain); border-radius: 16px; border: 1px solid rgba(255,255,255,.65);
    box-shadow: var(--shadow-s); padding: 13px 14px;
    transition: transform .18s var(--spring), box-shadow .18s var(--ease); }
.item:hover { transform: translateY(-1px); box-shadow: var(--shadow-m); }

/* 圆形复选框 */
.check { width: 22px; height: 22px; border-radius: 99px; flex-shrink: 0; cursor: pointer;
    border: 2px solid var(--ink-4); background: #fff; display: grid; place-items: center;
    color: #fff; font-size: 12px; transition: all .18s var(--spring); }
.check:hover { border-color: var(--candy); transform: scale(1.1); }
.check.on { border-color: var(--paper-green-deep);
    background: linear-gradient(160deg, #4fd08c, var(--paper-green-deep)); }
.check.on::after { content: "✓"; font-weight: 900; }

.item-text { flex: 1; font-size: 14px; line-height: 1.5; word-break: break-word; white-space: pre-wrap; }
.item.done .item-text { color: var(--ink-3); text-decoration: line-through; text-decoration-color: var(--ink-4); }

.item-trash { width: 28px; height: 28px; border-radius: 9px; flex-shrink: 0; display: grid; place-items: center;
    color: var(--ink-3); font-size: 13px; opacity: 0; transition: opacity .15s, background .15s, color .15s; }
.item:hover .item-trash { opacity: 1; }
.item-trash:hover { background: var(--bad-soft); color: var(--bad); }

/* AI 拆解按钮 + 子步骤 */
.item-split { width: 28px; height: 28px; border-radius: 9px; flex-shrink: 0; display: grid; place-items: center;
    font-size: 13px; opacity: 0; transition: opacity .15s, background .15s, transform .15s var(--spring); }
.item:hover .item-split { opacity: 1; }
.item-split:hover { background: var(--candy-soft); transform: scale(1.08); }
.item-split.busy { opacity: 1; animation: split-spin 1.1s linear infinite; pointer-events: none; }
@keyframes split-spin { to { transform: rotate(360deg); } }
.sub-count { flex-shrink: 0; font-size: 11px; font-weight: 700; color: var(--candy-deep);
    background: var(--candy-soft); border-radius: 99px; padding: 2px 8px; }
.sub-list { display: flex; flex-direction: column; gap: 6px; margin: -2px 0 2px 26px; }
.item.sub { padding: 9px 12px; border-radius: 13px; background: rgba(255,255,255,.72); box-shadow: none;
    border: 1px solid var(--line-soft); }
.item.sub:hover { transform: none; box-shadow: var(--shadow-s); }
.item.sub .check { width: 19px; height: 19px; font-size: 10px; }
.item.sub .item-text { font-size: 13px; }

.todo-empty { padding: 40px 20px 56px; text-align: center; }
.todo-empty .e-icon { font-size: 34px; margin-bottom: 8px; }
.todo-empty .e-title { font-size: 15px; font-weight: 800; margin-bottom: 4px; }
.todo-empty .e-sub { font-size: 13px; line-height: 1.7; color: var(--ink-3); }

@media (max-width: 640px) { .page { padding: 16px 12px 96px; } }
@media (hover: none), (max-width: 640px) { .item-trash, .item-split { opacity: .55; } }

/* 浮动新建按钮(小应用无顶栏,动作走 FAB)*/
.fab {
    position: fixed; right: 20px; bottom: 20px; z-index: 30;
    width: 52px; height: 52px; border-radius: 99px;
    display: grid; place-items: center; color: #fff;
    background: linear-gradient(160deg, #58aef8, var(--candy-deep));
    box-shadow: var(--gloss), 0 8px 20px -4px rgba(43,134,228,.6);
    transition: transform .18s var(--spring), filter .15s;
}
.fab:hover { filter: brightness(1.05); transform: translateY(-2px); }
.fab:active { transform: scale(.94); }
',1,1783051262373);
INSERT INTO codes (app_id,filename,content,version,created_at) VALUES ((SELECT id FROM apps WHERE slug='todo'),'index.js','// 待办种子小应用 —— 用 window.one.sql 直读写 app_todo 表,证明小应用平台能承载真实功能。
// 支持 AI 拆解:一条待办用 one.llm 拆成若干子步骤(parent_id 关联),子任务缩进挂在父任务下。
const $ = (s) => document.querySelector(s);
const esc = (s) => String(s ?? '''').replace(/[&<>"]/g, (m) => ({ ''&'': ''&amp;'', ''<'': ''&lt;'', ''>'': ''&gt;'', ''"'': ''&quot;'' }[m]));

const splitting = new Set(); // 正在拆解中的待办 id

async function init() {
    // 表由平台在打开应用前按 index.sql 建好,这里直接加载
    await load();
}

let byId = {};
async function load() {
    const rows = (await one.sql(''SELECT id, text, done, parent_id, created_at, done_at FROM app_todo ORDER BY id ASC'')) || [];
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
    const on = t.done ? '' on'' : '''';
    const doneCls = t.done ? '' done'' : '''';
    const sub = kids ? '''' : '' sub'';
    const children = kids?.[t.id] || [];
    const doneKids = children.filter((k) => k.done).length;
    const busy = splitting.has(t.id);
    const splitBtn = (!kids || t.done) ? '''' : `<button class="item-split${busy ? '' busy'' : ''''}" data-act="split" title="AI 拆解成小步骤">${busy ? ''⏳'' : ''✨''}</button>`;
    const count = children.length ? `<span class="sub-count">${doneKids}/${children.length}</span>` : '''';
    return `<div class="item${doneCls}${sub}" data-id="${t.id}">
        <button class="check${on}" data-act="toggle" aria-label="切换完成"></button>
        <div class="item-text">${esc(t.text)}</div>
        ${count}${splitBtn}
        <button class="item-trash" data-act="del" aria-label="删除">🗑</button>
    </div>` + (children.length ? `<div class="sub-list">${children.map((k) => itemHtml(k, null)).join('''')}</div>` : '''');
}

const DONE_PAGE = 20;
let doneShown = DONE_PAGE;         // 已完成:先渲染这么多,「加载更多」逐批 +20(进行中始终全显)
let last = { active: [], done: [], kids: {} };

function render(active, done, kids) {
    last = { active, done, kids };
    const total = active.length + done.length;
    $(''#empty'').style.display = total ? ''none'' : ''block'';

    $(''#sec-active'').style.display = active.length ? ''block'' : ''none'';
    $(''#c-active'').textContent = active.length;
    $(''#list-active'').innerHTML = active.map((t) => itemHtml(t, kids)).join('''');

    $(''#sec-done'').style.display = done.length ? ''block'' : ''none'';
    $(''#c-done'').textContent = done.length;
    const rest = done.length - doneShown;
    $(''#list-done'').innerHTML = done.slice(0, doneShown).map((t) => itemHtml(t, kids)).join('''')
        + (rest > 0
            ? `<button data-act="more" style="display:block;width:100%;margin-top:8px;padding:11px;border:0;background:transparent;color:#3b9bf5;font:inherit;font-weight:600;cursor:pointer">加载更多已完成(还有 ${rest} 条)</button>`
            : '''');

    // 事件绑定
    document.querySelectorAll(''.item'').forEach((el) => {
        const t = byId[Number(el.dataset.id)];
        if (!t) return;
        el.querySelector(''[data-act=toggle]'')?.addEventListener(''click'', () => toggle(t));
        el.querySelector(''[data-act=del]'')?.addEventListener(''click'', () => del(t));
        el.querySelector(''[data-act=split]'')?.addEventListener(''click'', () => split(t));
    });
    $(''#list-done'').querySelector(''[data-act=more]'')?.addEventListener(''click'', () => {
        doneShown += DONE_PAGE;
        render(last.active, last.done, last.kids);
    });
}

async function add(text) {
    const v = String(text || '''').trim();
    if (!v) return;
    await one.sql(''INSERT INTO app_todo (text, done, created_at) VALUES (?, 0, ?)'', [v, Date.now()]);
    await load();
}

async function toggle(t) {
    if (t.done) {
        await one.sql(''UPDATE app_todo SET done = 0, done_at = NULL WHERE id = ?'', [t.id]);
    } else {
        await one.sql(''UPDATE app_todo SET done = 1, done_at = ? WHERE id = ?'', [Date.now(), t.id]);
    }
    await load();
}

async function del(t) {
    if (!confirm(''删除这项待办?'' + (t.parent_id ? '''' : ''(它拆出的子步骤会一并删除)''))) return;
    await one.sql(''DELETE FROM app_todo WHERE id = ? OR parent_id = ?'', [t.id, t.id]);
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
            { system: ''你是任务拆解助手。只输出合法 JSON 数组,例如 ["第一步","第二步"]。'' }
        );
        const m = String(raw || '''').match(/\[[\s\S]*\]/);
        const steps = m ? JSON.parse(m[0]).map((s) => String(s).trim()).filter(Boolean) : [];
        if (!steps.length) throw new Error(''empty'');
        const now = Date.now();
        for (const s of steps.slice(0, 8)) {
            await one.sql(''INSERT INTO app_todo (text, done, parent_id, created_at) VALUES (?, 0, ?, ?)'', [s, t.id, now]);
        }
    } catch (e) {
        console.warn(''split failed'', e);
        alert(''这次没拆出来,再点一次试试。'');
    } finally {
        splitting.delete(t.id);
        await load();
    }
}

// ── 录入 ──
const input = $(''#q-input'');
input.addEventListener(''keydown'', async (e) => {
    if (e.key === ''Enter'') {
        e.preventDefault();
        const v = input.value;
        input.value = '''';
        await add(v);
    }
});
// FAB 把焦点拉回顶部输入框(移动端也顺手滚到可见处)
$(''#btn-new'').addEventListener(''click'', () => {
    input.scrollIntoView({ behavior: ''smooth'', block: ''start'' });
    input.focus();
});

init();
',1,1783051262373);
INSERT INTO codes (app_id,filename,content,version,created_at) VALUES ((SELECT id FROM apps WHERE slug='todo'),'index.sql','-- 待办小应用数据表(平台打开应用时自动执行,幂等)
CREATE TABLE IF NOT EXISTS app_todo (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  text TEXT NOT NULL DEFAULT '''',
  done INTEGER NOT NULL DEFAULT 0,
  parent_id INTEGER,
  created_at INTEGER NOT NULL,
  done_at INTEGER
);
-- 老库补列:新装的会因 parent_id 已存在而报错,平台逐条容错跳过
ALTER TABLE app_todo ADD COLUMN parent_id INTEGER;
',1,1783051262373);
INSERT INTO apps (slug,name,icon,color,description,created_at,updated_at) VALUES ('love','恋爱','💕','pink','虚拟恋人陪伴对话 —— 出厂自带的种子小应用',1783051262373,1783051262373);
INSERT INTO codes (app_id,filename,content,version,created_at) VALUES ((SELECT id FROM apps WHERE slug='love'),'index.html','<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>恋爱</title>
<link rel="stylesheet" href="./index.css">
</head>
<body>
    <!-- 聊天区 -->
    <main class="chat" id="chat">
        <div class="chat-inner" id="stream"></div>
    </main>

    <!-- 输入区 -->
    <div class="composer-wrap">
        <div class="composer">
            <textarea id="input" rows="1" placeholder="和 TA 说点什么…"></textarea>
            <button class="send" id="send" title="发送"><span class="i-send"></span></button>
        </div>
    </div>

    <!-- 首次设定 TA:两位预置角色,二选一即开聊 -->
    <div id="setup" class="modal-mask" style="display:none">
        <div class="modal">
            <div class="setup-heart">💕</div>
            <div class="modal-title" style="text-align:center">选一个 TA</div>
            <div class="setup-sub">两位都在等你,点一下就开始聊。</div>
            <div class="pick" id="pick"></div>
        </div>
    </div>

    <!-- index.js 由平台在建表(index.sql)之后自动加载,应用无需自行引入 -->
</body>
</html>
',1,1783051262373);
INSERT INTO codes (app_id,filename,content,version,created_at) VALUES ((SELECT id FROM apps WHERE slug='love'),'index.css','/* 恋爱种子小应用 —— 虚拟恋人陪伴对话(晴空软糖 + 胭脂点缀) */
:root {
    --ink: #22354e; --ink2: #54688a; --ink-3: #8ba1bb; --ink-4: #aebfd4;
    --candy: #3b9bf5; --candy-deep: #2b86e4; --candy-soft: #e2f0fe;
    --candy-ring: rgba(59,155,245,.22);
    --well: #f2f7fd; --line-soft: rgba(140,170,205,.14);
    --rose: #ec6a9c; --rose-deep: #d94f86; --rose-soft: #fde9f0;
    --shadow-s: 0 1px 2px rgba(48,88,140,.06), 0 3px 10px -2px rgba(48,88,140,.08);
    --shadow-m: 0 2px 4px rgba(48,88,140,.05), 0 12px 28px -8px rgba(48,88,140,.14);
    --shadow-l: 0 4px 8px rgba(48,88,140,.06), 0 24px 56px -12px rgba(48,88,140,.22);
    --gloss: inset 0 1.5px 0 rgba(255,255,255,.5);
    --spring: cubic-bezier(.34,1.3,.5,1);
    --ease: cubic-bezier(.25,.6,.3,1);
    --sans: -apple-system, BlinkMacSystemFont, "SF Pro SC", "PingFang SC", "Helvetica Neue", "Noto Sans SC", sans-serif;
}
* { box-sizing: border-box; }
html, body { height: 100%; }
body {
    margin: 0; font-family: var(--sans); font-size: 14px; color: var(--ink);
    -webkit-font-smoothing: antialiased;
    display: flex; flex-direction: column; height: 100vh;
    background:
        radial-gradient(900px 400px at 80% -8%, rgba(253,233,240,.7), transparent 60%),
        linear-gradient(180deg, #eaf2fd 0%, #f3f7fd 40%, #f7fbff 78%);
    background-attachment: fixed;
}
button { font: inherit; color: inherit; border: 0; background: none; padding: 0; cursor: pointer; }
textarea { font: inherit; color: var(--ink); }

/* ── 聊天流 ── */
.chat { flex: 1; min-height: 0; overflow-y: auto; }
.chat-inner { max-width: 720px; margin: 0 auto; padding: 20px 16px 8px; display: flex; flex-direction: column; }

.msg { display: flex; margin: 5px 0; max-width: 82%; }
.msg.me { align-self: flex-end; }
.msg.ta { align-self: flex-start; gap: 9px; }
.msg .avatar { flex-shrink: 0; width: 30px; height: 30px; border-radius: 50%; margin-top: 2px;
    display: grid; place-items: center; font-size: 15px;
    background: linear-gradient(150deg, #ffa9c9, var(--rose)); box-shadow: var(--gloss), 0 3px 8px -2px rgba(217,79,134,.4); }
.msg .col { min-width: 0; }
.bubble { padding: 10px 14px; font-size: 14px; line-height: 1.7; white-space: pre-wrap; word-break: break-word; }
.msg.me .bubble { background: linear-gradient(160deg, #55acf8, var(--candy-deep)); color: #fff;
    border-radius: 20px 20px 6px 20px; box-shadow: var(--gloss), 0 8px 18px -6px rgba(43,134,228,.5); }
.msg.ta .bubble { background: #fff; border: 1px solid var(--rose-soft);
    border-radius: 6px 20px 20px 20px; box-shadow: var(--shadow-s); }
.ta-name { font-size: 11px; font-weight: 700; color: var(--rose-deep); margin: 0 0 4px 2px; }

/* 打字中 */
.typing { display: inline-flex; gap: 5px; padding: 13px 15px; }
.typing i { width: 7px; height: 7px; border-radius: 50%; background: var(--rose); opacity: .5;
    animation: blink 1.2s infinite; }
.typing i:nth-child(2) { animation-delay: .2s; }
.typing i:nth-child(3) { animation-delay: .4s; }
@keyframes blink { 0%,60%,100% { opacity: .3; transform: translateY(0); } 30% { opacity: 1; transform: translateY(-3px); } }

/* 空状态 */
.hello { text-align: center; padding: 48px 24px; align-self: stretch; }
.hello .h-face { font-size: 40px; margin-bottom: 10px; }
.hello .h-title { font-size: 15px; font-weight: 800; margin-bottom: 6px; }
.hello .h-sub { font-size: 13px; line-height: 1.8; color: var(--ink-3); max-width: 300px; margin: 0 auto; }

/* ── 输入区 ── */
.composer-wrap { flex-shrink: 0; padding: 8px 16px calc(14px + env(safe-area-inset-bottom)); }
.composer { max-width: 720px; margin: 0 auto; display: flex; align-items: flex-end; gap: 8px;
    background: rgba(255,255,255,.9); backdrop-filter: blur(16px); -webkit-backdrop-filter: blur(16px);
    border: 1px solid rgba(255,255,255,.9); border-radius: 24px; box-shadow: var(--shadow-m);
    padding: 7px 8px 7px 16px; transition: box-shadow .2s; }
.composer:focus-within { box-shadow: var(--shadow-l), 0 0 0 3px var(--rose-soft); }
.composer textarea { flex: 1; min-width: 0; border: 0; outline: 0; background: transparent; resize: none;
    padding: 7px 0; font-size: 15px; line-height: 1.5; max-height: 120px; }
.composer textarea::placeholder { color: var(--ink-4); }
.send { flex-shrink: 0; width: 38px; height: 38px; border-radius: 50%; display: grid; place-items: center;
    color: #fff; background: linear-gradient(160deg, #ff9dc0, var(--rose-deep));
    box-shadow: var(--gloss), 0 5px 12px -3px rgba(217,79,134,.55); transition: transform .18s var(--spring), filter .15s; }
.send:hover { filter: brightness(1.05); transform: translateY(-1px); }
.send:active { transform: scale(.92); }
.send:disabled { opacity: .4; pointer-events: none; }
.i-send { width: 20px; height: 20px; position: relative; display: inline-block; }
.i-send::before { content: ""; position: absolute; left: 9px; top: 3px; width: 2px; height: 14px; background: currentColor; border-radius: 2px; }
.i-send::after { content: ""; position: absolute; left: 4px; top: 5px; width: 8px; height: 8px;
    border-left: 2px solid currentColor; border-top: 2px solid currentColor; transform: rotate(45deg); border-radius: 2px 0 0 0; }

/* ── 设定弹窗 ── */
.modal-mask { position: fixed; inset: 0; z-index: 95; background: rgba(50,85,130,.28);
    backdrop-filter: blur(6px); -webkit-backdrop-filter: blur(6px);
    display: grid; place-items: center; padding: 20px; animation: fade .18s ease-out; }
@keyframes fade { from { opacity: 0; } }
.modal { width: min(420px,100%); background: #fff; border-radius: 24px; box-shadow: var(--shadow-l);
    padding: 24px 22px; animation: pop-in .26s var(--spring); }
@keyframes pop-in { from { opacity: 0; transform: scale(.92) translateY(-6px); } }
.setup-heart { font-size: 40px; text-align: center; margin-bottom: 6px; }
.modal-title { font-size: 17px; font-weight: 800; }
.setup-sub { font-size: 12.5px; color: var(--ink-3); text-align: center; margin-top: 6px; line-height: 1.6; }
/* 角色二选一卡片 */
.pick { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-top: 18px; }
.pick-card { display: flex; flex-direction: column; align-items: center; gap: 3px;
    border-radius: 18px; background: var(--well); padding: 20px 12px 16px;
    border: 2px solid transparent;
    transition: transform .18s var(--spring), background .15s, border-color .15s, box-shadow .15s; }
.pick-card:hover { transform: translateY(-2px); background: var(--rose-soft);
    border-color: rgba(236,106,156,.4); box-shadow: var(--shadow-m); }
.pick-card:active { transform: scale(.96); }
.pick-card .p-face { font-size: 36px; line-height: 1; }
.pick-card .p-name { font-size: 15px; font-weight: 800; margin-top: 8px; }
.pick-card .p-tag { font-size: 12px; color: var(--ink-3); }
@media (max-width: 640px) { .chat-inner { padding: 16px 12px 6px; } .msg { max-width: 90%; } }
',1,1783051262373);
INSERT INTO codes (app_id,filename,content,version,created_at) VALUES ((SELECT id FROM apps WHERE slug='love'),'index.js','// 恋爱种子小应用 —— 虚拟恋人陪伴对话。
// 用 one.sql 存对话与人设;回复走 one.agent(),让 TA 自己用 sql 工具查历史/记忆再作答,
// responseFormat: {type:''json_object''} 约束它只能回一个 {"reply": "..."} 的 JSON 对象。
const $ = (s) => document.querySelector(s);
const esc = (s) => String(s ?? '''').replace(/[&<>"]/g, (m) => ({ ''&'': ''&amp;'', ''<'': ''&lt;'', ''>'': ''&gt;'', ''"'': ''&quot;'' }[m]));

// 预置两位 TA,二选一即开聊
const PRESETS = [
    { name: ''苏晚'', face: ''🌸'', tagline: ''温柔体贴的她'', persona: ''温柔、体贴、有点小俏皮的女生,说话轻声细语,总在关心我的感受,偶尔也会撒娇'' },
    { name: ''陆沉'', face: ''🌙'', tagline: ''沉稳内敛的他'', persona: ''成熟沉稳、有主见的男生,像可靠的港湾,话不多但句句暖,偶尔幽默一下'' },
];

const PAGE = 30;
let cfg = null;          // { name, persona }
let msgs = [];           // { id?, role:''me''|''ta'', content }
let sending = false;
let oldestId = null, hasMore = false, loadingOlder = false;

async function init() {
    // 表由平台在打开应用前按 index.sql 建好,这里直接读数据
    const rows = await one.sql(''SELECT name, persona FROM app_love_config WHERE id = 1'');
    cfg = rows && rows[0] ? rows[0] : null;
    if (!cfg) { openSetup(); return; }
    // 只取最近 PAGE 条(倒序取回再翻正);更早的上滑再加载,不一次性全捞
    const recent = (await one.sql(''SELECT id, role, content FROM app_love_msgs ORDER BY id DESC LIMIT ?'', [PAGE])) || [];
    msgs = recent.reverse();
    oldestId = msgs.length ? msgs[0].id : null;
    hasMore = recent.length === PAGE;
    render();
}

// 上滑到顶:加载更早的一页,并保持视口锚在原来那条消息上(不跳)
async function loadOlder() {
    if (loadingOlder || !hasMore || oldestId == null) return;
    loadingOlder = true;
    const older = (await one.sql(''SELECT id, role, content FROM app_love_msgs WHERE id < ? ORDER BY id DESC LIMIT ?'', [oldestId, PAGE])) || [];
    if (older.length) {
        const chat = $(''#chat'');
        const prevH = chat.scrollHeight, prevTop = chat.scrollTop;
        msgs = older.reverse().concat(msgs);
        oldestId = msgs[0].id;
        paint();
        chat.scrollTop = chat.scrollHeight - prevH + prevTop;
    }
    hasMore = older.length === PAGE;
    loadingOlder = false;
}

// ── 设定 TA:两张角色卡,点谁就是谁 ──
function openSetup() {
    $(''#pick'').innerHTML = PRESETS.map((p, i) => `
        <button class="pick-card" data-i="${i}">
            <span class="p-face">${p.face}</span>
            <span class="p-name">${esc(p.name)}</span>
            <span class="p-tag">${esc(p.tagline)}</span>
        </button>`).join('''');
    $(''#pick'').querySelectorAll(''.pick-card'').forEach((c) => c.addEventListener(''click'', () => startLove(PRESETS[Number(c.dataset.i)])));
    $(''#setup'').style.display = ''grid'';
}
async function startLove(preset) {
    const { name, persona } = preset;
    await one.sql(''INSERT OR REPLACE INTO app_love_config (id, name, persona, created_at) VALUES (1, ?, ?, ?)'', [name, persona, Date.now()]);
    cfg = { name, persona };
    $(''#setup'').style.display = ''none'';
    // 开场白:让 TA 主动打个招呼
    msgs = [];
    render();
    await reply(`(我们刚认识,你第一次和我打招呼。用「${name}」的身份,温暖、自然地说一两句开场白,让我想继续聊下去。)`, { hidden: true });
}

// ── 渲染 ──
function avatarFace() { return PRESETS.find((p) => p.name === cfg?.name)?.face || ''💕''; }
// 只渲染,不动滚动(上滑加载更早时用它,配合手动锚定滚动)
function paint() {
    const stream = $(''#stream'');
    if (!msgs.length && !sending) {
        stream.innerHTML = `<div class="hello"><div class="h-face">💗</div>
            <div class="h-title">${esc(cfg?.name || ''TA'')} 在等你</div>
            <div class="h-sub">说点什么吧 —— 今天累不累、想 TA 了、还是只想有人陪你聊聊。</div></div>`;
        return;
    }
    stream.innerHTML = msgs.map((m) => {
        if (m.role === ''me'') return `<div class="msg me"><div class="bubble">${esc(m.content)}</div></div>`;
        return `<div class="msg ta"><span class="avatar">${avatarFace()}</span><div class="col"><div class="ta-name">${esc(cfg?.name || ''TA'')}</div><div class="bubble">${esc(m.content)}</div></div></div>`;
    }).join('''') + (sending ? `<div class="msg ta"><span class="avatar">${avatarFace()}</span><div class="col"><div class="ta-name">${esc(cfg?.name || ''TA'')}</div><div class="typing"><i></i><i></i><i></i></div></div></div>` : '''');
}
// 渲染并滚到底(初始 / 新消息用)
function render() { paint(); toBottom(); }
function toBottom() { const c = $(''#chat''); requestAnimationFrame(() => { c.scrollTop = c.scrollHeight; }); }

// ── 发送 & 回复:走 agent 任务,让 TA 自己查历史/记忆,只允许它回一个 JSON 对象 ──
function agentPrompt(userText, { hidden }) {
    const say = hidden
        ? `我们刚认识,你第一次和我打招呼。用「${cfg.name}」的身份,温暖、自然地说一两句开场白,让我想继续聊下去。`
        : `请你以「${cfg.name}」的第一人称,自然地回我这句:「${userText}」`;
    return `你现在要扮演「${cfg.name}」——我的恋人,人设:${cfg.persona}。我们在一段亲密关系里。\n`
        + `开口前先用 sql 工具查一下 app_love_msgs 表最近的记录(ORDER BY id DESC LIMIT 30),看看我们最近聊了什么、你现在的情绪走向;如果觉得有必要,也可以查 memories 表看看你还记得我的哪些事。查完就直接作答,不用把查询过程告诉我。\n`
        + `${say}\n`
        + `要求:像真正的恋人那样有温度,会关心我、会顺着人设撒娇或调侃;绝不要像 AI 助手那样客套、罗列要点或说「作为AI」;简短自然,一般一两句,像发微信一样,可以带一点点 emoji 但别滥用。\n`
        + `只输出一个 JSON 对象:{"reply": "你要说的话(注意转义引号和换行)"},不要输出任何其它文字。`;
}

async function reply(userText, { hidden = false } = {}) {
    if (!hidden) {
        msgs.push({ role: ''me'', content: userText });
        await one.sql(''INSERT INTO app_love_msgs (role, content, at) VALUES (?, ?, ?)'', [''me'', userText, Date.now()]);
    }
    sending = true; render();
    try {
        const task = await one.agent(agentPrompt(userText, { hidden }), {
            title: `跟${cfg.name}聊天`,
            responseFormat: { type: ''json_object'' },
        });
        if (task.status !== ''done'') throw new Error(task.status);
        const text = String(task.json?.reply || '''').trim() || ''……(我一时不知道说什么,但我在)'';
        msgs.push({ role: ''ta'', content: text });
        await one.sql(''INSERT INTO app_love_msgs (role, content, at) VALUES (?, ?, ?)'', [''ta'', text, Date.now()]);
    } catch (e) {
        console.warn(''love agent failed'', e);
        msgs.push({ role: ''ta'', content: ''(信号好像不太好…等等再和我说好吗)'' });
    } finally {
        sending = false; render();
    }
}

async function send() {
    const ta = $(''#input'');
    const text = ta.value.trim();
    if (!text || sending) return;
    ta.value = ''''; ta.style.height = ''auto'';
    await reply(text);
}

// ── 事件 ──
$(''#chat'').addEventListener(''scroll'', () => { if ($(''#chat'').scrollTop < 80) loadOlder(); });
$(''#send'').addEventListener(''click'', send);
$(''#input'').addEventListener(''keydown'', (e) => { if (e.key === ''Enter'' && !e.shiftKey && !e.isComposing) { e.preventDefault(); send(); } });
$(''#input'').addEventListener(''input'', (e) => { const el = e.target; el.style.height = ''auto''; el.style.height = Math.min(el.scrollHeight, 120) + ''px''; });

init();
',1,1783051262373);
INSERT INTO codes (app_id,filename,content,version,created_at) VALUES ((SELECT id FROM apps WHERE slug='love'),'index.sql','-- 恋爱小应用数据表(平台打开应用时自动执行,幂等)
CREATE TABLE IF NOT EXISTS app_love_config (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  name TEXT NOT NULL DEFAULT '''',
  persona TEXT NOT NULL DEFAULT '''',
  created_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS app_love_msgs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  role TEXT NOT NULL,
  content TEXT NOT NULL DEFAULT '''',
  at INTEGER NOT NULL
);
',1,1783051262373);
INSERT INTO apps (slug,name,icon,color,description,created_at,updated_at) VALUES ('insight','启示','💡','orange','每天一条 AI 给你的下一步建议',1783051262373,1783051262373);
INSERT INTO codes (app_id,filename,content,version,created_at) VALUES ((SELECT id FROM apps WHERE slug='insight'),'index.html','<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>启示</title>
<link rel="stylesheet" href="./index.css">
</head>
<body>
    <main class="page">
        <div class="page-inner">
            <div class="hero">
                <div class="hero-eyebrow">💡 今日启示</div>
                <div class="hero-date" id="today-date"></div>
            </div>

            <!-- 今日卡:根据状态切换内容 -->
            <div id="today" class="today-card">
                <!-- JS 填充 -->
            </div>

            <!-- 历史 -->
            <div id="history-wrap" class="history" style="display:none">
                <div class="history-title">过往启示</div>
                <div id="history-list" class="history-list"></div>
            </div>
        </div>
    </main>

    <!-- index.js 由平台在建表(index.sql)之后自动加载,应用无需自行引入 -->
</body>
</html>
',1,1783051262373);
INSERT INTO codes (app_id,filename,content,version,created_at) VALUES ((SELECT id FROM apps WHERE slug='insight'),'index.css','/* 启示种子小应用 —— 晴空软糖(iframe 隔离,token 内联,与系统一致) */
:root {
    --ink: #22354e; --ink2: #54688a; --ink-3: #8ba1bb; --ink-4: #aebfd4;
    --candy: #3b9bf5; --candy-deep: #2b86e4; --candy-soft: #e2f0fe;
    --candy-ring: rgba(59,155,245,.22);
    --well: #f2f7fd; --line-soft: rgba(140,170,205,.14);
    --bad: #ee5d68; --bad-soft: #fde9eb;
    --paper-yellow: #fff6d9; --paper-yellow-deep: #eab308;
    --paper-blue: #e3f0fe; --paper-blue-deep: #3b9bf5;
    --paper-green: #e0f6ea; --paper-green-deep: #26b573;
    --paper-pink: #fde9f0; --paper-pink-deep: #ec6a9c;
    --paper-plain: #ffffff; --paper-plain-deep: #8ba1bb;
    --shadow-s: 0 1px 2px rgba(48,88,140,.06), 0 3px 10px -2px rgba(48,88,140,.08);
    --shadow-m: 0 2px 4px rgba(48,88,140,.05), 0 12px 28px -8px rgba(48,88,140,.14);
    --shadow-l: 0 4px 8px rgba(48,88,140,.06), 0 24px 56px -12px rgba(48,88,140,.22);
    --gloss: inset 0 1.5px 0 rgba(255,255,255,.5);
    --r-l: 22px;
    --spring: cubic-bezier(.34,1.3,.5,1);
    --ease: cubic-bezier(.25,.6,.3,1);
    --sans: -apple-system, BlinkMacSystemFont, "SF Pro SC", "PingFang SC", "Helvetica Neue", "Noto Sans SC", sans-serif;
    /* 启示专属:暖金 / 琥珀点睛(灯泡点亮) */
    --amber: #f0a92e; --amber-deep: #d98613; --amber-soft: #fff3d6;
    --amber-ring: rgba(217,134,19,.20);
}
* { box-sizing: border-box; }
html, body { height: 100%; }
body {
    margin: 0; font-family: var(--sans); font-size: 14px; color: var(--ink);
    -webkit-font-smoothing: antialiased;
    background: linear-gradient(180deg, #d5eafd 0%, #e9f4fe 34%, #f7fbff 78%);
    background-attachment: fixed;
}
button { font: inherit; color: inherit; border: 0; background: none; padding: 0; cursor: pointer; }
textarea { font: inherit; color: var(--ink); }

.page { padding: 20px 20px 96px; }
.page-inner { max-width: 620px; margin: 0 auto; }

/* ── 顶部标题区 ── */
.hero { text-align: center; padding: 8px 0 20px; }
.hero-eyebrow { font-size: 13px; font-weight: 800; letter-spacing: .3px;
    color: var(--amber-deep); }
.hero-date { margin-top: 4px; font-size: 12.5px; font-weight: 600; color: var(--ink-3); }

/* ── 今日启示大卡 ── */
.today-card {
    position: relative; border-radius: var(--r-l);
    background: linear-gradient(165deg, #fffdf6 0%, #fff8e6 100%);
    border: 1px solid rgba(240,169,46,.28);
    box-shadow: var(--gloss), 0 4px 10px -2px rgba(217,134,19,.10), 0 20px 44px -14px rgba(217,134,19,.22);
    padding: 26px 24px 20px;
    animation: pop-in .3s var(--spring);
}
.today-card .card-bulb { font-size: 26px; line-height: 1; margin-bottom: 12px; }
.insight-text { font-size: 16px; line-height: 1.85; color: var(--ink);
    white-space: pre-wrap; word-break: break-word; font-weight: 500; }
.today-foot { margin-top: 20px; display: flex; align-items: center; gap: 10px;
    border-top: 1px solid rgba(240,169,46,.16); padding-top: 14px; }
.today-foot .stamp { flex: 1; font-size: 11.5px; font-weight: 600; color: var(--amber-deep); }

/* 琥珀主按钮 / 幽灵按钮 */
.btn { border-radius: 12px; padding: 8px 15px; font-size: 13px; font-weight: 700;
    transition: transform .15s var(--spring), filter .15s, background .15s; }
.btn:active { transform: scale(.95); }
.btn-amber { color: #fff; background: linear-gradient(160deg, #f6bd52, var(--amber-deep));
    box-shadow: var(--gloss), 0 6px 14px -4px rgba(217,134,19,.5); }
.btn-amber:hover { filter: brightness(1.04); }
.btn-ghost { color: var(--amber-deep); background: rgba(240,169,46,.10); }
.btn-ghost:hover { background: rgba(240,169,46,.18); }

/* ── 加载态:呼吸 / 脉动 ── */
.gen-card { text-align: center; padding: 44px 24px; }
.gen-bulb { font-size: 40px; line-height: 1; display: inline-block;
    animation: bulb-pulse 1.6s var(--ease) infinite; }
@keyframes bulb-pulse {
    0%, 100% { transform: scale(1); filter: drop-shadow(0 0 0 rgba(240,169,46,0)); opacity: .7; }
    50% { transform: scale(1.14); filter: drop-shadow(0 0 14px rgba(240,169,46,.6)); opacity: 1; }
}
.gen-title { margin-top: 16px; font-size: 15px; font-weight: 800; color: var(--ink); }
.gen-sub { margin-top: 6px; font-size: 12.5px; line-height: 1.7; color: var(--ink-3); }
.gen-dots { margin-top: 16px; display: flex; justify-content: center; gap: 6px; }
.gen-dots span { width: 7px; height: 7px; border-radius: 99px; background: var(--amber);
    animation: dot-bounce 1.2s var(--ease) infinite; }
.gen-dots span:nth-child(2) { animation-delay: .18s; }
.gen-dots span:nth-child(3) { animation-delay: .36s; }
@keyframes dot-bounce {
    0%, 100% { transform: translateY(0); opacity: .35; }
    45% { transform: translateY(-6px); opacity: 1; }
}

/* ── 失败态 ── */
.err-card { text-align: center; padding: 40px 24px; }
.err-icon { font-size: 34px; }
.err-title { margin-top: 10px; font-size: 15px; font-weight: 800; }
.err-sub { margin-top: 5px; font-size: 12.5px; line-height: 1.7; color: var(--ink-3); }
.err-card .btn { margin-top: 16px; }

/* ── 历史 ── */
.history { margin-top: 30px; }
.history-title { font-size: 12.5px; font-weight: 800; color: var(--ink-3);
    letter-spacing: .4px; margin: 0 4px 12px; }
.history-list { display: flex; flex-direction: column; gap: 12px; }
.h-card {
    border-radius: 18px; background: #fff; border: 1px solid rgba(255,255,255,.7);
    box-shadow: var(--shadow-s); padding: 15px 17px;
    transition: transform .2s var(--spring), box-shadow .2s var(--ease);
}
.h-card:hover { transform: translateY(-2px); box-shadow: var(--shadow-m); }
.h-day { font-size: 11.5px; font-weight: 700; color: var(--amber-deep); margin-bottom: 6px; }
.h-text { font-size: 13.5px; line-height: 1.75; color: var(--ink2);
    white-space: pre-wrap; word-break: break-word; }

@media (max-width: 640px) {
    .page { padding: 16px 12px 96px; }
    .insight-text { font-size: 15px; }
}

/* 今日空态(手动生成引导)*/
.today-card.empty { text-align: center; }
.today-card.empty .gen-bulb { font-size: 30px; margin-bottom: 10px; }
.today-card .empty-sub { font-size: 13px; line-height: 1.8; color: var(--ink-3); max-width: 300px; margin: 6px auto 16px; }
',1,1783051262373);
INSERT INTO codes (app_id,filename,content,version,created_at) VALUES ((SELECT id FROM apps WHERE slug='insight'),'index.js','// 启示种子小应用 —— 懒触发,纯前端。
// 每天一条 AI 给的实质建议:今天没有就手动点按钮开一个 agent 任务去读用户数据、综合结论、写回表。
const $ = (s) => document.querySelector(s);
const esc = (s) => String(s ?? '''').replace(/[&<>"]/g, (m) => ({ ''&'': ''&amp;'', ''<'': ''&lt;'', ''>'': ''&gt;'', ''"'': ''&quot;'' }[m]));

// 本地日期 YYYY-MM-DD
function localDay(d = new Date()) {
    const p = (n) => String(n).padStart(2, ''0'');
    return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}
// 人类可读日期,如 "7月3日 · 周四"
function prettyDate(day) {
    const [y, m, dd] = day.split(''-'').map(Number);
    const d = new Date(y, m - 1, dd);
    const w = [''周日'', ''周一'', ''周二'', ''周三'', ''周四'', ''周五'', ''周六''][d.getDay()];
    return `${m}月${dd}日 · ${w}`;
}

const TODAY = localDay();
let generating = false;

async function latestForDay(day) {
    const rows = await one.sql(''SELECT * FROM app_insight WHERE day = ? ORDER BY id DESC LIMIT 1'', [day]);
    return (rows && rows[0]) || null;
}

// ── 渲染:今日卡的三种状态 ──
function renderToday(row) {
    const el = $(''#today'');
    el.classList.remove(''empty'');
    el.innerHTML = `
        <div class="card-bulb">💡</div>
        <div class="insight-text">${esc(row.content)}</div>
        <div class="today-foot">
            <span class="stamp">✨ 今天的启示</span>
            <button class="btn btn-ghost" id="btn-regen">重新生成</button>
        </div>`;
    $(''#btn-regen'').addEventListener(''click'', regenerate);
}

// 今日还没有启示:手动触发(点按钮才生成,不自动跑)
function renderEmpty() {
    const el = $(''#today'');
    el.classList.add(''empty'');
    el.innerHTML = `
            <div class="gen-bulb">💡</div>
            <div class="gen-title">今天的启示还没生成</div>
            <div class="empty-sub">让 one 读一遍你最近的任务、记忆和待办,给你一条今天最值得做的建议。</div>
            <button class="btn btn-amber" id="btn-gen">生成今天的启示</button>`;
    $(''#btn-gen'').addEventListener(''click'', generate);
}

function renderGenerating() {
    const el = $(''#today'');
    el.classList.remove(''empty'');
    el.innerHTML = `
        <div class="gen-card">
            <span class="gen-bulb">💡</span>
            <div class="gen-title">正在为你生成今天的启示…</div>
            <div class="gen-sub">正在翻看你最近的任务、笔记与偏好,想一条真正有用的建议。<br>这可能要几十秒,别关掉这里。</div>
            <div class="gen-dots"><span></span><span></span><span></span></div>
        </div>`;
}

function renderError() {
    const el = $(''#today'');
    el.classList.remove(''empty'');
    el.innerHTML = `
        <div class="err-card">
            <div class="err-icon">🌥️</div>
            <div class="err-title">这次没能生成出来</div>
            <div class="err-sub">可能是数据还太少,或者临时开小差了。</div>
            <button class="btn btn-amber" id="btn-retry">点此重试</button>
        </div>`;
    $(''#btn-retry'').addEventListener(''click'', generate);
}

// ── 生成:开一个 agent 任务,让它读数据、综合、把结论写回表 ──
async function generate() {
    if (generating) return;
    generating = true;
    renderGenerating();
    const day = TODAY;
    const now = Date.now();
    try {
        await one.agent(`你是这位用户的私人顾问。今天是 ${day}。用 sql 查询他的数据——读 tasks 表(最近/在跑的任务与状态)、memories 表(他的长期偏好和事实)、app_notes 表(笔记小应用的数据)、app_todo 表(待办清单,若存在),了解他最近在做什么、卡在哪、在意什么。综合出【今天最值得推进的一件事】,给一条具体、可执行、有洞察的建议(80到160字,像个真正懂他的朋友,别空泛别说教、别客套)。最后用一句 sql 把结论写进表:INSERT INTO app_insight (day, content, created_at) VALUES (''${day}'', ''这里放你的建议(注意转义单引号)'', ${now})。只写这一条。`);
    } catch (e) {
        // agent 抛错也照样去查一遍,它可能已经写成功了
        console.warn(''agent error'', e);
    }
    generating = false;

    const row = await latestForDay(day);
    if (row) {
        renderToday(row);
    } else {
        renderError();
    }
    loadHistory(true);
}

async function regenerate() {
    if (generating) return;
    await one.sql(''DELETE FROM app_insight WHERE day = ?'', [TODAY]);
    await generate();
}

// ── 历史:每天取最新一条,按 day DESC(排除今天),每批 30 天,「加载更多」逐批取 ──
const HIST_PAGE = 30;
let histOffset = 0, histNoMore = false, histLoading = false;

function histCard(r) {
    return `<div class="h-card"><div class="h-day">💡 ${esc(prettyDate(r.day))}</div><div class="h-text">${esc(r.content)}</div></div>`;
}

async function loadHistory(reset = false) {
    if (histLoading) return;
    histLoading = true;
    if (reset) { histOffset = 0; histNoMore = false; $(''#history-list'').innerHTML = ''''; }
    const rows = (await one.sql(
        ''SELECT t.day, t.content FROM app_insight t '' +
        ''JOIN (SELECT day, MAX(id) AS mid FROM app_insight GROUP BY day) g ON t.id = g.mid '' +
        ''WHERE t.day <> ? ORDER BY t.day DESC LIMIT ? OFFSET ?'',
        [TODAY, HIST_PAGE, histOffset],
    )) || [];
    histOffset += rows.length;
    if (rows.length < HIST_PAGE) histNoMore = true;
    $(''#more-history'')?.remove();
    $(''#history-list'').insertAdjacentHTML(''beforeend'', rows.map(histCard).join(''''));
    $(''#history-wrap'').style.display = $(''#history-list'').children.length ? ''block'' : ''none'';
    if (!histNoMore) {
        const btn = document.createElement(''button'');
        btn.id = ''more-history'';
        btn.textContent = ''加载更多历史'';
        btn.style.cssText = ''display:block;width:100%;margin-top:10px;padding:11px;border:0;background:transparent;color:#e0952b;font:inherit;font-weight:600;cursor:pointer'';
        btn.addEventListener(''click'', () => loadHistory());
        $(''#history-list'').insertAdjacentElement(''afterend'', btn);
    }
    histLoading = false;
}

async function init() {
    // 表 app_insight 由平台在打开应用前按 index.sql 建好
    $(''#today-date'').textContent = prettyDate(TODAY);
    const today = await latestForDay(TODAY);
    loadHistory(true);
    if (today) {
        renderToday(today);
    } else {
        renderEmpty();
    }
}

init();
',1,1783051262373);
INSERT INTO codes (app_id,filename,content,version,created_at) VALUES ((SELECT id FROM apps WHERE slug='insight'),'index.sql','-- 启示小应用数据表(平台打开应用时自动执行,幂等)
CREATE TABLE IF NOT EXISTS app_insight (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  day TEXT NOT NULL,
  content TEXT NOT NULL DEFAULT '''',
  created_at INTEGER NOT NULL
);
',1,1783051262373);
