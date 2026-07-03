import { authHeaders } from '../agent/auth.js';

async function call(cfg, dataUrl, prompt) {
    const res = await fetch(cfg.apiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders(cfg.authMode, cfg.apiKey) },
        body: JSON.stringify({
            model: cfg.model,
            messages: [{
                role: 'user',
                content: [
                    { type: 'text', text: prompt },
                    { type: 'image_url', image_url: { url: dataUrl } },
                ],
            }],
        }),
    });
    if (!res.ok) throw new Error(`vision ${res.status}: ${await res.text()}`);
    const json = await res.json();
    return json.choices?.[0]?.message?.content || '';
}

export async function describe(cfg, dataUrl, prompt) {
    return call(cfg, dataUrl, prompt || '用简洁中文描述这张屏幕截图的主要内容。');
}

