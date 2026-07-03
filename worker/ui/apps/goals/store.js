import { defineStore } from 'pinia';
import { ref } from 'vue';
import { api } from '@/system/api';

export const useGoalsStore = defineStore('goals', () => {
    const items = ref([]);
    const loading = ref(false);

    async function load() {
        loading.value = true;
        try { items.value = (await api.get('/api/goals')).goals || []; }
        finally { loading.value = false; }
    }

    async function save(goal) {
        if (goal.id) await api.put(`/api/goals/${goal.id}`, goal);
        else await api.post('/api/goals', goal);
        await load();
    }

    async function remove(id) {
        await api.del(`/api/goals/${id}`);
        items.value = items.value.filter((g) => g.id !== id);
    }

    return { items, loading, load, save, remove };
});
