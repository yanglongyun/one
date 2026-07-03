// 日程到期判断。cron 语义与 Cloudflare Cron Triggers 一致(5 段,UTC):分 时 日 月 周。
// once 类型直接比 run_at。checkSchedules 每分钟调一次 checkDue,故只需判断"当前这一分钟"命中与否。

function matchField(field, value, max) {
    if (field === '*') return true;
    for (const part of field.split(',')) {
        const step = part.match(/^\*\/(\d+)$/);
        if (step) { if (value % Number(step[1]) === 0) return true; continue; }
        const range = part.match(/^(\d+)-(\d+)$/);
        if (range) { if (value >= Number(range[1]) && value <= Number(range[2])) return true; continue; }
        if (Number(part) === value) return true;
    }
    return false;
}

export function matchesCron(expr, date) {
    const fields = String(expr || '').trim().split(/\s+/);
    if (fields.length !== 5) return false;
    const [min, hour, day, month, weekday] = fields;
    return (
        matchField(min, date.getUTCMinutes()) &&
        matchField(hour, date.getUTCHours()) &&
        matchField(day, date.getUTCDate()) &&
        matchField(month, date.getUTCMonth() + 1) &&
        matchField(weekday, date.getUTCDay())
    );
}

// schedule 行是否到期(now = 毫秒时间戳)
export function checkDue(schedule, now) {
    if (schedule.kind === 'once') return Number(schedule.run_at) > 0 && Number(schedule.run_at) <= now;
    return matchesCron(schedule.cron, new Date(now));
}
