import { checkDue } from '../realtime/cron.js';
import { disableSchedule, enabledSchedules, markScheduleRun } from '../repositories/schedules.js';
import { createTask } from './tasks.js';

export async function runDueSchedules(hub) {
    const now = Date.now();
    const minute = Math.floor(now / 60000);
    for (const schedule of await enabledSchedules(hub.db)) {
        if (schedule.last_run_minute === minute) continue;
        if (!checkDue(schedule, now)) continue;
        await markScheduleRun(hub.db, schedule.id, now, minute);
        if (schedule.kind === 'once') await disableSchedule(hub.db, schedule.id);
        await createTask(hub, {
            title: schedule.name,
            prompt: schedule.prompt,
            origin: 'schedule',
            originId: schedule.id,
        });
    }
}
