import {
    claimTask,
    failExhaustedTasks,
    insertGoalReviewTask,
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

function parseReview(text) {
    const raw = String(text || '').trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
    try { return JSON.parse(raw); } catch { return null; }
}

function reviewPrompt(goal, workSummary) {
    return [
        '你是独立的目标验收员。根据目标定义和刚完成的推进结果,判断目标是否真正完成。',
        `【目标】${goal.title}`,
        `【完成标准/说明】${goal.prompt}`,
        `【本轮推进结果】${workSummary || '(无摘要)'}`,
        '只返回 JSON:{"complete":boolean,"needs_user":boolean,"report":"评估报告","next_step":"未完成时下一步","next_run_at":毫秒时间戳或null}。',
        'complete=true 只用于目标整体已经达成;需要用户决策时 needs_user=true;否则给出可执行下一步。',
    ].join('\n');
}

async function finishGoalWork(hub, task, id, status, summary) {
    const goal = await hub.db.prepare('SELECT * FROM goals WHERE id = ?').bind(task.origin_id).first();
    if (!goal) return markFinished(hub.db, id, status, summary);
    if (status !== 'done') {
        const now = Date.now();
        const next = Date.now() + 24 * 3600 * 1000;
        await hub.db.batch([
            hub.db.prepare(`UPDATE goals SET status='active',next_run_at=?,last_report=?,updated_at=?
              WHERE id=? AND status='active' AND EXISTS (SELECT 1 FROM tasks WHERE id=? AND status='running')`)
                .bind(next, `本轮任务未完成:${summary || status}`, now, goal.id, id),
            hub.db.prepare("UPDATE tasks SET status=?,summary=?,last_error=?,finished_at=?,lease_until=NULL WHERE id=? AND status='running'")
                .bind(status, summary, summary, now, id),
        ]);
        return;
    }

    const review = buildTask({
        title: `评估:${goal.title}`,
        prompt: reviewPrompt(goal, summary),
        origin: 'goal_review',
        originId: goal.id,
        responseFormat: { type: 'json_object' },
    });
    const [created] = await hub.db.batch([
        insertGoalReviewTask(hub.db, review, id, goal.id),
        hub.db.prepare(`UPDATE tasks SET status='done',summary=?,last_error='',finished_at=?,lease_until=NULL
          WHERE id=? AND status='running' AND EXISTS (SELECT 1 FROM tasks WHERE id=?)`)
            .bind(summary, Date.now(), id, review.id),
    ]);
    if (Number(created.meta?.changes || 0) === 1) startCreatedTask(hub, review);
}

async function finishGoalReview(hub, task, id, status, summary) {
    const result = status === 'done' ? parseReview(summary) : null;
    const now = Date.now();
    let goalStatus = 'active';
    let nextRunAt = now + 60 * 60 * 1000;
    let report = result?.report || `自动评估失败,将继续重试:${summary || status}`;
    if (result?.complete === true) {
        goalStatus = 'done';
        nextRunAt = null;
    } else if (result?.needs_user === true) {
        goalStatus = 'paused';
        nextRunAt = null;
    } else if (result) {
        const requested = Number(result.next_run_at);
        nextRunAt = Number.isFinite(requested) ? Math.max(requested, now + 30 * 60 * 1000) : now + 30 * 60 * 1000;
        report = [result.report, result.next_step ? `下一步:${result.next_step}` : ''].filter(Boolean).join('\n');
    }
    await hub.db.batch([
        hub.db.prepare(`UPDATE goals SET status=?,next_run_at=?,last_report=?,updated_at=?
          WHERE id=? AND status='active' AND EXISTS (SELECT 1 FROM tasks WHERE id=? AND status='running')`)
            .bind(goalStatus, nextRunAt, report.slice(0, 8000), now, task.origin_id, id),
        hub.db.prepare("UPDATE tasks SET status=?,summary=?,last_error=?,finished_at=?,lease_until=NULL WHERE id=? AND status='running'")
            .bind(status, summary, status === 'failed' ? summary : '', now, id),
    ]);
    hub.toWeb({ type: 'goals.changed' });
}

export async function finishTask(hub, id, status, summaryText) {
    const summary = String(summaryText || '').trim().slice(0, 8000);
    const task = await taskOrigin(hub.db, id);
    if (task?.status !== 'running') return;
    if (task?.origin === 'goal' && task.origin_id) await finishGoalWork(hub, task, id, status, summary);
    else if (task?.origin === 'goal_review' && task.origin_id) await finishGoalReview(hub, task, id, status, summary);
    else await markFinished(hub.db, id, status, summary);
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
