// 规整发给 LLM 的消息序列,保证 tool_calls 与 tool 结果严格配对。
export const normalizeAgentMessages = (messages = []) => {
    if (!Array.isArray(messages)) return [];
    const validRoles = new Set(['system', 'user', 'assistant', 'tool']);
    const normalized = [];
    for (const item of messages) {
        if (!item || typeof item !== 'object') continue;
        const role = String(item.role || '').trim();
        if (!validRoles.has(role)) continue;
        const message = { role };
        if (role === 'assistant' && Array.isArray(item.tool_calls)) {
            message.content = item.content == null ? null : String(item.content);
            message.tool_calls = item.tool_calls;
        } else {
            message.content = item.content == null ? '' : String(item.content);
        }
        if (role === 'assistant' && item.reasoning_content !== undefined) {
            message.reasoning_content = item.reasoning_content == null ? '' : String(item.reasoning_content);
        }
        if (role === 'tool' && item.tool_call_id) message.tool_call_id = String(item.tool_call_id);
        if (role === 'assistant' && item.name) message.name = String(item.name);
        if (role === 'tool' && item.name) message.name = String(item.name);
        normalized.push(message);
    }

    const toolResultsByCallId = new Map();
    for (const message of normalized) {
        if (message.role === 'tool' && message.tool_call_id) toolResultsByCallId.set(message.tool_call_id, message);
    }
    const missingToolResultContent = 'Tool call result is missing. The system may have been interrupted, restarted, timed out, or failed for another unknown reason.';
    const output = [];
    for (const message of normalized) {
        if (message.role === 'tool') continue;
        output.push(message);
        if (message.role === 'assistant' && Array.isArray(message.tool_calls) && message.tool_calls.length > 0) {
            for (const toolCall of message.tool_calls) {
                const toolCallId = String(toolCall?.id || '').trim();
                if (!toolCallId) continue;
                const toolResult = toolResultsByCallId.get(toolCallId);
                if (toolResult) {
                    output.push(toolResult);
                    toolResultsByCallId.delete(toolCallId);
                } else {
                    output.push({ role: 'tool', tool_call_id: toolCallId, content: missingToolResultContent });
                }
            }
        }
    }

    let firstNonSystem = output.findIndex((message) => message.role !== 'system');
    while (firstNonSystem >= 0 && output[firstNonSystem]?.role === 'tool') {
        output.splice(firstNonSystem, 1);
        firstNonSystem = output.findIndex((message) => message.role !== 'system');
    }
    return output;
};
