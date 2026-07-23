import { defineStore } from 'pinia';
import { computed, ref } from 'vue';
import { useWsStore } from '@/system/stores/ws';
import { api } from '@/system/api';
import { mkKey, renderMessages } from '@/system/lib/thread/messages';
import { setupThreadStream } from '@/system/lib/thread/stream';

// 历史行的 body 是 JSON 字符串(整条消息),解析失败兜底为 {role, content}
const parseBody = (m) => { try { return JSON.parse(m.body); } catch { return { role: m.role, content: m.body }; } };

const CHAT_ID_KEY = 'one_chat_id';

// 多会话对话:会话列表来自 /api/chats(置顶在前、按更新时间排),消息按 ?chat=<id> 拉。
// 直播走 DO 的 WS:chat.input 必须带 threadId=会话 id,chat.* 事件按 threadId 认领
// (stream.js 在创建时固定 threadId,所以切换会话时重建 stream 而不是复用)。
export const useChatStore = defineStore('chat', () => {
    const ws = useWsStore();

    // ── 会话列表 ──
    const chats = ref([]);
    const chatNextCursor = ref('');
    const loadingChats = ref(false);
    const currentId = ref('');
    const currentChat = computed(() => chats.value.find((c) => c.id === currentId.value) || null);

    // ── 当前会话消息态 ──
    const messages = ref([]);
    const busy = ref(false);
    const aborting = ref(false);
    const ready = ref(false);
    const streamTick = ref(0);
    const viewSeq = ref(0);
    const hasMore = ref(false);
    const loadingOlder = ref(false);
    const PAGE = 50;
    const CHAT_PAGE = 50;
    let oldestId = 0;
    let lastSig = '';

    let bound = false;
    let stream = null;

    const pushRow = (row) => { messages.value.push(row); return messages.value[messages.value.length - 1]; };
    const bumpStream = () => { streamTick.value++; };

    const saveId = (id) => { try { localStorage.setItem(CHAT_ID_KEY, id || ''); } catch { /* ignore */ } };
    const loadId = () => { try { return localStorage.getItem(CHAT_ID_KEY) || ''; } catch { return ''; } };

    // stream.js 按创建时传入的 threadId 过滤事件,切会话时必须重建
    function rebuildStream() {
        stream?.resetStreaming();
        stream = setupThreadStream({ threadId: currentId.value, messages, busy, pushRow, refresh, bumpStream });
    }

    function bind() {
        if (bound) return;
        bound = true;
        ws.onMessage('chat.*', (e) => {
            stream?.onEvent(e);
            if ((e.threadId || null) === (currentId.value || null) && ['chat.done', 'chat.aborted', 'chat.error'].includes(e.type)) {
                aborting.value = false;
            }
        });
        // 后端在会话首条消息后自动起标题并广播 chats.changed
        ws.onMessage('chats.changed', () => loadChats());
        ws.onMessage('chat.deleted', async (e) => {
            await loadChats();
            if (e.threadId !== currentId.value) return;
            currentId.value = '';
            messages.value = [];
            ready.value = false;
            busy.value = false;
            aborting.value = false;
            const next = chats.value[0]?.id;
            if (next) await switchChat(next);
            else createChat();
        });
    }

    async function loadChats() {
        if (loadingChats.value) return chats.value;
        loadingChats.value = true;
        const target = Math.max(CHAT_PAGE, chats.value.length);
        const rows = [];
        let cursor = '';
        try {
            do {
                const params = new URLSearchParams({ limit: String(CHAT_PAGE) });
                if (cursor) params.set('cursor', cursor);
                const result = await api.get(`/api/chats?${params}`).catch(() => null);
                if (!result) return chats.value;
                rows.push(...(result.chats || []));
                cursor = result.nextCursor || '';
            } while (cursor && rows.length < target);
            chats.value = rows;
            chatNextCursor.value = cursor;
        } finally {
            loadingChats.value = false;
        }
        return chats.value;
    }

    async function loadMoreChats() {
        if (!chatNextCursor.value || loadingChats.value) return;
        loadingChats.value = true;
        try {
            const result = await api.get(`/api/chats?limit=${CHAT_PAGE}&cursor=${encodeURIComponent(chatNextCursor.value)}`);
            const known = new Set(chats.value.map((chat) => chat.id));
            chats.value.push(...(result.chats || []).filter((chat) => !known.has(chat.id)));
            chatNextCursor.value = result.nextCursor || '';
        } finally {
            loadingChats.value = false;
        }
    }

    // 入口:拉会话列表 → 恢复/兜底 currentId → 绑流 → 拉消息。可重复调用(重连时)。
    async function init() {
        bind();
        await loadChats();
        let id = loadId();
        if (!id || !chats.value.some((c) => c.id === id)) id = chats.value[0]?.id || '';
        if (!id) { createChat(); return; } // 一条会话都没有:进空白草稿,不落库
        currentId.value = id;
        saveId(id);
        rebuildStream();
        await refresh();
    }

    async function refresh() {
        if (!currentId.value) return;
        const chatId = currentId.value;
        const d = await api.get(`/api/messages?chat=${encodeURIComponent(chatId)}&limit=${PAGE}`).catch(() => null);
        if (!d || chatId !== currentId.value) return; // 期间切走了,丢弃
        const rows = d.messages || [];
        // 内容指纹没变就跳过整体替换,避免无谓重渲染(闪动)
        const sig = `${rows.length}:${rows[0]?.id || 0}:${rows[rows.length - 1]?.id || 0}`;
        if (ready.value && sig === lastSig && !messages.value.some((m) => m.streaming)) return;
        lastSig = sig;
        oldestId = rows[0]?.id || 0;
        hasMore.value = Boolean(d.hasMore);
        messages.value = renderMessages(rows.map(parseBody));
        ready.value = true;
        viewSeq.value++;
    }

    // 切换会话:流式中先 abort(简单可靠 —— 避免旧会话残留 busy 态锁住输入框,
    // 后端也不会有"看不见的输出"继续跑)。然后重置消息态、重建 stream、拉新会话历史。
    async function switchChat(id) {
        if (!id || id === currentId.value) return;
        if (busy.value) abort();
        currentId.value = id;
        saveId(id);
        messages.value = [];
        ready.value = false;
        hasMore.value = false;
        oldestId = 0;
        lastSig = '';
        busy.value = false;
        aborting.value = false;
        rebuildStream();
        await refresh();
    }

    // 新对话 = 本地空白草稿,不落库不进历史;首条消息发出时(send)才真正建会话
    function createChat() {
        if (busy.value) abort();
        currentId.value = '';
        saveId('');
        messages.value = [];
        ready.value = true;
        hasMore.value = false;
        oldestId = 0;
        lastSig = '';
        busy.value = false;
        aborting.value = false;
        stream?.resetStreaming();
        stream = null;
        viewSeq.value++;
    }

    async function togglePin(id) {
        const chat = chats.value.find((c) => c.id === id);
        if (!chat) return;
        await api.put(`/api/chats/${id}`, { pinned: !chat.pinned }).catch(() => null);
        await loadChats(); // 排序交给后端(置顶在前)
    }

    async function renameChat(id, title) {
        await api.put(`/api/chats/${id}`, { title: (title || '').trim() }).catch(() => null);
        await loadChats();
    }

    async function removeChat(id) {
        const removed = await api.del(`/api/chats/${id}`).catch(() => null);
        if (!removed?.ok) return false;
        await loadChats();
        if (id !== currentId.value) return true;
        // 删的是当前会话:切到列表第一条;列表空了就进空白草稿
        currentId.value = ''; // 保证 switchChat 不被同 id 短路
        const next = chats.value[0]?.id;
        if (next) await switchChat(next);
        else createChat();
        return true;
    }

    // 上滑加载更早一页:往 messages 头部插入,返回本次条数(MessageStream 据此维持滚动位置)
    async function loadOlder() {
        if (!hasMore.value || loadingOlder.value || !oldestId) return 0;
        loadingOlder.value = true;
        try {
            const d = await api.get(`/api/messages?chat=${encodeURIComponent(currentId.value)}&before=${oldestId}&limit=${PAGE}`).catch(() => null);
            const rows = d?.messages || [];
            if (!rows.length) { hasMore.value = false; return 0; }
            oldestId = rows[0].id;
            hasMore.value = Boolean(d?.hasMore);
            messages.value = [...renderMessages(rows.map(parseBody)), ...messages.value];
            return rows.length;
        } finally {
            loadingOlder.value = false;
        }
    }

    async function send(text, retryRow = null) {
        const content = (text || '').trim();
        if (!content || busy.value) return;
        const row = retryRow || pushRow({
            role: 'user', _key: mkKey('user'), content,
            clientId: crypto.randomUUID(), sending: true, failed: false,
        });
        row.clientId ||= crypto.randomUUID();
        row.sending = true;
        row.failed = false;
        busy.value = true;
        aborting.value = false;
        viewSeq.value++;
        bumpStream();
        // 空白草稿的首条消息:此刻才真正建会话
        if (!currentId.value) {
            const d = await api.post('/api/chats', {}).catch(() => null);
            if (!d?.chat) {
                row.sending = false;
                row.failed = true;
                busy.value = false;
                bumpStream();
                return;
            }
            chats.value = [d.chat, ...chats.value.filter((c) => c.id !== d.chat.id)];
            currentId.value = d.chat.id;
            saveId(d.chat.id);
            rebuildStream();
        }
        const sent = ws.sendMsg({
            type: 'chat.input', threadId: currentId.value, text: content,
            clientId: row.clientId,
        });
        if (!sent) {
            row.sending = false;
            row.failed = true;
            busy.value = false;
            bumpStream();
        }
    }

    function retry(row) {
        if (!row?.failed) return;
        return send(row.content, row);
    }

    function abort() {
        if (!busy.value || aborting.value) return;
        aborting.value = true;
        ws.sendMsg({ type: 'chat.abort', threadId: currentId.value });
        stream?.resetStreaming();
        bumpStream();
    }

    return {
        chats, currentId, currentChat, chatNextCursor, loadingChats,
        messages, busy, aborting, ready,
        streamTick, viewSeq, hasMore, loadingOlder,
        bind, init, loadChats, loadMoreChats, refresh, loadOlder,
        switchChat, createChat, togglePin, renameChat, removeChat,
        send, retry, abort,
    };
});
