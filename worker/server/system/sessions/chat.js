import { runAgent } from '../agent/run.js';
import { tools } from '../agent/tools.js';
import { buildMessages } from '../context/build.js';
import { maybeCompact } from '../context/compact.js';
import { runToolCalls } from '../tools/index.js';
import { loadModelConfig } from '../services/config.js';
import { insertMessage } from '../repositories/messages.js';
import * as chatsRepo from '../../apps/chats/repository.js';

export async function runChatTurn(hub, threadId, input, signal, { touchChat = true, responseFormat } = {}) {
    const clientId = String(input?.clientId || '').slice(0, 100) || null;
    const emit = (type, extra = {}) => hub.toWeb({ type, threadId, clientId, ...extra });
    const text = String(input?.text || '');
    let finalText = '';
    try {
        if (signal?.aborted) throw new DOMException('Aborted', 'AbortError');
        const config = await loadModelConfig(hub.db);
        if (config.error) {
            emit('chat.error', { content: config.error, code: config.code });
            return { status: 'failed', error: config.error, finalText: '' };
        }

        const userMessage = { role: 'user', content: text };
        const inserted = await insertMessage(hub.db, threadId, userMessage, {}, {
            signal, clientId, requireChat: touchChat,
        });
        if (!inserted) {
            if (!clientId || !await existingClientMessage(hub.db, threadId, clientId)) throw new DOMException('Aborted', 'AbortError');
        }
        emit('chat.start');
        if (inserted && touchChat && threadId) {
            await chatsRepo.touch(hub.db, threadId, text).catch(() => {});
            hub.toWeb({ type: 'chats.changed' });
        }

        await maybeCompact(hub, threadId, config, emit).catch(() => {});
        const messages = await buildMessages(hub, threadId, {
            recentRawMessages: config.recentRawMessages,
            devices: hub.executors(),
            toolResultMaxChars: config.toolResultMaxChars,
        });
        const result = await runAgent({
            config,
            tools,
            signal,
            maxSteps: config.toolMaxRounds,
            messages,
            responseFormat,
            executeTools: (calls, opts) => runToolCalls(calls, { ...opts, hub, threadId }),
            onEvent: async (event) => {
                if (signal?.aborted) throw new DOMException('Aborted', 'AbortError');
                if (event.type === 'delta') {
                    emit('chat.delta', { content: event.content });
                    return;
                }
                if (event.type === 'reasoning') {
                    emit('chat.reasoning', { content: event.content });
                    return;
                }
                if (event.type === 'usage' && event.usage && Object.keys(event.usage).length) {
                    emit('chat.usage', { usage: event.usage });
                    return;
                }
                if (event.type === 'assistant') {
                    const changes = await insertMessage(hub.db, threadId, event.message, event.usage || {}, { signal, requireChat: touchChat });
                    if (touchChat && !changes) throw new DOMException('Aborted', 'AbortError');
                    return;
                }
                if (event.type === 'tool_calls') {
                    emit('chat.tool.calls', { calls: event.calls.map((c) => ({ id: c.id, name: c.name, args: c.args })) });
                    return;
                }
                if (event.type === 'tool_result') {
                    emit('chat.tool.result', { id: event.id, result: event.result });
                    const changes = await insertMessage(hub.db, threadId, event.message, {}, { signal, requireChat: touchChat });
                    if (touchChat && !changes) throw new DOMException('Aborted', 'AbortError');
                }
            },
        });
        finalText = result.finalText || '';
        emit('chat.done');
        return { status: 'done', finalText, result };
    } catch (err) {
        if (err?.name === 'AbortError' || signal?.aborted) {
            emit('chat.aborted');
            return { status: 'aborted', finalText };
        }
        emit('chat.error', { content: err.message || String(err) });
        return { status: 'failed', error: err.message || String(err), finalText };
    }
}

async function existingClientMessage(db, threadId, clientId) {
    return Boolean(await db.prepare('SELECT 1 FROM messages WHERE thread_id IS ? AND client_id = ? LIMIT 1').bind(threadId, clientId).first());
}
