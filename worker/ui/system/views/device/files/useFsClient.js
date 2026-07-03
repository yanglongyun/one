import { useWsStore } from '@/system/stores/ws';

// 本机文件「只读」客户端:浏览 + 读取。事件 files.*(无写操作)。
const pending = new Map();
let handlersBound = false;

function bindHandlers(ws) {
    if (handlersBound) return;
    handlersBound = true;
    ws.onMessage('files.result', (msg) => {
        const h = pending.get(msg.data?.reqId);
        if (!h) return;
        if (msg.data.ok) h.resolve?.(msg.data);
        else h.reject?.(new Error(msg.data.error || '未知错误'));
    });
    ws.onMessage('files.read.meta', (msg) => {
        pending.get(msg.data?.reqId)?.onMeta?.(msg.data);
    });
    ws.onMessage('files.read.chunk', (msg) => {
        pending.get(msg.data?.reqId)?.onChunk?.(msg.data);
    });
}

function newReqId() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

// getDeviceId:返回当前目标设备 id(从路由 /devices/:dev 来),所有 files.* 消息按 id 定向投递。
export function useFsClient(getDeviceId = () => '') {
    const ws = useWsStore();
    bindHandlers(ws);

    function call(type, data, timeoutMs = 30000) {
        return new Promise((resolve, reject) => {
            if (!ws.connected) {
                reject(new Error('客户端未连接'));
                return;
            }
            const reqId = newReqId();
            const timer = setTimeout(() => {
                pending.delete(reqId);
                reject(new Error('响应超时'));
            }, timeoutMs);
            pending.set(reqId, {
                resolve: (v) => { clearTimeout(timer); pending.delete(reqId); resolve(v); },
                reject: (e) => { clearTimeout(timer); pending.delete(reqId); reject(e); },
            });
            if (!ws.sendMsg({ type, to: getDeviceId(), data: { reqId, ...data } })) {
                clearTimeout(timer);
                pending.delete(reqId);
                reject(new Error('客户端未连接'));
            }
        });
    }

    function fsRead(path, onProgress) {
        return new Promise((resolve, reject) => {
            if (!ws.connected) {
                reject(new Error('客户端未连接'));
                return;
            }
            const reqId = newReqId();
            const chunks = [];
            let meta = null;
            let total = 0;
            const timer = setTimeout(() => {
                pending.delete(reqId);
                reject(new Error('读取超时'));
            }, 60000);
            pending.set(reqId, {
                onMeta: (m) => { meta = m; },
                onChunk: (c) => {
                    if (c.data) {
                        const bin = atob(c.data);
                        const arr = new Uint8Array(bin.length);
                        for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
                        chunks.push(arr);
                        total += arr.length;
                    }
                    if (meta && onProgress) onProgress(total, meta.size);
                    if (c.eof) {
                        clearTimeout(timer);
                        pending.delete(reqId);
                        const blob = new Blob(chunks, { type: meta?.mime || 'application/octet-stream' });
                        resolve({ meta: meta || {}, blob });
                    }
                },
                reject: (e) => { clearTimeout(timer); pending.delete(reqId); reject(e); },
            });
            if (!ws.sendMsg({ type: 'files.read', to: getDeviceId(), data: { reqId, path } })) {
                clearTimeout(timer);
                pending.delete(reqId);
                reject(new Error('客户端未连接'));
            }
        });
    }

    return {
        fsHome: () => call('files.home', {}),
        fsList: (path, showHidden = false) => call('files.list', { path, showHidden }),
        fsStat: (path) => call('files.stat', { path }),
        fsRead,
    };
}
