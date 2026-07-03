// 基础:OpenAI 兼容客户端 + 流式解析。
// stream() 是 async generator,逐块吐出:
//   { type:'text', delta }           助手文本增量
//   { type:'tool_call', calls }      本轮要调的工具(累积完整后一次性给)
//   { type:'usage', usage }          末块的真实 token 用量(total_tokens 等)
//   { type:'done', finish }          结束
import { authHeaders } from './auth.js';

export async function* stream({ apiUrl, apiKey, model, authMode, messages, tools, responseFormat, signal }) {
    const response = await fetch(apiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders(authMode, apiKey) },
        // responseFormat 为 undefined 时 JSON.stringify 会自动丢掉这个 key,不影响不需要它的调用方
        body: JSON.stringify({ model, messages, tools, response_format: responseFormat, stream: true, stream_options: { include_usage: true } }),
        signal, // 传入 AbortSignal,中断时直接断开与模型的连接
    });
    if (!response.ok) throw new Error(`LLM ${response.status}: ${await response.text()}`);

    const responseReader = response.body.getReader();
    const decoder = new TextDecoder();
    const pendingTools = new Map(); // index -> {id,name,args}
    let streamBuffer = '';

    while (true) {
        const { done, value } = await responseReader.read();
        if (done) break;
        streamBuffer += decoder.decode(value, { stream: true });
        const eventLines = streamBuffer.split('\n');
        streamBuffer = eventLines.pop() || '';
        for (const line of eventLines) {
            const trimmedLine = line.trim();
            if (!trimmedLine.startsWith('data:')) continue;
            const eventData = trimmedLine.slice(5).trim();
            if (eventData === '[DONE]') { yield finishPendingToolCalls(pendingTools); return; }
            let eventPayload; try { eventPayload = JSON.parse(eventData); } catch { continue; }
            if (eventPayload.usage) yield { type: 'usage', usage: eventPayload.usage }; // 末块带真实 token 用量
            const delta = eventPayload.choices?.[0]?.delta || {};
            if (delta.content) yield { type: 'text', delta: delta.content };
            for (const toolDelta of delta.tool_calls || []) {
                const pendingTool = pendingTools.get(toolDelta.index) || { id: '', name: '', args: '' };
                if (toolDelta.id) pendingTool.id = toolDelta.id;
                if (toolDelta.function?.name) pendingTool.name = toolDelta.function.name;
                if (toolDelta.function?.arguments) pendingTool.args += toolDelta.function.arguments;
                pendingTools.set(toolDelta.index, pendingTool);
            }
            if (eventPayload.choices?.[0]?.finish_reason) yield finishPendingToolCalls(pendingTools);
        }
    }
}

function finishPendingToolCalls(pendingTools) {
    if (!pendingTools.size) return { type: 'done', finish: 'stop' };
    const toolCalls = [...pendingTools.values()].map((tool) => ({
        id: tool.id, name: tool.name,
        args: parseToolArguments(tool.args),
    }));
    pendingTools.clear();
    return { type: 'tool_call', calls: toolCalls };
}

const parseToolArguments = (text) => { try { return JSON.parse(text || '{}'); } catch { return {}; } };
