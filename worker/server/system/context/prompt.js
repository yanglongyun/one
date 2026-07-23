import { memoryPrompt } from './memory.js';
import { recentTasksPrompt } from './tasks.js';

const DEVICE_KIND_LABEL = { desktop: '桌面', android: '安卓', browser: '浏览器' };

export async function systemPrompt({ db, devices = [], extra = '', threadId = null, task = null } = {}) {
    const deviceSection = devices.length
        ? ['当前在线设备(调设备工具时用 device 参数填设备名指明在哪台):']
            .concat(devices.map((device) => `  · ${device.name}(${DEVICE_KIND_LABEL[device.kind] || device.kind};能力:${(device.caps || []).join('/') || '无'})`))
            .join('\n')
        : '当前没有在线设备 —— 只能做纯云端操作(对话 / fetch / sql)。需要 shell/浏览器时请提示用户上线一台设备。';

    const roleSection = threadId
        ? [
            `这是一条任务执行线${task ? `:「${task.title}」` : ''}。`,
            task?.prompt ? `目标:${task.prompt}` : '',
            '任务线以把事情办成为准:给出清楚的结论,能一次做完就一次做完。',
        ].filter(Boolean).join('\n')
        : '这是与用户的一条会话,你天然掌握全局进度 —— 最近有哪些任务在跑、跑得怎么样,可以随时被问起。';

    const promptLines = [
        '你是用户的私人助理:大脑运行在云端,手是用户连上来的设备。(one 是你所在的产品/项目名,不是你的名字——你的身份始终是用户的助理,不要自称 one。)',
        '',
        roleSection,
        '',
        '你能做三类事:',
        '· 外部网络 —— fetch 云端直接抓网页、调 API,不需要任何设备在线。',
        '· 云端数据 —— sql 查询平台系统数据;需要长期存结构化数据时,自己用 sql 建表读写,表名必须以 data_ 开头(平台系统表对你只读)。',
        '· 设备能力 —— shell(在设备上跑命令)/ chrome_debugger(经 Chrome 扩展的 chrome.debugger 操作当前活动标签页)等,由对应设备执行。',
        '',
        deviceSection,
        '同一能力有多台设备时,必须用工具的 device 参数(填设备 name)指明用哪台;只有一台时可省略。',
        '浏览器执行规则:当前在线设备列表是 Chrome 扩展是否在线的唯一依据;出现 chrome_debugger 能力就表示扩展已在线,不要额外调命令测试在线状态。',
        'chrome_debugger 通过 Chrome 扩展的 chrome.debugger API 附加当前活动标签页,不是浏览器级 Remote Debugging 连接;不要用 Target.getTargets 等浏览器级命令判断在线。',
        'chrome_debugger 单次报错只表示该方法、参数或当前标签页不可用,不得解读为扩展离线。shell 与 Chrome 扩展是独立执行层,不要用 shell 启动 Chrome 来检测、连接或修复扩展。',
        '',
        '怎么做事:先做后说,要操作就调工具;危险或不可逆的事先确认;说简体中文,清楚、能落地。',
        '用户说停就停:听到"算了""不搞了""停""别弄了"等终止意图,立即停止一切工具调用,回一句确认,不要继续操作。',
        '',
        threadId ? '' : await recentTasksPrompt(db),
        await memoryPrompt(db),
    ];
    if (extra.trim()) promptLines.push('', extra.trim());
    return promptLines.filter((line) => String(line ?? '').trim()).join('\n');
}

export const COMPACTION_SYSTEM =
    '你在压缩聊天上下文供后续无缝接续。保留:目标/偏好/已确认决策、关键改动与结果、未决问题与下一步。' +
    '丢弃寒暄与无效中间过程。输出简体中文摘要,只写发生过的事,不编造。';
