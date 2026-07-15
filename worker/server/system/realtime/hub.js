// OneHub:账户实时中枢。WS Hibernation 入口 + 事件分发;agent 住在里面跑。
// 单用户 · 单设备 → 全局唯一实例(idFromName('one'))。
//
// 连接(WS 升级在 /api/realtime/ws):
//   ?role=web      网页端:发聊天、收流式;终端/屏幕等设备消息的转发对端
//   ?role=device   这台设备:收工具/转发请求,回结果
//
// 消息协议:事件即类型(app.xxx,无 kind)。完整事件流见下方 web ↔ DO ↔ 设备 的注释。
//   web → DO:    { type:'chat.input', threadId, text } / { type:'chat.abort', threadId }  其余转发给设备
//   DO → web:    chat.start / chat.delta / chat.tool.calls / chat.tool.result / chat.done …;另有 device.presence / task.created / task.updated
//   DO → web+设备: { type:'chat.tool.calls', threadId, calls } 各端执行层自捕获归属自己的工具
//   设备 → DO:   { type:'chat.tool.result', threadId, id, result } 按 id 兑现 + 转发给 web
//
// spawnTask:开一个新 task 并立即跑第一轮,不阻塞发起方。应用、日程、目标共用这一个入口。
import { DurableObject } from 'cloudflare:workers';
import { makeDispatch } from './dispatch.js';
import { makePending } from './pending.js';
import { runChatTurn } from '../sessions/chat.js';
import { runTaskTurn } from '../sessions/task.js';
import { createTask } from '../services/tasks.js';
import { runDueSchedules } from '../services/schedules.js';
import { runDueGoals } from '../services/goals.js';
import { recoverTasks } from '../services/tasks.js';
import { EXECUTOR_PROTOCOL_VERSION, executorHello } from './protocol.js';
import { verify, verifyPassword } from '../identity/service.js';
import * as deviceRepo from '../repositories/identity.js';

export class OneHub extends DurableObject {
    constructor(ctx, env) {
        super(ctx, env);
        this.ctx = ctx;
        this.env = env;
        this.db = env.DB;
        this.dispatch = makeDispatch(ctx);
        this.pending = makePending();
        this.turns = new Map(); // threadId(null=主对话) → { controller, promise }
        this.ctx.blockConcurrencyWhile(async () => {
            await recoverTasks(this.hub(), (id) => this.turns.has(id));
            await this.reconcileAlarm();
        });
    }

    async fetch(request) {
        if (request.headers.get('Upgrade') !== 'websocket') return new Response('hub', { status: 200 });

        const url = new URL(request.url);
        // 鉴权(全平台「主域名 + 密码」):
        //   网页:?token=(密码登录换来的 web JWT)。
        //   手(桌面/安卓/浏览器):?password= + ?role=device|browser —— 密码即凭证,角色由 client 声明。
        let tag;
        const token = url.searchParams.get('token');
        if (token) {
            const payload = await verify({ env: this.env }, token);
            if (!payload) return new Response('unauthorized', { status: 401 });
            tag = payload.role === 'device' ? 'device' : payload.role === 'browser' ? 'browser' : 'web';
        } else {
            const ok = await verifyPassword({ db: this.db }, url.searchParams.get('password') || '');
            if (!ok) return new Response('unauthorized', { status: 401 });
            tag = url.searchParams.get('role') === 'browser' ? 'browser' : 'device';
        }

        const { 0: client, 1: server } = new WebSocketPair();
        this.ctx.acceptWebSocket(server, [tag]);
        if (tag === 'device') await deviceRepo.touch(this.db, Date.now()).catch(() => {});
        if (tag === 'web') this.broadcastPresence();
        return new Response(null, { status: 101, webSocket: client });
    }

    async webSocketMessage(ws, raw) {
        let msg; try { msg = JSON.parse(raw); } catch { return; }
        const tags = this.ctx.getTags(ws) || [];
        if (tags.includes('device') || tags.includes('browser')) return this.fromExecutor(ws, msg);
        return this.fromWeb(msg);
    }

    async webSocketClose() { this.broadcastPresence(); }
    async webSocketError() { this.broadcastPresence(); }

    // ── 网页端来的 ──
    async fromWeb(msg) {
        if (msg.type === 'chat.input') {
            const threadId = msg.threadId || null;
            return this.startChatTurn(threadId, { text: msg.text, clientId: msg.clientId });
        }
        if (msg.type === 'chat.abort') {
            await this.stopThread(msg.threadId || null, '用户已终止');
            return;
        }
        // 设备功能(files/status…)定向投给 msg.to 指定的那台设备;无 to 兜底给首台。
        if (msg.to) { this.dispatch.toExecutor(msg.to, msg); return; }
        this.dispatch.toDevice(msg);
    }

    // ── 执行层来的(设备 / 浏览器插件) ──
    fromExecutor(ws, msg) {
        // 自报身份(类型 + 名字)→ 记到这条连接,刷新连接面板
        if (msg.type === 'hello') {
            const channel = (this.ctx.getTags(ws) || []).includes('browser') ? 'browser' : 'device';
            const hello = executorHello(msg, channel);
            if (!hello) {
                try { ws.close(4002, 'client upgrade required'); } catch { /* 已断 */ }
                return;
            }
            // 同名旧连接(多为闪断遗留的休眠僵尸)→ 踢掉,本连接接管(后到者胜),根治重名死循环
            this.dispatch.evictName(hello.name, ws);
            try { ws.serializeAttachment(hello); } catch { /* ignore */ }
            this.broadcastPresence();
            return;
        }
        let attachment = {};
        try { attachment = ws.deserializeAttachment() || {}; } catch { /* ignore */ }
        if (attachment.protocolVersion !== EXECUTOR_PROTOCOL_VERSION) {
            try { ws.close(4002, 'hello required'); } catch { /* 已断 */ }
            return;
        }
        // 工具结果:按 id 兑现 loop 的等待(loop 统一把结果发给 web 显示,这里不重复转发)
        if (msg.type === 'chat.tool.result') { this.pending.resolve(msg.threadId || null, msg.id, msg.result); return; }
        // 其余(files/status/terminal 等)→ 标记来源设备后转发给网页端。
        // 来源名让同时打开的多台设备能力页各自认领消息,避免终端输出串台。
        this.dispatch.toWeb({ ...msg, from: attachment.name || '设备' });
    }

    // 起一个聊天 turn,挂 abort 控制,收尾清自己。
    // 不 await 调用方也没关系 —— 多个 threadId 可以各自独立并行跑。
    startChatTurn(threadId, input) {
        if (this.turns.has(threadId)) {
            this.dispatch.toWeb({ type: 'chat.error', threadId, clientId: input?.clientId, content: '当前会话仍在处理中,请先终止或等待完成。', code: 'turn_busy' });
            return Promise.resolve();
        }
        const controller = new AbortController();
        const record = { controller, promise: null };
        this.turns.set(threadId, record);
        const hub = this.hub();
        const turn = runChatTurn(hub, threadId, input, controller.signal)
            .catch((e) => this.dispatch.toWeb({ type: 'chat.error', threadId, clientId: input?.clientId, content: e.message || String(e) }))
            .finally(() => { if (this.turns.get(threadId) === record) this.turns.delete(threadId); });
        record.promise = turn;
        this.ctx.waitUntil(turn);
        return turn;
    }

    // 起一个任务 turn。任务只由 spawnTask 创建后启动。
    startTaskTurn(threadId, input) {
        if (this.turns.has(threadId)) return Promise.resolve();
        const controller = new AbortController();
        const record = { controller, promise: null };
        this.turns.set(threadId, record);
        const hub = this.hub();
        const turn = runTaskTurn(hub, threadId, input, controller.signal)
            .catch((e) => this.dispatch.toWeb({ type: 'chat.error', threadId, content: e.message || String(e) }))
            .finally(() => { if (this.turns.get(threadId) === record) this.turns.delete(threadId); });
        record.promise = turn;
        this.ctx.waitUntil(turn);
        return turn;
    }

    async stopThread(threadId, reason = '已终止') {
        const record = this.turns.get(threadId || null);
        if (!record) return { running: false, stopped: true };
        record.controller.abort(reason);
        const stopped = await Promise.race([
            record.promise.then(() => true, () => true),
            new Promise((resolve) => setTimeout(() => resolve(false), 10000)),
        ]);
        return { running: true, stopped };
    }

    notifyWeb(message) {
        this.dispatch.toWeb(message);
    }

    // 开一个新 task(状态 pending)并立即起第一轮。origin: ai/schedule/goal/app。
    async spawnTask({ title, prompt, origin = 'ai', originId = null, responseFormat = null }) {
        return createTask(this.hub(), { title, prompt, origin, originId, responseFormat });
    }

    async alarm() {
        await recoverTasks(this.hub(), (id) => this.turns.has(id));
        await runDueSchedules(this.hub());
        await runDueGoals(this.hub());
        await this.reconcileAlarm();
    }

    async reconcileAlarm() {
        const now = Date.now();
        const row = await this.db.prepare(`
          SELECT MIN(due_at) AS due_at FROM (
            SELECT MIN(next_run_at) AS due_at FROM schedules WHERE enabled = 1 AND next_run_at IS NOT NULL
            UNION ALL SELECT MIN(next_run_at) FROM goals WHERE status = 'active' AND next_run_at IS NOT NULL
            UNION ALL SELECT MIN(CASE WHEN status = 'pending' THEN ? ELSE lease_until END)
              FROM tasks WHERE status = 'pending' OR (status = 'running' AND lease_until IS NOT NULL)
          )
        `).bind(now).first();
        const dueAt = Number(row?.due_at);
        if (!Number.isFinite(dueAt) || dueAt <= 0) {
            await this.ctx.storage.deleteAlarm();
            return null;
        }
        const alarmAt = Math.max(dueAt, now + 1000);
        const current = await this.ctx.storage.getAlarm();
        if (!current || Math.abs(current - alarmAt) > 1000) await this.ctx.storage.setAlarm(alarmAt);
        return alarmAt;
    }

    // agent loop / tick 用的句柄:把 DO 能力收口成一个对象注入
    hub() {
        const dispatch = this.dispatch;
        const pending = this.pending;
        const db = this.db;
        return {
            db,
            toWeb: (m) => dispatch.toWeb(m),
            broadcast: (m) => dispatch.broadcast(m), // web + 设备 + 浏览器
            toExecutor: (name, m) => dispatch.toExecutor(name, m), // 按 name 定向
            // 在线执行层清单 [{name,kind,caps}],喂给 prompt + 供 agent 选目标设备
            executors: () => dispatch.executors(),
            // 等设备回某次工具调用的结果(按 LLM tool call 的 id 关联)
            awaitResult: (threadId, id, signal) => pending.create(threadId, id, 5 * 60 * 1000, signal).promise,
            // 开新 task 并行跑,供 RPC/app bridge 等入口复用。
            spawnTask: (opts) => this.spawnTask(opts),
            startTaskTurn: (threadId, input) => this.startTaskTurn(threadId, input),
            reconcileAlarm: () => this.reconcileAlarm(),
            stopThread: (threadId, reason) => this.stopThread(threadId, reason),
        };
    }

    // 连接面板数据:当前所有在线执行层(手)的清单 [{id, kind, name, caps}]。
    broadcastPresence() {
        const hands = this.dispatch.executors().map(({ name, kind, caps }) => ({ name, kind, caps }));
        this.dispatch.toWeb({ type: 'device.presence', hands });
    }
}
