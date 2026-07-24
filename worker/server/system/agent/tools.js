// 工具定义(schema)。定义在云,执行分流见 tools/index.js:
//   sql          → 云端原生(碰 D1,worker 就地执行)
//   shell        → 桌面设备捕捉(Rust 手)
//   read_file / write_file / edit_file → 桌面设备捕捉(文件三件套;编辑=精确串替换)
//   computer_*   → mac 桌面设备捕捉
//   android_*    → 安卓设备捕捉
//   chrome_debugger → 浏览器插件捕捉(chrome.debugger)
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
            description: '读写云端数据。支持 SELECT/INSERT/UPDATE/DELETE/PRAGMA 等单条 SQL 语句。',
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
    {
        type: 'function',
        function: {
            name: 'read_file',
            description: '读取桌面设备上的文本文件。改文件前必须先读,确认现状再动手。',
            parameters: {
                type: 'object',
                properties: {
                    path: { type: 'string', description: '绝对路径。' },
                    offset: { type: 'number', description: '可选:从第几行开始读(1 起)。' },
                    limit: { type: 'number', description: '可选:最多读多少行。' },
                    summary: SUMMARY,
                    device: { type: 'string', description: '目标设备 name。' },
                },
                required: ['path', 'summary'],
            },
        },
    },
    {
        type: 'function',
        function: {
            name: 'write_file',
            description: '在桌面设备上写入整个文件(新建或明确要整体重写时用;父目录自动创建)。对已有文件做局部修改必须用 edit_file,禁止整文件覆盖。',
            parameters: {
                type: 'object',
                properties: {
                    path: { type: 'string', description: '绝对路径。' },
                    content: { type: 'string', description: '完整文件内容。' },
                    summary: SUMMARY,
                    device: { type: 'string', description: '目标设备 name。' },
                },
                required: ['path', 'content', 'summary'],
            },
        },
    },
    {
        type: 'function',
        function: {
            name: 'edit_file',
            description: '编辑桌面设备上的文件:把 old_string 精确替换为 new_string。old_string 必须与文件内容逐字符一致且默认唯一,匹配不到或不唯一会报错拒改 —— 这是安全的局部修改方式,优先于 shell 重定向和 write_file。',
            parameters: {
                type: 'object',
                properties: {
                    path: { type: 'string', description: '绝对路径。' },
                    old_string: { type: 'string', description: '要替换的原文(逐字符精确,含缩进换行)。' },
                    new_string: { type: 'string', description: '替换后的新文。' },
                    replace_all: { type: 'boolean', description: '可选:替换全部匹配,默认只允许唯一一处。' },
                    summary: SUMMARY,
                    device: { type: 'string', description: '目标设备 name。' },
                },
                required: ['path', 'old_string', 'new_string', 'summary'],
            },
        },
    },

    // ───────── 浏览器 ─────────
    {
        type: 'function',
        function: {
            name: 'chrome_debugger',
            description: '通过在线 Chrome 扩展的 chrome.debugger API 操作当前活动标签页,原样发送页面级 CDP 命令。适合 Page/DOM/Runtime/Network/Input/Accessibility 等能力;它不是浏览器级 Remote Debugging 连接。不要用 Target.getTargets 或其他浏览器级命令检测扩展是否在线。命令报错只代表该方法、参数或当前标签页不可用,不代表扩展离线;在线状态以系统提示的当前在线设备为准。',
            parameters: {
                type: 'object',
                properties: {
                    method: { type: 'string', description: '发送给当前活动标签页的 CDP 方法名。' },
                    params: { type: 'object', description: '原样传给 chrome.debugger.sendCommand 的 CDP 参数。' },
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
