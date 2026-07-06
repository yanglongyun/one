// 身份逻辑:访问口令校验 + 设备注册/列表。单用户,无账户概念。
// 鉴权:统一 Bearer JWT(HS256,secret 取自 env.AUTH_SECRET)。无状态,本地验签,不依赖本机。
//   - 网页端:口令 → web JWT
//   - 设备:  注册密钥 → device JWT(payload 带 id)
//   两者同款 JWT;HTTP 走 Authorization 头、WS 走 ?token=(见 index.js / system/realtime/hub.js)。
import { settings } from '../settings.js';
import { sha256, signJwt, verifyJwt, hashPassword, verifyPasswordHash } from './crypto.js';
import * as repo from '../repositories/identity.js';

// 签名密钥 = env.AUTH_SECRET。必须显式配置:缺失即抛错(fail closed),
// 绝不回退到可预测的常量 —— 否则任何人都能伪造合法 JWT 接管公网部署。
// 本地开发同样需要:在 worker/.dev.vars 里写 AUTH_SECRET=...(见 README)。
export const secret = (ctx) => {
    const s = ctx.env.AUTH_SECRET;
    if (!s || typeof s !== 'string' || s.length < 16) {
        throw new Error('AUTH_SECRET 未配置或过短(需 ≥16 字符):npx wrangler secret put AUTH_SECRET');
    }
    return s;
};
export const verify = (ctx, token) => verifyJwt(token, secret(ctx));

// ── 口令暴力破解防护:失败累计到阈值即临时锁定(单用户 → 全局计数即可)──
const MAX_FAILS = 5;
const LOCK_MS = 60_000;

async function throttleCheck(s) {
    const until = Number(await s.get('auth_lock_until', '0')) || 0;
    if (Date.now() < until) {
        return { locked: true, error: `尝试过于频繁,请 ${Math.ceil((until - Date.now()) / 1000)}s 后再试` };
    }
    return { locked: false };
}
async function throttleFail(s) {
    const n = (Number(await s.get('auth_fail_count', '0')) || 0) + 1;
    if (n >= MAX_FAILS) {
        await s.set('auth_lock_until', String(Date.now() + LOCK_MS));
        await s.set('auth_fail_count', '0');
    } else {
        await s.set('auth_fail_count', String(n));
    }
}
async function throttleReset(s) {
    if (Number(await s.get('auth_fail_count', '0')) || Number(await s.get('auth_lock_until', '0'))) {
        await s.set('auth_fail_count', '0');
        await s.set('auth_lock_until', '0');
    }
}

// 校验口令(含限流 + 慢哈希)。未初始化(没设过口令)一律拒绝 —— 不再「无口令即放行」。
// 返回 { ok } 或 { ok:false, error }。
async function checkPassword(db, password) {
    const s = settings(db);
    const gate = await throttleCheck(s);
    if (gate.locked) return { ok: false, error: gate.error };
    const stored = await s.get('pass_hash', '');
    if (!stored) return { ok: false, error: '尚未初始化,请先在初始化页面设置访问密码' };
    if (!(await verifyPasswordHash(password, stored))) {
        await throttleFail(s);
        return { ok: false, error: '口令错误' };
    }
    await throttleReset(s);
    return { ok: true };
}

// 首次引导:是否已设密码(决定前端去 /setup 还是 /guard)
export async function state(ctx) {
    const has = Boolean(await settings(ctx.db).get('pass_hash', ''));
    return { hasPassword: has };
}

// 首次设置密码(仅在未初始化时允许),设完直接发 token。
export async function setup(ctx, { password = '' }) {
    const s = settings(ctx.db);
    if (await s.get('pass_hash', '')) return { ok: false, error: '已初始化,请直接登录' };
    const pw = String(password);
    if (pw.trim().length < 6) return { ok: false, error: '请设置至少 6 位的访问密码' };
    await s.set('pass_hash', await hashPassword(pw));
    const token = await signJwt({ role: 'web' }, secret(ctx));
    return { ok: true, token };
}

// 网页端:口令换 JWT。必须已初始化且口令正确(不再「无口令即放行」)。
export async function login(ctx, { password = '' }) {
    const res = await checkPassword(ctx.db, password);
    if (!res.ok) return res;
    const token = await signJwt({ role: 'web' }, secret(ctx));
    return { ok: true, token };
}

// 在线修改访问口令:先验当前口令,再写入新口令哈希(需已登录 → 走鉴权门,非 public)。
// JWT 无状态,改口令不会顶掉当前网页会话;但各设备下次用旧口令重连会失败,需改用新口令。
export async function changePassword(ctx, { current = '', next = '' }) {
    const chk = await checkPassword(ctx.db, current);
    if (!chk.ok) return { ok: false, error: chk.error === '口令错误' ? '当前口令不正确' : chk.error };
    const pw = String(next);
    if (pw.trim().length < 6) return { ok: false, error: '新口令至少 6 位' };
    await settings(ctx.db).set('pass_hash', await hashPassword(pw));
    return { ok: true };
}

// 单设备:配对/更新这台设备 + 声明能力,换 device JWT。
// 配对是特权操作(签发的 device JWT 与 web token 同权,能过 HTTP 鉴权门)→ 必须先过访问密码。
// 已配对过还需设备密钥匹配;首次配对即设密钥(bootstrap)。换新机器需先在设置解绑。
export async function registerDevice(ctx, { name = '', secret: deviceSecret = '', capabilities = [], password = '' }) {
    if (!(await checkPassword(ctx.db, password)).ok) {
        return { ok: false, error: '访问密码错误,无法配对设备' };
    }
    const existing = await repo.get(ctx.db);
    const incomingHash = deviceSecret ? await sha256(deviceSecret) : '';
    if (existing?.secret_hash && existing.secret_hash !== incomingHash) {
        return { ok: false, error: '设备密钥不匹配(已配对其它设备,先在设置里解绑)' };
    }
    await repo.upsert(ctx.db, { name, secretHash: incomingHash || existing?.secret_hash || '', capabilities }, Date.now());
    const token = await signJwt({ role: 'device' }, secret(ctx));
    return { ok: true, token };
}

// 返回这台配对设备(在线状态活在 DO,这里只反映配对与否)。未配对 → null。
export async function listDevices(ctx) {
    return { device: await repo.get(ctx.db) };
}

// 校验访问密码(与 login 同规则:未初始化或口令错误都拒绝)。供「手」直接用密码连 WS 时核验。
export async function verifyPassword(ctx, password = '') {
    return (await checkPassword(ctx.db, password)).ok;
}
