import { defineStore } from 'pinia';
import { ref } from 'vue';
import { api } from '@/system/api';

export const useSchedulesStore = defineStore('schedules', () => {
    const items = ref([]);
    const loading = ref(false);

    async function load() {
        loading.value = true;
        try { items.value = (await api.get('/api/schedules')).schedules || []; }
        finally { loading.value = false; }
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

    return { items, loading, load, save, toggle, remove };
});
