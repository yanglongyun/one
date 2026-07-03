import { runAgent } from '../agent/run.js';
import { tools } from '../agent/tools.js';
import { buildMessages } from '../context/build.js';
import { maybeCompact } from '../context/compact.js';
import { runToolCalls } from '../tools/index.js';
import { loadModelConfig } from '../services/config.js';
import { insertMessage } from '../repositories/messages.js';
import { settings } from '../settings.js';
import * as vision from '../tools/vision.js';
import * as chatsRepo from '../../apps/chats/repository.js';

const MAX_IMAGES = 10;

export async function runChatTurn(hub, threadId, input, signal, { touchChat = true, responseFormat } = {}) {
    const emit = (type, extra = {}) => hub.toWeb({ type, threadId, ...extra });
    const text = String(input?.text || '');
    const images = normalizeImages(input?.images);

    const config = await loadModelConfig(hub.db);
    if (config.error) {
        emit('chat.error', { content: config.error });
        return { status: 'failed', error: config.error, finalText: '' };
    }

    emit('chat.start');
    let imageNotes = [];
    if (images.length) {
        const cfg = await visionConfig(hub);
        if (cfg.error) {
            emit('chat.error', { content: cfg.error });
            return { status: 'failed', error: cfg.error, finalText: '' };
        }
        imageNotes = await describeImages(cfg, images, text, signal);
    }
    const userMessage = { role: 'user', content: mergeImageNotes(text, imageNotes) };
    if (images.length) userMessage.images = images.map(({ name, type, size }) => ({ name, type, size }));
    await insertMessage(hub.db, threadId, userMessage);
    if (touchChat && threadId) {
        await chatsRepo.touch(hub.db, threadId, text).catch(() => {});
        hub.toWeb({ type: 'chats.changed' });
    }

    let finalText = '';
    try {
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
                if (event.type === 'delta') {
                    emit('chat.delta', { content: event.content });
                    return;
                }
                if (event.type === 'usage' && event.usage && Object.keys(event.usage).length) {
                    emit('chat.usage', { usage: event.usage });
                    return;
                }
                if (event.type === 'assistant') {
                    await insertMessage(hub.db, threadId, event.message, event.usage || {});
                    return;
                }
                if (event.type === 'tool_calls') {
                    emit('chat.tool.calls', { calls: event.calls.map((c) => ({ id: c.id, name: c.name, args: c.args })) });
                    return;
                }
                if (event.type === 'tool_result') {
                    emit('chat.tool.result', { id: event.id, result: event.result });
                    await insertMessage(hub.db, threadId, event.message);
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

function normalizeImages(value) {
    const list = Array.isArray(value) ? value : [];
    return list
        .filter((item) => item && typeof item === 'object')
        .map((item) => ({
            name: String(item.name || 'image').slice(0, 120),
            type: String(item.type || ''),
            size: Number(item.size) || 0,
            dataUrl: String(item.dataUrl || item.url || ''),
        }))
        .filter((item) => item.dataUrl.startsWith('data:image/'))
        .slice(0, MAX_IMAGES);
}

async function visionConfig(hub) {
    const c = await settings(hub.db).all();
    if (c.visionEnabled) {
        if (!c.apiUrl || !c.apiKey || !c.model) return { error: '已开启「主模型做视觉」,但主模型未配置完整。' };
        return { apiUrl: c.apiUrl, apiKey: c.apiKey, model: c.model, authMode: c.authMode || 'bearer' };
    }
    if (!c.visionApiUrl || !c.visionApiKey || !c.visionModel) {
        return { error: '未配置视觉:要么开启「主模型做视觉」,要么填独立视觉模型(url/key/model)。' };
    }
    return { apiUrl: c.visionApiUrl, apiKey: c.visionApiKey, model: c.visionModel, authMode: c.visionAuthMode || 'bearer' };
}

async function describeImages(cfg, images, userText, signal) {
    const out = [];
    for (let i = 0; i < images.length; i += 1) {
        if (signal?.aborted) throw new DOMException('Aborted', 'AbortError');
        const image = images[i];
        const prompt = [
            '用简体中文客观描述这张用户上传的图片。',
            '重点提取后续对话/执行任务需要知道的信息,不要编造。',
            userText ? `用户同时输入了: ${userText}` : '',
        ].filter(Boolean).join('\n');
        const text = await vision.describe(cfg, image.dataUrl, prompt);
        out.push({ name: image.name, text });
    }
    return out;
}

function mergeImageNotes(text, notes) {
    const body = String(text || '').trim();
    if (!notes.length) return body;
    const lines = notes.map((item, i) => `${i + 1}. ${item.name}: ${item.text || '(无描述)'}`);
    return `${body}${body ? '\n\n' : ''}【用户上传图片的视觉理解】\n${lines.join('\n')}`;
}
