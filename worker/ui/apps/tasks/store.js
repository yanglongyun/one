import { defineStore } from 'pinia';
import { ref } from 'vue';
import { useWsStore } from '@/system/stores/ws';
import { api } from '@/system/api';

// 任务列表:结果卡片,不是聊天。REST 拉初始列表,WS 的 task.created/task.updated 实时刷新状态
// (pending → running → done/failed/aborted),不用手动轮询。
export const useTasksStore = defineStore('tasks', () => {
    const ws = useWsStore();
    const items = ref([]);
    const loading = ref(false);
    const statusFilter = ref('');
    const nextCursor = ref('');
    const counts = ref({});

    let bound = false;
    function bind() {
        if (bound) return;
        bound = true;
        ws.onMessage('task.created', (m) => {
            if (m.task && (!statusFilter.value || m.task.status === statusFilter.value)) items.value.unshift(m.task);
        });
        ws.onMessage('task.updated', (m) => {
            const t = m.task;
            if (!t) return;
            const row = items.value.find((x) => x.id === t.id);
            if (row) Object.assign(row, t);
        });
    }

    async function load(status = statusFilter.value) {
        statusFilter.value = status || '';
        loading.value = true;
        try {
            const q = statusFilter.value ? `?limit=50&status=${encodeURIComponent(statusFilter.value)}` : '?limit=50';
            const res = await api.get(`/api/tasks${q}`);
            items.value = res.tasks || [];
            nextCursor.value = res.nextCursor || '';
            counts.value = res.counts || {};
        } finally { loading.value = false; }
    }

    async function loadMore() {
        if (!nextCursor.value || loading.value) return;
        loading.value = true;
        try {
            const params = new URLSearchParams({ limit: '50', cursor: nextCursor.value });
            if (statusFilter.value) params.set('status', statusFilter.value);
            const res = await api.get(`/api/tasks?${params}`);
            const known = new Set(items.value.map((item) => item.id));
            items.value.push(...(res.tasks || []).filter((item) => !known.has(item.id)));
            nextCursor.value = res.nextCursor || '';
            counts.value = res.counts || counts.value;
        } finally { loading.value = false; }
    }

    async function remove(id) {
        const result = await api.del(`/api/tasks/${id}`);
        const task = items.value.find((t) => t.id === id);
        if (task && result?.task) Object.assign(task, result.task);
    }

    return { items, loading, statusFilter, nextCursor, counts, bind, load, loadMore, remove };
});
