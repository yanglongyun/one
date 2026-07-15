// 消息派发:web ↔ (本 DO) ↔ 执行层。WS tag 分 'web' / 'device'(桌面手) / 'browser'(浏览器插件)。
// 设备与浏览器都是「执行层」:广播 chat.tool.calls 给它们,各自捕捉归属自己的工具。
import { EXECUTOR_PROTOCOL_VERSION } from './protocol.js';

export function makeDispatch(ctx) {
    const webSockets = () => ctx.getWebSockets('web');
    const deviceSockets = () => ctx.getWebSockets('device');
    const browserSockets = () => ctx.getWebSockets('browser');

    const send = (ws, msg) => { try { ws.send(JSON.stringify(msg)); } catch { /* 已断 */ } };
    const sendOne = (list, msg) => { const ws = list[0]; if (!ws) return false; send(ws, msg); return true; };
    const executorInfo = (ws) => {
        let attachment = {};
        try { attachment = ws.deserializeAttachment() || {}; } catch { /* ignore */ }
        return {
            name: attachment.name || '设备',
            kind: attachment.kind || 'device',
            caps: Array.isArray(attachment.caps) ? attachment.caps : [],
            protocolVersion: attachment.protocolVersion,
            clientVersion: attachment.clientVersion || '',
        };
    };

    return {
        // 推给所有网页端
        toWeb(msg) { for (const ws of webSockets()) send(ws, msg); },

        // 推给设备(唯一一台)/ 浏览器插件(唯一一个)。不在线返回 false。
        toDevice(msg) { return sendOne(deviceSockets(), msg); },
        toBrowser(msg) { return sendOne(browserSockets(), msg); },

        // 广播给所有执行层(用于 chat.tool.calls:设备 + 浏览器各自捕获;web 用于显示)
        broadcast(msg) { this.toWeb(msg); this.toDevice(msg); this.toBrowser(msg); },

        // 所有执行层连接(设备 + 浏览器),用于连接面板列清单。过滤已断开的僵尸连接。
        executorSockets() {
            return [...deviceSockets(), ...browserSockets()].filter((ws) => {
                try {
                    return ws.readyState === 1 && executorInfo(ws).protocolVersion === EXECUTOR_PROTOCOL_VERSION;
                } catch { return false; }
            });
        },

        // 在线执行层的元信息清单 [{name, kind, caps}]
        executors() {
            return this.executorSockets().map(executorInfo);
        },

        // 定向投给某台执行层(按唯一 name)。找不到返回 false。
        toExecutor(name, msg) {
            for (const ws of this.executorSockets()) {
                if (executorInfo(ws).name === name) { send(ws, msg); return true; }
            }
            return false;
        },

        // 踢掉占用同名的其它连接(多为闪断遗留的休眠僵尸),让新连接接管。返回踢掉数量。
        // 后到者胜:同名设备重连不再被拒,而是替换旧连接 —— 根治"重名死循环"。
        evictName(name, self) {
            let n = 0;
            for (const ws of this.executorSockets()) {
                if (ws === self) continue;
                if (executorInfo(ws).name === name) {
                    try { ws.close(4001, 'replaced by newer connection'); } catch { /* ignore */ }
                    n++;
                }
            }
            return n;
        },

    };
}
