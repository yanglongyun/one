export const EXECUTOR_PROTOCOL_VERSION = 1;

export function executorHello(msg, channel) {
    if (msg?.type !== 'hello' || msg.protocolVersion !== EXECUTOR_PROTOCOL_VERSION) return null;
    const name = String(msg.name || '').trim();
    const kind = String(msg.kind || '').trim();
    const clientVersion = String(msg.clientVersion || '').trim();
    const validKind = channel === 'browser' ? kind === 'browser' : ['desktop', 'android'].includes(kind);
    if (!name || !clientVersion || !validKind || !Array.isArray(msg.caps)) return null;
    return {
        protocolVersion: EXECUTOR_PROTOCOL_VERSION,
        clientVersion,
        name,
        kind,
        caps: [...new Set(msg.caps.map((cap) => String(cap || '').trim()).filter(Boolean))],
    };
}
