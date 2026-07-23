import { defineStore } from 'pinia';
import { ref } from 'vue';
import { api } from '@/system/api';
import { useWsStore } from '@/system/stores/ws';

export const useNotesStore = defineStore('notes', () => {
    const ws = useWsStore();
    const items = ref([]);
    const loading = ref(false);
    const nextCursor = ref('');
    let bound = false;

    function bind() {
        if (bound) return;
        bound = true;
        ws.onMessage('notes.changed', () => load());
    }

    async function load() {
        loading.value = true;
        try {
            const res = await api.get('/api/notes?limit=50');
            items.value = res.notes || [];
            nextCursor.value = res.nextCursor || '';
        } finally { loading.value = false; }
    }

    async function loadMore() {
        if (!nextCursor.value || loading.value) return;
        loading.value = true;
        try {
            const res = await api.get(`/api/notes?limit=50&cursor=${encodeURIComponent(nextCursor.value)}`);
            const known = new Set(items.value.map((item) => item.id));
            items.value.push(...(res.notes || []).filter((item) => !known.has(item.id)));
            nextCursor.value = res.nextCursor || '';
        } finally { loading.value = false; }
    }

    async function save(note) {
        if (note.id) await api.put(`/api/notes/${note.id}`, note);
        else await api.post('/api/notes', note);
        await load();
    }

    async function remove(id) {
        await api.del(`/api/notes/${id}`);
        items.value = items.value.filter((item) => item.id !== id);
    }

    return { items, loading, nextCursor, bind, load, loadMore, save, remove };
});
