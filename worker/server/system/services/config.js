import { settings } from '../settings.js';

export async function loadModelConfig(db) {
    const c = await settings(db).all();
    const missing = [];
    if (!c.apiUrl) missing.push('API 地址');
    if (!c.apiKey) missing.push('API Key');
    if (!c.model) missing.push('模型');
    if (missing.length) return { error: `还没配置模型(缺:${missing.join('、')})。去设置填好再发消息。`, code: 'model_unconfigured' };
    return {
        apiUrl: c.apiUrl,
        apiKey: c.apiKey,
        model: c.model,
        authMode: c.authMode || 'bearer',
        thinkingEnabled: c.thinkingEnabled === '1',
        reasoningEffort: c.reasoningEffort || '',
        maxOutputTokens: Math.max(0, Math.min(384000, Number(c.maxOutputTokens) || 0)),
        recentRawMessages: Number(c.recentRawMessages) || 100,
        compressThreshold: Number(c.compressThreshold) || 64000,
        toolResultMaxChars: Number(c.toolResultMaxChars) || 12000,
        toolMaxRounds: Math.max(1, Math.min(500, Number(c.toolMaxRounds) || 50)),
    };
}
