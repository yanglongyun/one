import { defineStore } from 'pinia';
import { ref } from 'vue';
import { api } from '@/system/api';
import { useWsStore } from '@/system/stores/ws';

export const useSchedulesStore = defineStore('schedules', () => {
    const ws = useWsStore();
    const items = ref([]);
    const loading = ref(false);
    const nextCursor = ref('');
    let bound = false;

    function bind() {
        if (bound) return;
        bound = true;
        ws.onMessage('schedules.changed', () => load());
    }

    async function load() {
        loading.value = true;
        try {
            const result = await api.get('/api/schedules?limit=50');
            items.value = result.schedules || [];
            nextCursor.value = result.nextCursor || '';
        }
        finally { loading.value = false; }
    }

    async function loadMore() {
        if (!nextCursor.value || loading.value) return;
        loading.value = true;
        try {
            const result = await api.get(`/api/schedules?limit=50&cursor=${encodeURIComponent(nextCursor.value)}`);
            const known = new Set(items.value.map((item) => item.id));
            items.value.push(...(result.schedules || []).filter((item) => !known.has(item.id)));
            nextCursor.value = result.nextCursor || '';
        } finally { loading.value = false; }
    }

    async function save(body) {
        if (body.id) await api.put(`/api/schedules/${body.id}`, body);
        else await api.post('/api/schedules', body);
        await load();
    }

    async function toggle(s) { await api.put(`/api/schedules/${s.id}`, { enabled: !s.enabled }); await load(); }

    async function remove(id) {
        await api.del(`/api/schedules/${id}`);
        items.value = items.value.filter((s) => s.id !== id);
    }

    return { items, loading, nextCursor, bind, load, loadMore, save, toggle, remove };
});
