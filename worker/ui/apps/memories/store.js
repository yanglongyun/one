import { defineStore } from 'pinia';
import { ref } from 'vue';
import { api } from '@/system/api';

export const useMemoriesStore = defineStore('memories', () => {
    const items = ref([]);
    const loading = ref(false);
    const filter = ref('');

    async function load(nextFilter = filter.value) {
        filter.value = nextFilter || '';
        loading.value = true;
        try {
            const q = filter.value ? `?visibility=${encodeURIComponent(filter.value)}&limit=500` : '?limit=500';
            const res = await api.get(`/api/memories${q}`);
            items.value = res.memories || [];
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

    return { items, loading, filter, load, save, remove };
});
