// 与 worker DO 的实时连接(/api/realtime/ws?token=JWT)。单设备:不再有"选哪台"概念。
// 消息统一用 type 判别,按 app 前缀分(chat.* / fs.* / terminal.* / …)。
// 设备消息直接转发给那台唯一设备(DO 侧单目标),前端无需附 device。
import { defineStore } from 'pinia';
import { computed, ref } from 'vue';
import { getToken } from '@/system/api';

export const useWsStore = defineStore('ws', () => {
    const state = ref('offline');     // offline | pending | connected
    const connected = computed(() => state.value === 'connected');
    const statusText = computed(() => (
        state.value === 'connected' ? '已连接'
            : state.value === 'pending' ? '连接中…'
                : '连接已断开,重连中…'
    ));

    // 在线执行层「手」清单(来自 DO 的 device.presence):[{kind, name}]
    const hands = ref([]);
    // 有「真设备手」(桌面/安卓,能跑 shell/files)才算设备在线;纯浏览器插件不算
    const deviceOnline = computed(() => hands.value.some((h) => h.kind === 'desktop' || h.kind === 'android'));

    // key → Set<handler>:多条线可以同时挂(主对话 + 打开中的某个 task 详情都在听 chat.*),
    // 各自按事件里的 threadId 认领归自己的,互不覆盖。
    const handlers = new Map();
    let socket = null;
    let timer = null;
    let stopped = false;

    function onMessage(key, handler) {
        if (!handlers.has(key)) handlers.set(key, new Set());
        handlers.get(key).add(handler);
        return () => handlers.get(key)?.delete(handler);
    }

    function sendMsg(msg) {
        if (socket?.readyState !== WebSocket.OPEN) return false;
        socket.send(JSON.stringify(msg));
        return true;
    }

    function connect() {
        const token = getToken();
        if (!token) { state.value = 'offline'; return; }
        clearTimeout(timer);
        state.value = 'pending';
        const proto = location.protocol === 'https:' ? 'wss:' : 'ws:';
        socket = new WebSocket(`${proto}//${location.host}/api/realtime/ws?token=${encodeURIComponent(token)}`);

        socket.onopen = () => { state.value = 'connected'; };
        socket.onmessage = (e) => {
            let msg; try { msg = JSON.parse(e.data); } catch { return; }
            if (msg.type === 'device.presence') {
                hands.value = Array.isArray(msg.hands) ? msg.hands : [];
            }
            handlers.get(msg.type)?.forEach((fn) => fn(msg));
            // app 级前缀分发:注册 'chat.*' 即可收该 app 全部事件(chat.start/delta/tool.calls/…)
            const dot = msg.type.indexOf('.');
            if (dot > 0) handlers.get(`${msg.type.slice(0, dot)}.*`)?.forEach((fn) => fn(msg));
        };
        socket.onclose = () => {
            state.value = 'offline';
            hands.value = [];
            if (!stopped) { clearTimeout(timer); timer = setTimeout(connect, 3000); }
        };
        socket.onerror = () => {};
    }

    function start() { stopped = false; connect(); }
    function stop() { stopped = true; clearTimeout(timer); try { socket?.close(); } catch { /* ignore */ } }

    return {
        state, connected, statusText,
        hands, deviceOnline,
        onMessage, sendMsg, start, stop,
    };
});
