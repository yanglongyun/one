import * as memoryRepo from '../../apps/memories/repository.js';
import * as noteRepo from '../../apps/notes/repository.js';
import * as goalRepo from '../../apps/goals/repository.js';
import * as scheduleRepo from '../../apps/schedules/repository.js';
import { validateScheduleInput } from './schedules.js';

function dataOf(args) {
    if (!args?.data || typeof args.data !== 'object' || Array.isArray(args.data)) throw new Error('data 必须是对象');
    return args.data;
}

export async function executeManagement(args, hub) {
    const action = String(args?.action || '');
    const data = dataOf(args);
    const now = Date.now();
    let result;

    if (action === 'memory_save') {
        result = data.id ? await memoryRepo.update(hub.db, data.id, data, now) : await memoryRepo.create(hub.db, data, now);
        if (!result) throw new Error('记忆不存在');
        hub.toWeb({ type: 'memories.changed' });
        return { memory: result };
    }
    if (action === 'memory_delete') {
        if (!data.id) throw new Error('缺 memory id');
        await memoryRepo.remove(hub.db, data.id);
        hub.toWeb({ type: 'memories.changed' });
        return { ok: true };
    }
    if (action === 'goal_save') {
        result = data.id ? await goalRepo.update(hub.db, data.id, data, now) : await goalRepo.create(hub.db, data, now);
        await hub.reconcileAlarm();
        hub.toWeb({ type: 'goals.changed' });
        return { goal: result };
    }
    if (action === 'goal_delete') {
        if (!data.id) throw new Error('缺 goal id');
        await goalRepo.remove(hub.db, data.id);
        await hub.reconcileAlarm();
        hub.toWeb({ type: 'goals.changed' });
        return { ok: true };
    }
    if (action === 'schedule_save') {
        const current = data.id ? await scheduleRepo.get(hub.db, data.id) : null;
        if (data.id && !current) throw new Error('日程不存在');
        validateScheduleInput({ ...current, ...data }, now);
        result = data.id ? await scheduleRepo.update(hub.db, data.id, data, now) : await scheduleRepo.create(hub.db, data, now);
        await hub.reconcileAlarm();
        hub.toWeb({ type: 'schedules.changed' });
        return { schedule: result };
    }
    if (action === 'schedule_delete') {
        if (!data.id) throw new Error('缺 schedule id');
        await scheduleRepo.remove(hub.db, data.id);
        await hub.reconcileAlarm();
        hub.toWeb({ type: 'schedules.changed' });
        return { ok: true };
    }
    if (action === 'note_save') {
        result = data.id ? await noteRepo.update(hub.db, data.id, data, now) : await noteRepo.create(hub.db, data, now);
        if (!result) throw new Error('笔记不存在');
        hub.toWeb({ type: 'notes.changed' });
        return { note: result };
    }
    if (action === 'note_delete') {
        if (!data.id) throw new Error('缺 note id');
        await noteRepo.remove(hub.db, data.id);
        hub.toWeb({ type: 'notes.changed' });
        return { ok: true };
    }
    if (action === 'task_create') {
        if (!String(data.prompt || '').trim()) throw new Error('缺任务内容');
        const taskId = await hub.spawnTask({ title: data.title, prompt: data.prompt, origin: 'ai' });
        return { taskId };
    }
    throw new Error(`未知管理操作:${action}`);
}
