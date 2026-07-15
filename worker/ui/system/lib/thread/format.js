import { marked } from 'marked';

// 净化渲染:聊天/任务正文来自模型、工具结果、被抓取的网页/文件 —— 属不可信内容,
// 却经 v-html 渲染在持有 one_token 的主站源里。这里在 marked 层面掐断 XSS:
//   · 丢弃 markdown 里的原始 HTML(<script>/<img onerror> 等一律不落地)
//   · 中和 javascript:/data:/vbscript: 链接与图片地址
// 正常 markdown 格式(粗体/列表/代码/普通链接)不受影响。
const SAFE_RENDERER = new marked.Renderer();
SAFE_RENDERER.html = () => '';
const badUrl = (u) => /^\s*(javascript|data|vbscript):/i.test(String(u || ''));
const baseLink = SAFE_RENDERER.link.bind(SAFE_RENDERER);
SAFE_RENDERER.link = (token) => {
    if (badUrl(token.href)) token.href = '#';
    return baseLink(token);
};
const baseImage = SAFE_RENDERER.image.bind(SAFE_RENDERER);
SAFE_RENDERER.image = (token) => {
    if (badUrl(token.href)) token.href = '';
    return baseImage(token);
};

marked.setOptions({ breaks: true, gfm: true, renderer: SAFE_RENDERER });

// 与 worker/server/system/agent/tools.js 的工具集对齐(只暴露的那几个;未知名回退原名)。
const TOOL_LABELS = {
    sql: '数据库',
    shell: '终端命令',
    computer_screen: 'Mac 读屏',
    computer_click: 'Mac 点击',
    computer_type: 'Mac 输入',
    computer_key: 'Mac 按键',
    computer_open_app: 'Mac 打开',
    android_screen: '安卓读屏',
    android_tap: '安卓点击',
    android_type: '安卓输入',
    android_swipe: '安卓滑动',
    android_key: '安卓按键',
    android_open_app: '安卓打开',
    chrome_debugger: '浏览器',
};

function toolLabel(name) {
    return TOOL_LABELS[name] || name;
}

function toolSubtitle(row) {
    const args = row.args || {};
    // summary 是大部分设备工具的面向用户摘要;其余工具退回各自的关键参数。
    return args.summary || args.command || args.query || args.method || args.url || args.text || args.name || '';
}

function renderMd(value) {
    return marked.parse(String(value || ''));
}

function fmtArgs(value) {
    // summary 已在外层标题展示,展开的「输入」里去掉它,只留真正的参数。
    const { summary, ...rest } = value && typeof value === 'object' ? value : {};
    try {
        return JSON.stringify(rest, null, 2);
    } catch {
        return String(value);
    }
}

// 「输出」:结果常是 JSON.stringify 出来压成一行的对象,能解析就缩进展示,否则原样。
function fmtResult(value) {
    if (value == null || value === '') return '';
    if (typeof value === 'object') {
        try { return JSON.stringify(value, null, 2); } catch { return String(value); }
    }
    const str = String(value);
    try { return JSON.stringify(JSON.parse(str), null, 2); } catch { return str; }
}

function fmtTime(value) {
    if (!value) return '';
    const date = new Date(value);
    const diff = Date.now() - value;
    if (diff < 60000) return '刚刚';
    if (diff < 3600000) return `${Math.floor(diff / 60000)} 分钟前`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)} 小时前`;
    return `${date.getMonth() + 1}/${date.getDate()}`;
}

export { fmtArgs, fmtResult, fmtTime, renderMd, toolLabel, toolSubtitle };
