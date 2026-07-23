<script setup>
// 应用面板:顶栏九宫格按钮 → 糖果瓷砖弹层。
import { ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import Icon from './Icon.vue';

const props = defineProps({ align: { type: String, default: 'right' } });

const route = useRoute();
const router = useRouter();

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

function toggle() {
    if (!open.value && btnRef.value) {
        const r = btnRef.value.getBoundingClientRect();
        const gap = 10;
        popStyle.value = props.align === 'left'
            ? { top: `${r.bottom + gap}px`, left: `${r.left}px` }
            : { top: `${r.bottom + gap}px`, right: `${window.innerWidth - r.right}px` };
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
            </div>
        </Teleport>
    </div>
</template>
