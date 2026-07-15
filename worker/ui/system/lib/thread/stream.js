import { mapToolCall, mkKey } from './messages';

function findLastAssistant(messages) {
    for (let i = messages.value.length - 1; i >= 0; i -= 1) {
        const row = messages.value[i];
        if (row.role === 'assistant') return row;
    }
    return null;
}

// 通用"一条对话线"的直播 reducer —— 主对话(threadId=null)/ 某个 task 详情(threadId=task id)共用。
// WS 是一条共享连接,事件按 threadId 认领:不是自己这条线的事件直接忽略。
function setupThreadStream({ threadId = null, messages, busy, pushRow, refresh, bumpStream }) {
    let streamingKey = '';
    let compactKey = '';

    function clientRow(clientId) {
        if (!clientId) return null;
        return messages.value.find((item) => item.role === 'user' && item.clientId === clientId) || null;
    }

    function closeStreaming() {
        if (!streamingKey) return null;
        const row = messages.value.find((item) => item._key === streamingKey);
        if (row) row.streaming = false;
        streamingKey = '';
        return row;
    }

    function currentStreaming() {
        if (streamingKey) {
            const existing = messages.value.find((item) => item._key === streamingKey);
            if (existing) return existing;
        }
        const row = pushRow({
            role: 'assistant',
            _key: mkKey('assistant'),
            content: '',
            usage: null,
            streaming: true,
        });
        streamingKey = row._key;
        return row;
    }

    function completeToolResult(result) {
        const id = result?.toolCallId || result?.tool_call_id || '';
        let target = null;
        if (id) {
            for (let i = messages.value.length - 1; i >= 0; i -= 1) {
                const row = messages.value[i];
                if (row.type === 'tool_call' && row.toolCallId === id) { target = row; break; }
            }
        }
        if (!target) {
            for (let i = messages.value.length - 1; i >= 0; i -= 1) {
                const row = messages.value[i];
                if (row.type === 'tool_call' && row.status !== 'done') { target = row; break; }
            }
        }
        if (!target) return;
        target.result = result?.content || '';
        target.status = 'done';
    }

    function onEvent(event) {
        if ((event.threadId || null) !== threadId) return; // 不是这条线的事件,交给认领它的那个 store
        // 同一会话可能被多个标签页打开。带 clientId 的流只属于发起它的标签页。
        if (event.clientId && !clientRow(event.clientId)) {
            if (event.type === 'chat.done') refresh?.();
            return;
        }

        switch (event.type) {
            case 'chat.start':
                busy.value = true;
                if (clientRow(event.clientId)) clientRow(event.clientId).sending = false;
                closeStreaming();
                break;
            case 'chat.compact.start': {
                closeStreaming();
                const row = pushRow({ role: 'system', _key: mkKey('system'), content: '正在压缩较早的上下文…', compacting: true });
                compactKey = row._key;
                break;
            }
            case 'chat.compact.done': {
                const row = compactKey && messages.value.find((item) => item._key === compactKey);
                if (row) { row.content = '已压缩较早的上下文以节省窗口'; row.compacting = false; }
                compactKey = '';
                break;
            }
            case 'chat.delta': {
                const row = currentStreaming();
                row.content += event.content || '';
                break;
            }
            case 'chat.tool.calls':
                closeStreaming();
                for (const toolCall of (event.calls || [])) {
                    pushRow(mapToolCall(toolCall, 'running'));
                }
                break;
            case 'chat.tool.result': {
                const content = typeof event.result === 'string' ? event.result : JSON.stringify(event.result);
                completeToolResult({ toolCallId: event.id, content });
                break;
            }
            case 'chat.usage': {
                const row = closeStreaming() || findLastAssistant(messages);
                if (row) row.usage = event.usage || null;
                break;
            }
            case 'chat.done':
                closeStreaming();
                if (clientRow(event.clientId)) {
                    clientRow(event.clientId).sending = false;
                    clientRow(event.clientId).failed = false;
                }
                busy.value = false;
                refresh?.();
                break;
            case 'chat.aborted':
                closeStreaming();
                if (clientRow(event.clientId)) clientRow(event.clientId).sending = false;
                busy.value = false;
                break;
            case 'chat.error':
                closeStreaming();
                if (clientRow(event.clientId)) {
                    clientRow(event.clientId).sending = false;
                    clientRow(event.clientId).failed = true;
                }
                pushRow({
                    role: 'system',
                    _key: mkKey('system'),
                    content: event.content || '出错了',
                    code: event.code || '',
                });
                busy.value = false;
                break;
            default:
                break;
        }

        bumpStream();
    }

    function resetStreaming() {
        closeStreaming();
    }

    return { onEvent, resetStreaming };
}

export { setupThreadStream };
