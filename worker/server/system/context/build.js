import { systemPrompt } from './prompt.js';
import { normalizeAgentMessages } from '../agent/normalize.js';
import { truncateToolResult } from '../services/messages.js';
import { latestCompaction } from '../repositories/compactions.js';
import { recentMessagesAfterCompaction } from '../repositories/messages.js';
import { taskSummary } from '../repositories/tasks.js';

export async function buildMessages(hub, threadId, { recentRawMessages = 100, devices = [], toolResultMaxChars = 12000 } = {}) {
    const task = await taskSummary(hub.db, threadId);
    const latestSummary = await latestCompaction(hub.db, threadId);
    const afterSummaryId = latestSummary?.end_message_id || 0;
    const recentRows = await recentMessagesAfterCompaction(hub.db, threadId, afterSummaryId, recentRawMessages);

    const messages = [{ role: 'system', content: await systemPrompt({ db: hub.db, devices, threadId, task }) }];
    if (latestSummary?.summary) messages.push({ role: 'system', content: `【先前对话摘要】\n${latestSummary.summary}` });
    for (const row of recentRows) {
        const parsedBody = parseMessageBody(row.body);
        let message = parsedBody && typeof parsedBody === 'object' ? parsedBody : { role: row.role, content: String(row.body) };
        if (message.role === 'tool') {
            message = { ...message, content: truncateToolResult(message.content, { maxChars: toolResultMaxChars }).content };
        }
        messages.push(message);
    }
    return normalizeAgentMessages(messages);
}

const parseMessageBody = (body) => { try { return JSON.parse(body); } catch { return null; } };
