<script setup>
// 小应用运行容器:系统顶栏(应用 icon + 名称)+ 全屏 iframe 载入 /api/apps/<slug>/runtime。
// 应用本身无顶栏(避免双重顶部);切换/退出走右侧九宫格。
import { computed, onMounted, ref } from 'vue';
import { useRoute } from 'vue-router';
import TopBar from '@/system/components/TopBar.vue';
import { api } from '@/system/api';

const route = useRoute();
const slug = computed(() => String(route.params.slug || ''));
const name = ref('');
const emoji = ref('');

onMounted(async () => {
    try {
        const { apps } = await api.get('/api/apps');
        const app = (apps || []).find((a) => a.slug === slug.value);
        name.value = app?.name || slug.value;
        emoji.value = app?.icon || '';
    } catch { name.value = slug.value; }
});
</script>

<template>
    <div class="app">
        <TopBar :emoji="emoji" :title="name || slug" />
        <iframe class="run-frame" :src="`/api/apps/${encodeURIComponent(slug)}/runtime/`" :title="name || slug"></iframe>
    </div>
</template>

<style scoped>
.run-frame { flex: 1; min-height: 0; width: 100%; border: 0; background: transparent; }
</style>
