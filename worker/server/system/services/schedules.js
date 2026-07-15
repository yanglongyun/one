import { dueSchedules } from '../repositories/schedules.js';
import { insertScheduleTask } from '../repositories/tasks.js';
import { nextCronOccurrence } from '../realtime/cron.js';
import { validateCron, validTimezone } from '../realtime/cron.js';
import { buildTask, startCreatedTask } from './tasks.js';

export function validateScheduleInput(body, now = Date.now()) {
    const kind = body.kind === 'once' ? 'once' : 'cron';
    if (kind === 'once') {
        if (body.enabled !== false && body.enabled !== 0 && (!Number(body.run_at) || Number(body.run_at) <= now)) {
            throw new Error('启用的一次性日程必须设置未来时间');
        }
        return;
    }
    const timezone = String(body.timezone || 'UTC');
    if (!validTimezone(timezone)) throw new Error('无效时区');
    validateCron(body.cron, timezone);
}

export async function runDueSchedules(hub) {
    const now = Date.now();
    for (const schedule of await dueSchedules(hub.db, now)) {
        const once = schedule.kind === 'once';
        const dueAt = Number(schedule.next_run_at);
        const next = once ? null : nextCronOccurrence(schedule.cron, schedule.timezone || 'UTC', Math.max(now, dueAt));
        const task = buildTask({
            title: schedule.name,
            prompt: schedule.prompt,
            origin: 'schedule',
            originId: schedule.id,
        });
        const update = hub.db.prepare(`
          UPDATE schedules SET enabled = ?, last_run_at = ?, last_run_minute = ?, next_run_at = ?, updated_at = ?
          WHERE id = ? AND enabled = 1 AND next_run_at = ?
            AND EXISTS (SELECT 1 FROM tasks WHERE id = ?)
        `).bind(once ? 0 : 1, now, Math.floor(now / 60000), next, now, schedule.id, dueAt, task.id);
        const [created] = await hub.db.batch([
            insertScheduleTask(hub.db, task, schedule.id, dueAt),
            update,
        ]);
        if (Number(created.meta?.changes || 0) === 1) startCreatedTask(hub, task);
    }
}
