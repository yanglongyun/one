// 恋爱种子小应用 —— 虚拟恋人陪伴对话。
// 用 one.sql 存对话与人设;回复走 one.agent(),让 TA 自己用 sql 工具查历史/记忆再作答,
// responseFormat: {type:'json_object'} 约束它只能回一个 {"reply": "..."} 的 JSON 对象。
const $ = (s) => document.querySelector(s);
const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (m) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[m]));

// 预置两位 TA,二选一即开聊
const PRESETS = [
    { name: '苏晚', face: '🌸', tagline: '温柔体贴的她', persona: '温柔、体贴、有点小俏皮的女生,说话轻声细语,总在关心我的感受,偶尔也会撒娇' },
    { name: '陆沉', face: '🌙', tagline: '沉稳内敛的他', persona: '成熟沉稳、有主见的男生,像可靠的港湾,话不多但句句暖,偶尔幽默一下' },
];

let cfg = null;          // { name, persona }
let msgs = [];           // { role:'me'|'ta', content }
let sending = false;

async function init() {
    await one.sql("CREATE TABLE IF NOT EXISTS app_love_config (id INTEGER PRIMARY KEY CHECK (id = 1), name TEXT NOT NULL DEFAULT '', persona TEXT NOT NULL DEFAULT '', created_at INTEGER NOT NULL)");
    await one.sql("CREATE TABLE IF NOT EXISTS app_love_msgs (id INTEGER PRIMARY KEY AUTOINCREMENT, role TEXT NOT NULL, content TEXT NOT NULL DEFAULT '', at INTEGER NOT NULL)");
    const rows = await one.sql('SELECT name, persona FROM app_love_config WHERE id = 1');
    cfg = rows && rows[0] ? rows[0] : null;
    if (!cfg) { openSetup(); return; }
    msgs = (await one.sql('SELECT role, content FROM app_love_msgs ORDER BY id ASC')) || [];
    render();
}

// ── 设定 TA:两张角色卡,点谁就是谁 ──
function openSetup() {
    $('#pick').innerHTML = PRESETS.map((p, i) => `
        <button class="pick-card" data-i="${i}">
            <span class="p-face">${p.face}</span>
            <span class="p-name">${esc(p.name)}</span>
            <span class="p-tag">${esc(p.tagline)}</span>
        </button>`).join('');
    $('#pick').querySelectorAll('.pick-card').forEach((c) => c.addEventListener('click', () => startLove(PRESETS[Number(c.dataset.i)])));
    $('#setup').style.display = 'grid';
}
async function startLove(preset) {
    const { name, persona } = preset;
    await one.sql('INSERT OR REPLACE INTO app_love_config (id, name, persona, created_at) VALUES (1, ?, ?, ?)', [name, persona, Date.now()]);
    cfg = { name, persona };
    $('#setup').style.display = 'none';
    // 开场白:让 TA 主动打个招呼
    msgs = [];
    render();
    await reply(`(我们刚认识,你第一次和我打招呼。用「${name}」的身份,温暖、自然地说一两句开场白,让我想继续聊下去。)`, { hidden: true });
}

// ── 渲染 ──
function avatarFace() { return PRESETS.find((p) => p.name === cfg?.name)?.face || '💕'; }
function render() {
    const stream = $('#stream');
    if (!msgs.length && !sending) {
        stream.innerHTML = `<div class="hello"><div class="h-face">💗</div>
            <div class="h-title">${esc(cfg?.name || 'TA')} 在等你</div>
            <div class="h-sub">说点什么吧 —— 今天累不累、想 TA 了、还是只想有人陪你聊聊。</div></div>`;
        return;
    }
    stream.innerHTML = msgs.map((m) => {
        if (m.role === 'me') return `<div class="msg me"><div class="bubble">${esc(m.content)}</div></div>`;
        return `<div class="msg ta"><span class="avatar">${avatarFace()}</span><div class="col"><div class="ta-name">${esc(cfg?.name || 'TA')}</div><div class="bubble">${esc(m.content)}</div></div></div>`;
    }).join('') + (sending ? `<div class="msg ta"><span class="avatar">${avatarFace()}</span><div class="col"><div class="ta-name">${esc(cfg?.name || 'TA')}</div><div class="typing"><i></i><i></i><i></i></div></div></div>` : '');
    toBottom();
}
function toBottom() { const c = $('#chat'); requestAnimationFrame(() => { c.scrollTop = c.scrollHeight; }); }

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
        msgs.push({ role: 'me', content: userText });
        await one.sql('INSERT INTO app_love_msgs (role, content, at) VALUES (?, ?, ?)', ['me', userText, Date.now()]);
    }
    sending = true; render();
    try {
        const task = await one.agent(agentPrompt(userText, { hidden }), {
            title: `跟${cfg.name}聊天`,
            responseFormat: { type: 'json_object' },
        });
        if (task.status !== 'done') throw new Error(task.status);
        const text = String(task.json?.reply || '').trim() || '……(我一时不知道说什么,但我在)';
        msgs.push({ role: 'ta', content: text });
        await one.sql('INSERT INTO app_love_msgs (role, content, at) VALUES (?, ?, ?)', ['ta', text, Date.now()]);
    } catch (e) {
        console.warn('love agent failed', e);
        msgs.push({ role: 'ta', content: '(信号好像不太好…等等再和我说好吗)' });
    } finally {
        sending = false; render();
    }
}

async function send() {
    const ta = $('#input');
    const text = ta.value.trim();
    if (!text || sending) return;
    ta.value = ''; ta.style.height = 'auto';
    await reply(text);
}

// ── 事件 ──
$('#send').addEventListener('click', send);
$('#input').addEventListener('keydown', (e) => { if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) { e.preventDefault(); send(); } });
$('#input').addEventListener('input', (e) => { const el = e.target; el.style.height = 'auto'; el.style.height = Math.min(el.scrollHeight, 120) + 'px'; });

init();
