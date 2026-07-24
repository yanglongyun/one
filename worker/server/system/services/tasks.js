import {
    claimTask,
    failExhaustedTasks,
    insertTask,
    markFinished,
    recoverableTasks,
    renewTaskLease,
    taskOrigin,
    taskState,
} from '../repositories/tasks.js';

function deriveTitle(title, prompt) {
    const explicit = String(title || '').trim();
    if (explicit) return explicit.slice(0, 60);
    const firstLine = String(prompt || '').split('\n').map((s) => s.trim()).find(Boolean) || '';
    const clipped = firstLine.slice(0, 30);
    return clipped ? (firstLine.length > 30 ? clipped + '…' : clipped) : '未命名任务';
}

export function buildTask({ title, prompt, origin = 'ai', originId = null, responseFormat = null }) {
    const cleanPrompt = String(prompt || '');
    return {
        id: crypto.randomUUID(),
        title: deriveTitle(title, cleanPrompt),
        prompt: cleanPrompt,
        origin,
        originId,
        responseFormat,
        now: Date.now(),
    };
}

export function startCreatedTask(hub, task) {
    hub.toWeb({ type: 'task.created', task: {
        id: task.id, title: task.title, status: 'pending', origin: task.origin,
        origin_id: task.originId, created_at: task.now,
    } });
    hub.startTaskTurn(task.id, { text: task.prompt });
    Promise.resolve(hub.reconcileAlarm?.()).catch((error) => console.error('[one-task] alarm reconcile failed', error));
}

export async function createTask(hub, options) {
    const task = buildTask(options);
    await insertTask(hub.db, task).run();
    startCreatedTask(hub, task);
    return task.id;
}

export async function startTask(db, id) {
    return claimTask(db, id);
}

export async function finishTask(hub, id, status, summaryText) {
    const summary = String(summaryText || '').trim().slice(0, 8000);
    const task = await taskOrigin(hub.db, id);
    if (task?.status !== 'running') return;
    await markFinished(hub.db, id, status, summary);
    const current = await taskState(hub.db, id);
    if (current) hub.toWeb({ type: 'task.updated', task: current });
    await hub.reconcileAlarm?.();
}

export async function recoverTasks(hub, isActive = () => false) {
    await failExhaustedTasks(hub.db);
    for (const task of await recoverableTasks(hub.db)) {
        if (isActive(task.id)) await renewTaskLease(hub.db, task.id);
        else hub.startTaskTurn(task.id, { text: task.prompt });
    }
}
