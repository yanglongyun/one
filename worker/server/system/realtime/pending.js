export function makePending() {
    const pending = new Map();

    return {
        create(id, timeoutMs = 5 * 60 * 1000, signal) {
            const promise = new Promise((resolve) => {
                const cleanup = () => {
                    clearTimeout(timer);
                    signal?.removeEventListener('abort', onAbort);
                    pending.delete(id);
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
                pending.set(id, { resolve, timer, onAbort, signal });
            });
            return { id, promise };
        },

        resolve(id, result) {
            const p = pending.get(id);
            if (!p) return false;
            clearTimeout(p.timer);
            p.signal?.removeEventListener('abort', p.onAbort);
            pending.delete(id);
            p.resolve(result);
            return true;
        },
    };
}

