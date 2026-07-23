// 任务状态 / 来源的展示元信息 —— 列表卡片和详情页共用同一份,不各画一套。
// pill/dot 类来自全局 style.css:pill-run/wait/ok/bad/halt、dot-*。
export const STATUS = {
    pending: { label: '等待中', pill: 'pill-wait', dot: 'dot-wait' },
    running: { label: '执行中', pill: 'pill-run', dot: 'dot-run' },
    done: { label: '完成', pill: 'pill-ok', dot: 'dot-ok' },
    failed: { label: '失败', pill: 'pill-bad', dot: 'dot-bad' },
    aborted: { label: '已中止', pill: 'pill-halt', dot: 'dot-halt' },
    cancelled: { label: '已取消', pill: 'pill-halt', dot: 'dot-halt' },
};

// icon 是 system/components/Icon.vue 的图标名;link 为来源详情路由前缀(拼上 origin_id)。
export const ORIGIN = {
    ai: { label: 'AI 发起', icon: 'robot' },
    schedule: { label: '日程', icon: 'clock', link: '/schedules/' },
    goal: { label: '目标', icon: 'goals', link: '/goals/' },
    goal_review: { label: '目标评估', icon: 'check', link: '/goals/' },
};

export const statusOf = (s) => STATUS[s] || STATUS.pending;
export const originOf = (o) => ORIGIN[o] || ORIGIN.ai;
