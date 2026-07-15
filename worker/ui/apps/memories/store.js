import { defineStore } from 'pinia';
import { ref } from 'vue';
import { api } from '@/system/api';
import { useWsStore } from '@/system/stores/ws';

export const useMemoriesStore = defineStore('memories', () => {
    const ws = useWsStore();
    const items = ref([]);
    const loading = ref(false);
    const filter = ref('');
    const nextCursor = ref('');
    let bound = false;

    function bind() {
        if (bound) return;
        bound = true;
        ws.onMessage('memories.changed', () => load());
    }

    async function load(nextFilter = filter.value) {
        filter.value = nextFilter || '';
        loading.value = true;
        try {
            const params = new URLSearchParams({ limit: '50' });
            if (filter.value) params.set('visibility', filter.value);
            const res = await api.get(`/api/memories?${params}`);
            items.value = res.memories || [];
            nextCursor.value = res.nextCursor || '';
        } finally { loading.value = false; }
    }

    async function loadMore() {
        if (!nextCursor.value || loading.value) return;
        loading.value = true;
        try {
            const params = new URLSearchParams({ limit: '50', cursor: nextCursor.value });
            if (filter.value) params.set('visibility', filter.value);
            const res = await api.get(`/api/memories?${params}`);
            const known = new Set(items.value.map((item) => item.id));
            items.value.push(...(res.memories || []).filter((item) => !known.has(item.id)));
            nextCursor.value = res.nextCursor || '';
        } finally { loading.value = false; }
    }

    async function save(memory) {
        if (memory.id) await api.put(`/api/memories/${memory.id}`, memory);
        else await api.post('/api/memories', memory);
        await load();
    }

    async function remove(id) {
        await api.del(`/api/memories/${id}`);
        items.value = items.value.filter((item) => item.id !== id);
    }

    return { items, loading, filter, nextCursor, bind, load, loadMore, save, remove };
});
