const RANGES = [[0, 59], [0, 23], [1, 31], [1, 12], [0, 7]];
const formatters = new Map();

function parseField(input, min, max) {
    const values = new Set();
    for (const raw of String(input).split(',')) {
        const match = raw.match(/^(\*|\d+|\d+-\d+)(?:\/(\d+))?$/);
        if (!match) throw new Error(`无效 cron 字段: ${raw}`);
        const step = Number(match[2] || 1);
        if (!Number.isInteger(step) || step < 1 || step > max - min + 1) throw new Error(`无效 cron 步长: ${raw}`);
        let start; let end;
        if (match[1] === '*') { start = min; end = max; }
        else if (match[1].includes('-')) [start, end] = match[1].split('-').map(Number);
        else {
            start = Number(match[1]);
            end = match[2] ? max : start;
        }
        if (!Number.isInteger(start) || !Number.isInteger(end) || start < min || end > max || start > end) throw new Error(`cron 超出范围: ${raw}`);
        for (let value = start; value <= end; value += step) values.add(value);
    }
    return values;
}

export function parseCron(expr) {
    const fields = String(expr || '').trim().split(/\s+/);
    if (fields.length !== 5) throw new Error('cron 必须是 5 段:分 时 日 月 周');
    const sets = fields.map((field, index) => {
        const values = parseField(field, ...RANGES[index]);
        if (index === 4 && values.delete(7)) values.add(0);
        return values;
    });
    sets.wildcards = fields.map((field) => field === '*');
    return sets;
}

export function validTimezone(timezone) {
    try { new Intl.DateTimeFormat('en-US', { timeZone: timezone }).format(); return true; }
    catch { return false; }
}

function partsAt(timestamp, timezone) {
    let formatter = formatters.get(timezone);
    if (!formatter) {
        formatter = new Intl.DateTimeFormat('en-US', {
            timeZone: timezone, hour12: false, weekday: 'short', month: 'numeric', day: 'numeric',
            hour: 'numeric', minute: 'numeric',
        });
        formatters.set(timezone, formatter);
    }
    const parts = Object.fromEntries(formatter.formatToParts(new Date(timestamp)).map((part) => [part.type, part.value]));
    return {
        minute: Number(parts.minute), hour: Number(parts.hour) % 24, day: Number(parts.day), month: Number(parts.month),
        weekday: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(parts.weekday),
    };
}

export function matchesCron(expr, timestamp, timezone = 'UTC') {
    const sets = Array.isArray(expr) ? expr : parseCron(expr);
    const value = partsAt(timestamp, timezone);
    return sets[0].has(value.minute) && sets[1].has(value.hour) && sets[3].has(value.month)
        && matchesDay(sets, value);
}

function matchesDay(sets, value) {
    const dayOfMonth = sets[2].has(value.day);
    const dayOfWeek = sets[4].has(value.weekday);
    const dayOfMonthWildcard = Boolean(sets.wildcards?.[2]);
    const dayOfWeekWildcard = Boolean(sets.wildcards?.[4]);
    if (dayOfMonthWildcard) return dayOfWeek;
    if (dayOfWeekWildcard) return dayOfMonth;
    return dayOfMonth || dayOfWeek;
}

export function nextCronOccurrence(expr, timezone = 'UTC', after = Date.now()) {
    if (!validTimezone(timezone)) throw new Error('无效时区');
    const sets = parseCron(expr);
    let timestamp = Math.floor(after / 60000) * 60000 + 60000;
    const end = timestamp + 5 * 366 * 24 * 60 * 60000;
    while (timestamp <= end) {
        const local = partsAt(timestamp, timezone);
        if (!sets[0].has(local.minute)) { timestamp += 60000; continue; }
        if (!sets[3].has(local.month) || !matchesDay(sets, local) || !sets[1].has(local.hour)) {
            timestamp += 60 * 60000;
            continue;
        }
        return timestamp;
    }
    throw new Error('未来五年内没有匹配的执行时间');
}

export function validateCron(expr, timezone = 'UTC') {
    nextCronOccurrence(expr, timezone, Date.now());
    return true;
}
