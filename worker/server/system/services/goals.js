import {
    clearGoalSchedule,
    dueGoals,
    scheduleGoal,
} from '../repositories/goals.js';
import { hasInflightGoalTask, recentGoalTasks } from '../repositories/tasks.js';
import { createTask } from './tasks.js';

export async function runDueGoals(hub) {
    const now = Date.now();
    for (const goal of await dueGoals(hub.db, now)) {
        if (await hasInflightGoalTask(hub.db, goal.id)) continue;
        await clearGoalSchedule(hub.db, goal.id);
        const recent = await recentGoalTasks(hub.db, goal.id);
        const history = recent.length
            ? recent.map((t) => `- [${t.status}] ${t.summary || '(无摘要)'}`).join('\n')
            : '(这是第一次推进)';
        const prompt = [
            '你在推进一个长期目标,本轮只走最有价值的一步(调研/产出/检查都行,别贪多)。',
            `【目标】${goal.title}`,
            `【说明】${goal.prompt}`,
            `【最近推进】\n${history}`,
            `收尾义务(必须):结束前用 sql 更新 goals 表中 id="${goal.id}" 的记录。`,
            '如果目标已完成:status="done", next_run_at=NULL,last_report 写本轮结果与整体进展。',
            '如果需要用户决策:status="paused", next_run_at=NULL,last_report 写清问题。',
            '如果继续推进:status="active", last_report 写本轮结果与下一阶段计划,next_run_at 写下次推进时间(毫秒时间戳,至少 30 分钟后)。',
        ].join('\n');
        await createTask(hub, { title: `推进:${goal.title}`, prompt, origin: 'goal', originId: goal.id });
    }
}
