// 鉴权原语(Web Crypto):SHA-256 哈希 + 标准 JWT(HS256)签发/校验。
const enc = new TextEncoder();
const dec = new TextDecoder();

const b64url = (bytes) =>
    btoa(String.fromCharCode(...new Uint8Array(bytes))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

const b64urlDecode = (seg) => {
    const b64 = seg.replace(/-/g, '+').replace(/_/g, '/');
    const bin = atob(b64);
    return Uint8Array.from(bin, (c) => c.charCodeAt(0));
};

const encodeSegment = (obj) => b64url(enc.encode(JSON.stringify(obj)));
const decodeSegment = (seg) => JSON.parse(dec.decode(b64urlDecode(seg)));

const toHex = (buf) =>
    Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, '0')).join('');

export async function sha256(text) {
    return toHex(await crypto.subtle.digest('SHA-256', enc.encode(String(text))));
}

// 常量时间字符串比较:避免用 !== 比对密钥/哈希时的计时侧信道。
export function timingSafeEqual(a, b) {
    const sa = String(a), sb = String(b);
    if (sa.length !== sb.length) return false;
    let diff = 0;
    for (let i = 0; i < sa.length; i++) diff |= sa.charCodeAt(i) ^ sb.charCodeAt(i);
    return diff === 0;
}

// ── 访问口令哈希:PBKDF2-HMAC-SHA256 + 随机盐(慢哈希,抗离线爆破)──
// 存储格式:pbkdf2$<iterations>$<saltB64url>$<hashB64url>,自描述、可平滑升级参数。
const PBKDF2_ITERS = 100_000;

async function pbkdf2(password, salt, iterations) {
    const key = await crypto.subtle.importKey('raw', enc.encode(String(password)), 'PBKDF2', false, ['deriveBits']);
    const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', salt, iterations, hash: 'SHA-256' }, key, 256);
    return new Uint8Array(bits);
}

export async function hashPassword(password) {
    const salt = crypto.getRandomValues(new Uint8Array(16));
    const hash = await pbkdf2(password, salt, PBKDF2_ITERS);
    return `pbkdf2$${PBKDF2_ITERS}$${b64url(salt)}$${b64url(hash)}`;
}

// 校验口令是否匹配存储哈希。兼容历史裸 SHA-256(64 位 hex)记录,便于旧部署平滑过渡。
export async function verifyPasswordHash(password, stored) {
    const s = String(stored || '');
    if (s.startsWith('pbkdf2$')) {
        const [, iterStr, saltB64, hashB64] = s.split('$');
        const iterations = Number(iterStr) || PBKDF2_ITERS;
        const salt = b64urlDecode(saltB64);
        const hash = await pbkdf2(password, salt, iterations);
        return timingSafeEqual(b64url(hash), hashB64);
    }
    // 兼容旧格式(裸 SHA-256 hex)
    if (/^[0-9a-f]{64}$/i.test(s)) return timingSafeEqual(await sha256(password), s);
    return false;
}

async function hmac(data, secret) {
    const key = await crypto.subtle.importKey('raw', enc.encode(String(secret)), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
    return b64url(await crypto.subtle.sign('HMAC', key, enc.encode(data)));
}

const nowSec = () => Math.floor(Date.now() / 1000);
const DEFAULT_EXP = 30 * 24 * 3600; // 30 天

// 签发 JWT(HS256)。payload 自带业务字段(role / id 等),自动加 iat / exp。
export async function signJwt(payload, secret, { expSec = DEFAULT_EXP } = {}) {
    const head = encodeSegment({ alg: 'HS256', typ: 'JWT' });
    const body = encodeSegment({ ...payload, iat: nowSec(), exp: nowSec() + expSec });
    const sig = await hmac(`${head}.${body}`, secret);
    return `${head}.${body}.${sig}`;
}

// 校验 JWT:验签 + 验 exp。通过返回 payload,否则 null。
export async function verifyJwt(token, secret) {
    const [head, body, sig] = String(token || '').split('.');
    if (!head || !body || !sig) return null;
    if (!timingSafeEqual(sig, await hmac(`${head}.${body}`, secret))) return null;
    let payload; try { payload = decodeSegment(body); } catch { return null; }
    if (payload.exp && nowSec() > payload.exp) return null;
    return payload;
}
