import { runChatTurn } from './chat.js';
import { finishTask, startTask } from '../services/tasks.js';
import { taskResponseFormat } from '../repositories/tasks.js';

export async function runTaskTurn(hub, threadId, input, signal) {
    await startTask(hub.db, threadId);
    const responseFormat = await taskResponseFormat(hub.db, threadId);
    const result = await runChatTurn(hub, threadId, input, signal, { touchChat: false, responseFormat });
    if (result.status === 'aborted') {
        await finishTask(hub, threadId, 'aborted', result.finalText);
    } else if (result.status === 'failed') {
        await finishTask(hub, threadId, 'failed', result.error || result.finalText);
    } else {
        await finishTask(hub, threadId, 'done', result.finalText);
    }
    return result;
}

