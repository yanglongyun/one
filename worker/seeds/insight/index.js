// 启示种子小应用 —— 懒触发,纯前端。
// 每天一条 AI 给的实质建议:今天没有就手动点按钮开一个 agent 任务去读用户数据、综合结论、写回表。
const $ = (s) => document.querySelector(s);
const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (m) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[m]));

// 本地日期 YYYY-MM-DD
function localDay(d = new Date()) {
    const p = (n) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}
// 人类可读日期,如 "7月3日 · 周四"
function prettyDate(day) {
    const [y, m, dd] = day.split('-').map(Number);
    const d = new Date(y, m - 1, dd);
    const w = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'][d.getDay()];
    return `${m}月${dd}日 · ${w}`;
}

const TODAY = localDay();
let generating = false;

async function ensureTable() {
    await one.sql("CREATE TABLE IF NOT EXISTS app_insight (id INTEGER PRIMARY KEY AUTOINCREMENT, day TEXT NOT NULL, content TEXT NOT NULL DEFAULT '', created_at INTEGER NOT NULL)");
}

async function latestForDay(day) {
    const rows = await one.sql('SELECT * FROM app_insight WHERE day = ? ORDER BY id DESC LIMIT 1', [day]);
    return (rows && rows[0]) || null;
}

// ── 渲染:今日卡的三种状态 ──
function renderToday(row) {
    const el = $('#today');
    el.classList.remove('empty');
    el.innerHTML = `
        <div class="card-bulb">💡</div>
        <div class="insight-text">${esc(row.content)}</div>
        <div class="today-foot">
            <span class="stamp">✨ 今天的启示</span>
            <button class="btn btn-ghost" id="btn-regen">重新生成</button>
        </div>`;
    $('#btn-regen').addEventListener('click', regenerate);
}

// 今日还没有启示:手动触发(点按钮才生成,不自动跑)
function renderEmpty() {
    const el = $('#today');
    el.classList.add('empty');
    el.innerHTML = `
            <div class="gen-bulb">💡</div>
            <div class="gen-title">今天的启示还没生成</div>
            <div class="empty-sub">让 one 读一遍你最近的任务、记忆和待办,给你一条今天最值得做的建议。</div>
            <button class="btn btn-amber" id="btn-gen">生成今天的启示</button>`;
    $('#btn-gen').addEventListener('click', generate);
}

function renderGenerating() {
    const el = $('#today');
    el.classList.remove('empty');
    el.innerHTML = `
        <div class="gen-card">
            <span class="gen-bulb">💡</span>
            <div class="gen-title">正在为你生成今天的启示…</div>
            <div class="gen-sub">正在翻看你最近的任务、笔记与偏好,想一条真正有用的建议。<br>这可能要几十秒,别关掉这里。</div>
            <div class="gen-dots"><span></span><span></span><span></span></div>
        </div>`;
}

function renderError() {
    const el = $('#today');
    el.classList.remove('empty');
    el.innerHTML = `
        <div class="err-card">
            <div class="err-icon">🌥️</div>
            <div class="err-title">这次没能生成出来</div>
            <div class="err-sub">可能是数据还太少,或者临时开小差了。</div>
            <button class="btn btn-amber" id="btn-retry">点此重试</button>
        </div>`;
    $('#btn-retry').addEventListener('click', generate);
}

// ── 生成:开一个 agent 任务,让它读数据、综合、把结论写回表 ──
async function generate() {
    if (generating) return;
    generating = true;
    renderGenerating();
    const day = TODAY;
    const now = Date.now();
    try {
        await one.agent(`你是这位用户的私人顾问。今天是 ${day}。用 sql 查询他的数据——读 tasks 表(最近/在跑的任务与状态)、memories 表(他的长期偏好和事实)、notes 表、app_todo 表(待办清单,若存在),了解他最近在做什么、卡在哪、在意什么。综合出【今天最值得推进的一件事】,给一条具体、可执行、有洞察的建议(80到160字,像个真正懂他的朋友,别空泛别说教、别客套)。最后用一句 sql 把结论写进表:INSERT INTO app_insight (day, content, created_at) VALUES ('${day}', '这里放你的建议(注意转义单引号)', ${now})。只写这一条。`);
    } catch (e) {
        // agent 抛错也照样去查一遍,它可能已经写成功了
        console.warn('agent error', e);
    }
    generating = false;

    const row = await latestForDay(day);
    if (row) {
        renderToday(row);
    } else {
        renderError();
    }
    loadHistory();
}

async function regenerate() {
    if (generating) return;
    await one.sql('DELETE FROM app_insight WHERE day = ?', [TODAY]);
    await generate();
}

// ── 历史:每天取最新一条,按 day DESC(排除今天) ──
async function loadHistory() {
    const rows = await one.sql(
        'SELECT t.day, t.content FROM app_insight t ' +
        'JOIN (SELECT day, MAX(id) AS mid FROM app_insight GROUP BY day) g ON t.id = g.mid ' +
        'WHERE t.day <> ? ORDER BY t.day DESC',
        [TODAY]
    );
    const list = rows || [];
    $('#history-wrap').style.display = list.length ? 'block' : 'none';
    $('#history-list').innerHTML = list.map((r) => `
        <div class="h-card">
            <div class="h-day">💡 ${esc(prettyDate(r.day))}</div>
            <div class="h-text">${esc(r.content)}</div>
        </div>`).join('');
}

async function init() {
    $('#today-date').textContent = prettyDate(TODAY);
    await ensureTable();
    const today = await latestForDay(TODAY);
    loadHistory();
    if (today) {
        renderToday(today);
    } else {
        renderEmpty();
    }
}

init();
