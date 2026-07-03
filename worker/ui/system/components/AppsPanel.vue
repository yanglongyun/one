<script setup>
// 应用面板:顶栏九宫格按钮 → 糖果瓷砖弹层。
// 固定 8 个内置板块 + 动态自定义应用(GET /api/apps)+ 末尾「创建」占位。
import { onMounted, onUnmounted, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { api } from '@/system/api';
import { useWsStore } from '@/system/stores/ws';
import Icon from './Icon.vue';

const props = defineProps({ align: { type: String, default: 'right' } });

const route = useRoute();
const router = useRouter();
const ws = useWsStore();

// 内置板块(顺序与配色跟 demo 一致)
const BUILTIN = [
    { path: '/chat', emoji: '💬', label: '对话' },
    { path: '/tasks', emoji: '⚡', label: '任务' },
    { path: '/schedules', emoji: '⏰', label: '日程' },
    { path: '/goals', emoji: '🎯', label: '目标' },
    { path: '/memories', emoji: '🧠', label: '记忆' },
    { path: '/settings', emoji: '⚙️', label: '设置' },
];

const open = ref(false);
const btnRef = ref(null);
const popStyle = ref({});
const customApps = ref([]);

async function loadApps() {
    try {
        const { apps } = await api.get('/api/apps');
        customApps.value = Array.isArray(apps) ? apps : [];
    } catch { /* 静默:面板里少一截,不打断 */ }
}

let offAppsChanged = null;
onMounted(() => {
    loadApps();
    offAppsChanged = ws.onMessage('apps.changed', loadApps);
});
onUnmounted(() => { offAppsChanged?.(); });

function toggle() {
    if (!open.value && btnRef.value) {
        const r = btnRef.value.getBoundingClientRect();
        const gap = 10;
        popStyle.value = props.align === 'left'
            ? { top: `${r.bottom + gap}px`, left: `${r.left}px` }
            : { top: `${r.bottom + gap}px`, right: `${window.innerWidth - r.right}px` };
        loadApps(); // 每次打开兜底刷新
    }
    open.value = !open.value;
}

function go(path) { open.value = false; if (route.path !== path) router.push(path); }
</script>

<template>
    <div class="relative shrink-0">
        <button ref="btnRef" class="icon-btn candy" title="前往其它板块" @click.stop="toggle">
            <Icon name="grid" style="width:17px;height:17px" />
        </button>

        <Teleport to="body">
            <div v-if="open" class="pop-mask" @click="open = false"></div>
            <div v-if="open" class="pop" :style="popStyle">
                <div class="pop-title">系统</div>
                <div class="app-grid">
                    <button
                        v-for="item in BUILTIN" :key="item.path"
                        class="app-cell" :class="route.path === item.path ? 'on' : ''"
                        @click="go(item.path)"
                    >
                        <span class="tile tile-emoji">{{ item.emoji }}</span>
                        <span class="label">{{ item.label }}</span>
                    </button>
                </div>

                <div class="pop-title" style="margin-top:6px">小应用</div>
                <div class="app-grid">
                    <!-- 自定义应用(AI 生成的板块),无底色瓷砖 -->
                    <button
                        v-for="a in customApps" :key="a.slug"
                        class="app-cell" :class="route.path === `/apps/${a.slug}` ? 'on' : ''"
                        @click="go(`/apps/${a.slug}`)"
                    >
                        <span class="tile tile-emoji" style="font-size:23px">{{ a.icon || (a.name || '?')[0] }}</span>
                        <span class="label ellipsis" style="max-width:100%">{{ a.name || a.slug }}</span>
                    </button>

                    <!-- 创建入口 -->
                    <button class="app-cell" @click="go('/apps/new')">
                        <span class="tile tile-ghost"><Icon name="plus" style="width:22px;height:22px" /></span>
                        <span class="label" style="color:var(--ink-3)">创建</span>
                    </button>
                </div>
            </div>
        </Teleport>
    </div>
</template>
