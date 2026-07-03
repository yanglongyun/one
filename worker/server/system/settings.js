// 设置:settings 表上的 KV。pass_hash(访问口令)+ 模型配置(含 apiKey)都在这里。
// identity 用它读口令、agent 用它读模型配置 —— KV 单一真相。
const DEFAULTS = {
    apiUrl: '',
    apiKey: '',
    model: '',
    system: '',
    recentRawMessages: '100',
    compressThreshold: '12000',
    toolResultMaxChars: '12000',
    toolMaxRounds: '50',
    authMode: 'bearer', // 主模型认证:bearer(Authorization) | x-api-key(Claude 端点)
    // 视觉:visionEnabled='1' 时复用主模型做视觉;否则用下面这套独立视觉模型。
    visionEnabled: '',
    visionApiUrl: '',
    visionApiKey: '',
    visionModel: '',
    visionAuthMode: 'bearer',
};

export function settings(db) {
    return {
        async get(key, fallback = '') {
            const row = await db.prepare('SELECT value FROM settings WHERE key = ?').bind(String(key)).first();
            return row ? row.value : fallback;
        },
        async set(key, value) {
            await db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)').bind(String(key), String(value ?? '')).run();
        },
        async all() {
            const { results } = await db.prepare('SELECT key, value FROM settings').all();
            return { ...DEFAULTS, ...Object.fromEntries(results.map((r) => [r.key, r.value])) };
        },
    };
}

export { DEFAULTS };
