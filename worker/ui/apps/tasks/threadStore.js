import { defineStore } from 'pinia';
import { ref } from 'vue';
import { useWsStore } from '@/system/stores/ws';
import { api } from '@/system/api';
import { renderMessages } from '@/system/lib/thread/messages';
import { setupThreadStream } from '@/system/lib/thread/stream';

const parseBody = (m) => { try { return JSON.parse(m.body); } catch { return { role: m.role, content: m.body }; } };

// 某个 task 详情页自己的线:同一套 chat.* 协议,threadId = 该 task id。
// 一次只看一个 task(路由切换时 open(newId) 换线,不是每个 task 各建一个 store 实例)。
export const useTaskThreadStore = defineStore('taskThread', () => {
    const ws = useWsStore();

    const taskId = ref('');
    const task = ref(null);
    const messages = ref([]);
    const busy = ref(false);
    const hasMore = ref(false);
    const loadingOlder = ref(false);
    const streamTick = ref(0);
    const viewSeq = ref(0);
    const PAGE = 50;
    let oldestId = 0;

    let bound = false;
    let stream = null;

    const pushRow = (row) => { messages.value.push(row); return messages.value[messages.value.length - 1]; };
    const bumpStream = () => { streamTick.value++; };

    function rebind() {
        stream = setupThreadStream({ threadId: taskId.value, messages, busy, pushRow, refresh: refreshTask, bumpStream });
    }

    function bind() {
        if (bound) return;
        bound = true;
        ws.onMessage('chat.*', (e) => stream?.onEvent(e));
        ws.onMessage('task.updated', (m) => { if (m.task && m.task.id === taskId.value) Object.assign(task.value || (task.value = {}), m.task); });
    }

    async function refreshTask() {
        const d = await api.get(`/api/tasks/${taskId.value}`).catch(() => null);
        if (d?.task) task.value = d.task;
    }

    async function open(id) {
        bind();
        taskId.value = id;
        rebind();
        task.value = null;
        messages.value = [];
        busy.value = false;
        oldestId = 0;
        hasMore.value = false;
        await refreshTask();
        const d = await api.get(`/api/tasks/${id}/messages?limit=${PAGE}`).catch(() => null);
        const rows = d?.messages || [];
        oldestId = rows[0]?.id || 0;
        hasMore.value = Boolean(d?.hasMore);
        messages.value = renderMessages(rows.map(parseBody));
        busy.value = task.value?.status === 'running';
        viewSeq.value++;
    }

    async function loadOlder() {
        if (!hasMore.value || loadingOlder.value || !oldestId) return 0;
        loadingOlder.value = true;
        try {
            const d = await api.get(`/api/tasks/${taskId.value}/messages?before=${oldestId}&limit=${PAGE}`).catch(() => null);
            const rows = d?.messages || [];
            if (!rows.length) { hasMore.value = false; return 0; }
            oldestId = rows[0].id;
            hasMore.value = Boolean(d?.hasMore);
            messages.value = [...renderMessages(rows.map(parseBody)), ...messages.value];
            return rows.length;
        } finally { loadingOlder.value = false; }
    }

    return {
        taskId, task, messages, busy, hasMore, loadingOlder, streamTick, viewSeq,
        open, loadOlder,
    };
});
