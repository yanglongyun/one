import { stream } from './llm.js';
import { tools as defaultTools } from './tools.js';
import { assistantMessage } from './messages.js';

const FALLBACK_MAX_STEPS = 50;

// 纯 agent 内核:只做 messages -> LLM -> tools -> final result。
// 所有外部状态都由调用方通过参数注入。
export async function runAgent({
    messages = [],
    config,
    tools = defaultTools,
    executeTools,
    signal,
    onEvent = () => {},
    maxSteps = FALLBACK_MAX_STEPS,
    responseFormat,
} = {}) {
    if (!config?.apiUrl || !config?.apiKey || !config?.model) {
        throw new Error('模型配置不完整');
    }
    if (typeof executeTools !== 'function') {
        throw new Error('缺少 executeTools');
    }

    const workMessages = [...messages];
    const addedMessages = [];
    let finalMessage = null;
    let finalText = '';
    let lastUsage = {};

    for (let step = 0; step < maxSteps; step++) {
        if (signal?.aborted) throw new DOMException('Aborted', 'AbortError');

        let assistantText = '';
        let requestedToolCalls = null;
        let stepUsage = {};
        const modelStream = stream({
            apiUrl: config.apiUrl,
            apiKey: config.apiKey,
            model: config.model,
            authMode: config.authMode,
            messages: workMessages,
            tools,
            responseFormat,
            signal,
        });
        for await (const modelEvent of modelStream) {
            if (modelEvent.type === 'text') {
                assistantText += modelEvent.delta;
                await onEvent({ type: 'delta', content: modelEvent.delta });
            } else if (modelEvent.type === 'tool_call') {
                requestedToolCalls = modelEvent.calls;
            } else if (modelEvent.type === 'usage') {
                stepUsage = modelEvent.usage || {};
                lastUsage = stepUsage;
                await onEvent({ type: 'usage', usage: stepUsage });
            }
        }

        const assistant = assistantMessage(assistantText, requestedToolCalls);
        workMessages.push(assistant);
        addedMessages.push(assistant);
        await onEvent({ type: 'assistant', message: assistant, usage: stepUsage });

        if (!requestedToolCalls?.length) {
            finalMessage = assistant;
            finalText = assistantText;
            await onEvent({ type: 'done', message: assistant });
            return { finalMessage, finalText, addedMessages, usage: lastUsage };
        }

        await onEvent({ type: 'tool_calls', calls: requestedToolCalls });
        const toolMessages = await executeTools(requestedToolCalls, {
            signal,
            onResult: (payload) => onEvent({ type: 'tool_result', ...payload }),
        });
        for (const message of toolMessages) {
            workMessages.push(message);
            addedMessages.push(message);
        }
    }

    finalText = '达到工具循环上限';
    finalMessage = { role: 'assistant', content: finalText };
    addedMessages.push(finalMessage);
    await onEvent({ type: 'done', message: finalMessage });
    return { finalMessage, finalText, addedMessages, usage: lastUsage };
}
