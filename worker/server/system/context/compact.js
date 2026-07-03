import { stream } from '../agent/llm.js';
import { COMPACTION_SYSTEM } from './prompt.js';
import { latestCompaction, insertCompaction } from '../repositories/compactions.js';
import { latestUsage, messagesAfter } from '../repositories/messages.js';

const totalTokens = (usage) => Number(usage?.total_tokens || 0) || 0;
const parseMessageBody = (body) => { try { return JSON.parse(body || '{}'); } catch { return {}; } };

function findKeepSuffixStart(messageRows) {
    if (!messageRows.length) return 0;
    const lastMessage = parseMessageBody(messageRows[messageRows.length - 1].body);
    if (lastMessage.role === 'tool') {
        for (let index = messageRows.length - 1; index >= 0; index--) {
            const message = parseMessageBody(messageRows[index].body);
            if (message.role === 'assistant' && Array.isArray(message.tool_calls) && message.tool_calls.length) return index;
        }
    }
    return Math.max(0, messageRows.length - 1);
}

function serializeMessagesForSummary(messageRows) {
    return messageRows.map((row) => {
        const message = parseMessageBody(row.body);
        const messageRole = message.role || 'unknown';
        let messageContent;
        if (messageRole === 'assistant' && Array.isArray(message.tool_calls) && message.tool_calls.length) {
            messageContent = [message.content || '', `tool_calls: ${JSON.stringify(message.tool_calls)}`].filter(Boolean).join('\n');
        } else if (messageRole === 'tool') {
            messageContent = `tool_call_id: ${message.tool_call_id || ''}\n${message.content || ''}`;
        } else {
            messageContent = message.content || '';
        }
        return `#${row.id} ${messageRole}\n${messageContent}`;
    }).join('\n\n---\n\n');
}

export async function maybeCompact(hub, threadId, config, emit = () => {}) {
    const compactThreshold = Number(config.compressThreshold) || 12000;
    const latestUsageRow = await latestUsage(hub.db, threadId);
    const latestTokenCount = totalTokens(parseMessageBody(latestUsageRow?.usage));
    if (!latestTokenCount || latestTokenCount < compactThreshold) return false;

    const latestSummary = await latestCompaction(hub.db, threadId);
    const messageRows = await messagesAfter(hub.db, threadId, latestSummary?.end_message_id || 0);
    const suffixStart = findKeepSuffixStart(messageRows);
    if (suffixStart <= 2) return false;

    const messagesToCompact = messageRows.slice(0, suffixStart);
    const startId = messagesToCompact[0].id;
    const endId = messagesToCompact[messagesToCompact.length - 1].id;

    emit('chat.compact.start', { meta: { startId, endId, tokens: latestTokenCount, threshold: compactThreshold } });
    try {
        let summary = '';
        let summaryTokens = 0;
        const modelStream = stream({
            apiUrl: config.apiUrl,
            apiKey: config.apiKey,
            model: config.model,
            authMode: config.authMode,
            messages: [
                { role: 'system', content: COMPACTION_SYSTEM },
                { role: 'user', content: `请压缩以下聊天消息：\n\n${serializeMessagesForSummary(messagesToCompact)}` },
            ],
            tools: [],
            responseFormat: undefined,
            signal: undefined,
        });
        for await (const modelEvent of modelStream) {
            if (modelEvent.type === 'text') summary += modelEvent.delta;
            else if (modelEvent.type === 'usage') summaryTokens = totalTokens(modelEvent.usage);
        }
        if (!summary.trim()) return false;
        await insertCompaction(hub.db, threadId, { startId, endId, summary: summary.trim(), tokens: summaryTokens });
        return true;
    } finally {
        emit('chat.compact.done', { meta: { startId, endId } });
    }
}
