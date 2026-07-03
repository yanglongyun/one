import {
    insertTask,
    markFinished,
    markRunning,
    taskOrigin,
} from '../repositories/tasks.js';
import { needsFallbackRun, scheduleGoal } from '../repositories/goals.js';

// 标题:优先用显式 title;否则从 prompt 首个非空行截 30 字(避免整段长 prompt 当标题)
function deriveTitle(title, prompt) {
    const explicit = String(title || '').trim();
    if (explicit) return explicit.slice(0, 60);
    const firstLine = String(prompt || '').split('\n').map((s) => s.trim()).find(Boolean) || '';
    const clipped = firstLine.slice(0, 30);
    return clipped ? (firstLine.length > 30 ? clipped + '…' : clipped) : '未命名任务';
}

export async function createTask(hub, { title, prompt, origin = 'ai', originId = null, responseFormat = null }) {
    const id = crypto.randomUUID();
    const now = Date.now();
    const cleanTitle = deriveTitle(title, prompt);
    await insertTask(hub.db, {
        id,
        title: cleanTitle,
        prompt: String(prompt || ''),
        origin,
        originId,
        responseFormat,
        now,
    });
    hub.toWeb({ type: 'task.created', task: { id, title: cleanTitle, status: 'pending', origin, origin_id: originId, created_at: now } });
    hub.startTaskTurn(id, { text: prompt });
    return id;
}

export async function startTask(db, id) {
    await markRunning(db, id);
}

export async function finishTask(hub, id, status, summaryText) {
    const summary = String(summaryText || '').trim().slice(0, 2000);
    await markFinished(hub.db, id, status, summary);
    hub.toWeb({ type: 'task.updated', task: { id, status, summary } });
    await maybeScheduleGoalFallback(hub, id);
}

async function maybeScheduleGoalFallback(hub, taskId) {
    const task = await taskOrigin(hub.db, taskId);
    if (task?.origin !== 'goal' || !task.origin_id) return;
    if (!(await needsFallbackRun(hub.db, task.origin_id))) return;
    await scheduleGoal(hub.db, task.origin_id, Date.now() + 24 * 3600 * 1000);
    hub.toWeb({ type: 'goals.changed' });
}
