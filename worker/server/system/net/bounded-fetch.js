const PRIVATE_HOST = /^(localhost|.*\.localhost|.*\.local|0\.0\.0\.0|127(?:\.\d{1,3}){3}|10(?:\.\d{1,3}){3}|172\.(?:1[6-9]|2\d|3[01])(?:\.\d{1,3}){2}|192\.168(?:\.\d{1,3}){2}|169\.254(?:\.\d{1,3}){2}|\[(?:fc|fd|fe80|::1)[0-9a-f:]*\])$/i;

function checkedUrl(value) {
    const url = new URL(String(value || ''));
    if (!['http:', 'https:'].includes(url.protocol)) throw new Error('只允许 http(s) 地址');
    if (PRIVATE_HOST.test(url.hostname) || url.hostname === '[::1]') throw new Error('不允许访问本机或私有网络地址');
    return url;
}

function combinedSignal(signal, timeoutMs) {
    const timeout = AbortSignal.timeout(timeoutMs);
    return signal ? AbortSignal.any([signal, timeout]) : timeout;
}

async function readLimited(response, maxResponseBytes) {
    const reader = response.body?.getReader();
    if (!reader) return { body: '', truncated: false };
    const chunks = [];
    let total = 0;
    let truncated = false;
    while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const room = maxResponseBytes - total;
        if (value.byteLength > room) {
            if (room > 0) chunks.push(value.slice(0, room));
            truncated = true;
            await reader.cancel();
            break;
        }
        chunks.push(value);
        total += value.byteLength;
    }
    const bytes = new Uint8Array(chunks.reduce((sum, chunk) => sum + chunk.byteLength, 0));
    let offset = 0;
    for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
    return { body: new TextDecoder().decode(bytes), truncated };
}

export async function boundedFetch(value, init = {}, options = {}) {
    const timeoutMs = Math.min(60000, Math.max(1000, Number(options.timeoutMs) || 15000));
    const maxResponseBytes = Math.min(2_000_000, Math.max(1024, Number(options.maxResponseBytes) || 512000));
    const maxRequestBytes = Math.min(1_000_000, Math.max(1024, Number(options.maxRequestBytes) || 256000));
    const maxRedirects = Math.min(5, Math.max(0, Number(options.maxRedirects) || 3));
    let url = checkedUrl(value);
    let headers = new Headers(init.headers || {});
    const body = init.body == null ? undefined : String(init.body);
    if (body && new TextEncoder().encode(body).byteLength > maxRequestBytes) throw new Error('请求体过大');
    const method = String(init.method || 'GET').toUpperCase();
    const signal = combinedSignal(init.signal, timeoutMs);

    for (let redirect = 0; ; redirect += 1) {
        const response = await fetch(url, { ...init, method, headers, body, redirect: 'manual', signal });
        if (![301, 302, 303, 307, 308].includes(response.status)) {
            return { response, ...(await readLimited(response, maxResponseBytes)) };
        }
        if (redirect >= maxRedirects) throw new Error('重定向次数过多');
        if (!['GET', 'HEAD'].includes(method)) throw new Error('非 GET 请求不自动跟随重定向');
        const location = response.headers.get('location');
        if (!location) throw new Error('重定向缺少 Location');
        const next = checkedUrl(new URL(location, url).toString());
        if (next.origin !== url.origin) {
            headers = new Headers(headers);
            headers.delete('authorization');
            headers.delete('cookie');
            headers.delete('x-api-key');
        }
        url = next;
    }
}
