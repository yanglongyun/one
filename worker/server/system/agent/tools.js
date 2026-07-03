// 工具定义(schema)。定义在云,执行分流见 loop.js:
//   sql          → 云端原生(碰 D1,worker 就地执行)
//   screenshot   → 云端编排视觉:定向找设备截图,再交给视觉模型
//   shell        → 桌面设备捕捉(Rust 手)
//   computer_*   → mac 桌面设备捕捉
//   android_*    → 安卓设备捕捉
//   browser_cdp  → 浏览器插件捕捉(chrome.debugger)
// 原则:只暴露真正有执行层的工具。
// summary:每个工具必填的一句话摘要,前端显示在工具消息上方。
const SUMMARY = { type: 'string', description: '本次操作的一句话摘要,面向用户展示。' };

export const tools = [
    // ───────── 网络 ─────────
    {
        type: 'function',
        function: {
            name: 'fetch',
            description: '云端直接发起 HTTP 请求(抓网页、调外部 API),不依赖任何设备。返回状态码与响应文本。',
            parameters: {
                type: 'object',
                properties: {
                    url: { type: 'string', description: '完整 URL。' },
                    method: { type: 'string', description: 'GET/POST/…,默认 GET。' },
                    headers: { type: 'object', description: '请求头,可选。' },
                    body: { type: 'string', description: '请求体文本,可选。' },
                    summary: SUMMARY,
                },
                required: ['url', 'summary'],
            },
        },
    },

    // ───────── 云端数据 ─────────
    {
        type: 'function',
        function: {
            name: 'sql',
            description: '在云端 D1 上执行任意 SQL。',
            parameters: {
                type: 'object',
                properties: {
                    query: { type: 'string', description: '一条 SQL 语句' },
                    params: { type: 'array', description: '可选绑定参数,按 ? 占位顺序传入。' },
                    summary: SUMMARY,
                },
                required: ['query', 'summary'],
            },
        },
    },
    // ───────── 桌面终端 ─────────
    {
        type: 'function',
        function: {
            name: 'shell',
            description: '在桌面设备上执行 shell 命令并返回输出。',
            parameters: {
                type: 'object',
                properties: {
                    command: { type: 'string', description: '要执行的 shell 命令。' },
                    summary: SUMMARY,
                    device: { type: 'string', description: '目标设备 name。' },
                    cwd: { type: 'string', description: '可选工作目录,默认用户主目录。' },
                    timeout: { type: 'number', description: '超时秒数,默认 30,范围 [1,300]。' },
                },
                required: ['command', 'summary'],
            },
        },
    },

    // ───────── 视觉 ─────────
    {
        type: 'function',
        function: {
            name: 'screenshot',
            description: '截指定设备屏幕并让视觉模型按 prompt 返回文字结果。需要点击某处时,让 prompt 明确要求「返回目标元素中心的像素坐标 x,y(以及截图宽高)」,再据此调 android_tap(x,y) 或桌面点击。raw=true 时直接返回原始截图 {image,w,h,cw,ch} 不走视觉模型。',
            parameters: {
                type: 'object',
                properties: {
                    prompt: { type: 'string', description: '让视觉模型做什么。' },
                    raw: { type: 'boolean', description: 'true 时返回原始截图 {image,w,h,cw,ch},不走视觉模型。' },
                    device: { type: 'string', description: '目标设备 name。' },
                    summary: SUMMARY,
                },
                required: ['prompt', 'summary'],
            },
        },
    },

    // ───────── 浏览器 ─────────
    {
        type: 'function',
        function: {
            name: 'browser_cdp',
            description: '通过 Chrome DevTools Protocol 操作浏览器。',
            parameters: {
                type: 'object',
                properties: {
                    method: { type: 'string', description: 'CDP 方法名。' },
                    params: { type: 'object', description: 'CDP 参数。' },
                    tabId: { type: 'number', description: '目标标签 tabId。' },
                    device: { type: 'string', description: '目标浏览器插件 name。' },
                    summary: SUMMARY,
                },
                required: ['method', 'summary'],
            },
        },
    },

    // ───────── mac 屏幕操控 ─────────
    {
        type: 'function',
        function: {
            name: 'computer_screen',
            description: '读取 mac 前台应用的可见控件信息。',
            parameters: {
                type: 'object',
                properties: { summary: SUMMARY, device: { type: 'string', description: '目标 mac 设备 name。' } },
                required: ['summary'],
            },
        },
    },
    {
        type: 'function',
        function: {
            name: 'computer_click',
            description: '点击 mac 前台窗口里名字为 text 的元素。',
            parameters: {
                type: 'object',
                properties: { text: { type: 'string', description: '元素名字。' }, summary: SUMMARY, device: { type: 'string', description: '目标 mac 设备 name。' } },
                required: ['text', 'summary'],
            },
        },
    },
    {
        type: 'function',
        function: {
            name: 'computer_type',
            description: '在 mac 当前聚焦处输入文本。',
            parameters: {
                type: 'object',
                properties: { text: { type: 'string' }, summary: SUMMARY, device: { type: 'string', description: '目标 mac 设备 name。' } },
                required: ['text', 'summary'],
            },
        },
    },
    {
        type: 'function',
        function: {
            name: 'computer_key',
            description: '在 mac 发送按键。',
            parameters: {
                type: 'object',
                properties: { key: { type: 'string' }, summary: SUMMARY, device: { type: 'string', description: '目标 mac 设备 name。' } },
                required: ['key', 'summary'],
            },
        },
    },
    {
        type: 'function',
        function: {
            name: 'computer_open_app',
            description: '在 mac 打开或切到一个应用。',
            parameters: {
                type: 'object',
                properties: { name: { type: 'string', description: '应用名。' }, summary: SUMMARY, device: { type: 'string', description: '目标 mac 设备 name。' } },
                required: ['name', 'summary'],
            },
        },
    },

    // ───────── 安卓屏幕操控 ─────────
    {
        type: 'function',
        function: {
            name: 'android_screen',
            description: '读取安卓当前界面的可交互元素。',
            parameters: {
                type: 'object',
                properties: { summary: SUMMARY, device: { type: 'string', description: '目标安卓设备 name。' } },
                required: ['summary'],
            },
        },
    },
    {
        type: 'function',
        function: {
            name: 'android_tap',
            description: '点击安卓屏幕元素或坐标。',
            parameters: {
                type: 'object',
                properties: {
                    text: { type: 'string', description: '元素文字。' },
                    x: { type: 'number' }, y: { type: 'number' },
                    summary: SUMMARY, device: { type: 'string', description: '目标安卓设备 name。' },
                },
                required: ['summary'],
            },
        },
    },
    {
        type: 'function',
        function: {
            name: 'android_type',
            description: '往安卓当前聚焦处输入文本。',
            parameters: {
                type: 'object',
                properties: { text: { type: 'string' }, summary: SUMMARY, device: { type: 'string', description: '目标安卓设备 name。' } },
                required: ['text', 'summary'],
            },
        },
    },
    {
        type: 'function',
        function: {
            name: 'android_swipe',
            description: '在安卓上滑动。',
            parameters: {
                type: 'object',
                properties: {
                    x1: { type: 'number' }, y1: { type: 'number' }, x2: { type: 'number' }, y2: { type: 'number' },
                    summary: SUMMARY, device: { type: 'string', description: '目标安卓设备 name。' },
                },
                required: ['x1', 'y1', 'x2', 'y2', 'summary'],
            },
        },
    },
    {
        type: 'function',
        function: {
            name: 'android_key',
            description: '发送安卓全局键。',
            parameters: {
                type: 'object',
                properties: {
                    key: { type: 'string', enum: ['back', 'home', 'recents', 'notifications'] },
                    summary: SUMMARY, device: { type: 'string', description: '目标安卓设备 name。' },
                },
                required: ['key', 'summary'],
            },
        },
    },
    {
        type: 'function',
        function: {
            name: 'android_open_app',
            description: '在安卓打开一个应用。',
            parameters: {
                type: 'object',
                properties: { name: { type: 'string', description: '应用包名。' }, summary: SUMMARY, device: { type: 'string', description: '目标安卓设备 name。' } },
                required: ['name', 'summary'],
            },
        },
    },
];
