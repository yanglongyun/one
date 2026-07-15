import { defineStore } from 'pinia';
import { ref } from 'vue';
import { api } from '@/system/api';

// 模型配置:云端 D1 的 settings 表(经 /api/settings REST)。
// config 是安全视图:不含 apiKey 明文,只有 hasKey + keyPreview。
export const useModelStore = defineStore('model', () => {
    const config = ref({
        apiUrl: '', model: '', recentRawMessages: 100,
        compressThreshold: 64000, toolResultMaxChars: 12000, toolMaxRounds: 50,
        hasKey: false, keyPreview: '',
    });
    const loaded = ref(false);

    async function load() {
        const d = await api.get('/api/settings');
        if (d?.config) { config.value = d.config; loaded.value = true; }
        return config.value;
    }
    async function save(patch) {
        const d = await api.put('/api/settings', patch);
        if (d?.config) { config.value = d.config; loaded.value = true; }
        return config.value;
    }

    return { config, loaded, load, save };
});
