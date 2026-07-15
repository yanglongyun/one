export function assistantMessage(text, calls, reasoning = '') {
    const message = { role: 'assistant', content: text || '' };
    if (reasoning) message.reasoning_content = reasoning;
    if (calls?.length) {
        message.tool_calls = calls.map((c) => ({
            id: c.id,
            type: 'function',
            function: { name: c.name, arguments: JSON.stringify(c.args || {}) },
        }));
    }
    return message;
}

export function toolMessage(call, result) {
    return {
        role: 'tool',
        tool_call_id: call.id,
        content: JSON.stringify(result),
    };
}
