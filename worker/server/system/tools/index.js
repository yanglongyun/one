import { executeCloudTool } from './cloud.js';
import { executeDeviceTool } from './device.js';
import { toolMessage } from '../agent/messages.js';

export async function runToolCalls(calls, { hub, threadId, signal, onResult = () => {} } = {}) {
    const messages = [];
    for (const call of calls || []) {
        if (signal?.aborted) throw new DOMException('Aborted', 'AbortError');
        const result = await executeTool(call, { hub, threadId, signal });
        const message = toolMessage(call, result);
        messages.push(message);
        await onResult({ id: call.id, result, message });
    }
    return messages;
}

async function executeTool(call, ctx) {
    try {
        if (isCloudTool(call.name)) return await executeCloudTool(call.name, call.args || {}, ctx);
        return await executeDeviceTool(call.name, { ...(call.args || {}), __toolCallId: call.id }, ctx);
    } catch (err) {
        return { error: err.message || String(err) };
    }
}

export function isCloudTool(name) {
    return ['fetch', 'sql', 'one_manage'].includes(name);
}
