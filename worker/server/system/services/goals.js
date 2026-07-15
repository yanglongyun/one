import { dueGoals } from '../repositories/goals.js';
import { insertGoalTask, recentGoalTasks } from '../repositories/tasks.js';
import { buildTask, startCreatedTask } from './tasks.js';

export async function runDueGoals(hub) {
    const now = Date.now();
    for (const goal of await dueGoals(hub.db, now)) {
        const recent = await recentGoalTasks(hub.db, goal.id);
        const history = recent.length
            ? recent.map((task) => `- [${task.origin}/${task.status}] ${task.summary || '(无摘要)'}`).join('\n')
            : '(这是第一次推进)';
        const prompt = [
            '你在自主推进一个长期目标。本轮选择当前最有价值、可以真正完成的一步,并直接完成它。',
            `【目标】${goal.title}`,
            `【完成标准/说明】${goal.prompt}`,
            `【最近推进与评估】\n${history}`,
            '完成实际工作后,清晰汇报产物、验证结果和仍存在的问题。不要自行修改 goals 表;系统会另开独立评估任务验收并决定是否继续。',
        ].join('\n');
        const dueAt = Number(goal.next_run_at);
        const task = buildTask({ title: `推进:${goal.title}`, prompt, origin: 'goal', originId: goal.id });
        const claim = hub.db.prepare(`
          UPDATE goals SET next_run_at = NULL, updated_at = ?
          WHERE id = ? AND status = 'active' AND next_run_at = ?
            AND EXISTS (SELECT 1 FROM tasks WHERE id = ?)
        `).bind(now, goal.id, dueAt, task.id);
        const [created] = await hub.db.batch([
            insertGoalTask(hub.db, task, goal.id, dueAt),
            claim,
        ]);
        if (Number(created.meta?.changes || 0) === 1) startCreatedTask(hub, task);
    }
}
