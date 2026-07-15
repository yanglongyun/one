export function makePending() {
    const pending = new Map();
    const keyOf = (threadId, id) => `${threadId ?? ''}\u0000${id}`;

    return {
        create(threadId, id, timeoutMs = 5 * 60 * 1000, signal) {
            const key = keyOf(threadId, id);
            if (pending.has(key)) return { id, promise: Promise.resolve({ error: '重复的工具调用 id' }) };
            const promise = new Promise((resolve) => {
                const cleanup = () => {
                    clearTimeout(timer);
                    signal?.removeEventListener('abort', onAbort);
                    pending.delete(key);
                };
                const timer = setTimeout(() => {
                    cleanup();
                    resolve({ error: '设备执行超时' });
                }, timeoutMs);
                const onAbort = () => {
                    cleanup();
                    resolve({ error: '已中止' });
                };
                if (signal?.aborted) {
                    clearTimeout(timer);
                    resolve({ error: '已中止' });
                    return;
                }
                signal?.addEventListener('abort', onAbort, { once: true });
                pending.set(key, { resolve, timer, onAbort, signal });
            });
            return { id, promise };
        },

        resolve(threadId, id, result) {
            const key = keyOf(threadId, id);
            const p = pending.get(key);
            if (!p) return false;
            clearTimeout(p.timer);
            p.signal?.removeEventListener('abort', p.onAbort);
            pending.delete(key);
            p.resolve(result);
            return true;
        },
    };
}
