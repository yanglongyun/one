import { defineStore } from 'pinia';
import { ref } from 'vue';
import { api } from '@/system/api';
import { useWsStore } from '@/system/stores/ws';

export const useGoalsStore = defineStore('goals', () => {
    const ws = useWsStore();
    const items = ref([]);
    const loading = ref(false);
    const nextCursor = ref('');
    let bound = false;

    function bind() {
        if (bound) return;
        bound = true;
        ws.onMessage('goals.changed', () => load());
    }

    async function load() {
        loading.value = true;
        try {
            const result = await api.get('/api/goals?limit=50');
            items.value = result.goals || [];
            nextCursor.value = result.nextCursor || '';
        }
        finally { loading.value = false; }
    }

    async function loadMore() {
        if (!nextCursor.value || loading.value) return;
        loading.value = true;
        try {
            const result = await api.get(`/api/goals?limit=50&cursor=${encodeURIComponent(nextCursor.value)}`);
            const known = new Set(items.value.map((item) => item.id));
            items.value.push(...(result.goals || []).filter((item) => !known.has(item.id)));
            nextCursor.value = result.nextCursor || '';
        } finally { loading.value = false; }
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

    return { items, loading, nextCursor, bind, load, loadMore, save, remove };
});
