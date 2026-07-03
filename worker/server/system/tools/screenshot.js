import { settings } from '../settings.js';
import { pickDevice } from './device.js';
import * as vision from './vision.js';

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

export async function grabScreenshot(hub, deviceName, signal) {
    const target = pickDevice(hub.executors(), 'screenshot', deviceName);
    if (target.error) return { error: target.error };

    const id = crypto.randomUUID();
    const waiting = hub.awaitResult(id, signal);
    const sent = hub.toExecutor(target.name, { type: 'chat.tool.calls', calls: [{ id, name: 'screenshot', args: {} }] });
    if (!sent) return { error: `设备「${target.name}」已离线或发送失败` };
    const shot = await waiting;
    if (!shot || shot.error) return { error: shot?.error || '截图失败' };
    if (!shot.image) return { error: '设备未返回截图' };
    return { device: target.name, shot };
}

export async function executeScreenshotTool(args, { hub, signal } = {}) {
    const raw = await grabScreenshot(hub, args.device, signal);
    if (raw.error) return raw;
    if (args.raw) return { device: raw.device, ...raw.shot };

    const cfg = await visionConfig(hub);
    if (cfg.error) return cfg;
    const prompt = String(args.prompt || '描述这个屏幕上的内容。');
    const text = await vision.describe(cfg, raw.shot.image, prompt);
    return { device: raw.device, text };
}
