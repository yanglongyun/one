<script setup>
// 共享顶栏(主区顶部,品牌与设备面板在左侧栏,这里只管当前页):
//   <TopBar title="任务">                      → 汉堡(窄屏)+ 标题
//   <TopBar back title="详情">                 → 返回按钮(history.back)
//   <TopBar back="/tasks" title="详情">        → 返回到指定路径
//   <template #actions>…</template>            → 右侧插入页面自定义按钮(如「新建」)
import { useRouter } from 'vue-router';
import { useShellStore } from '@/system/stores/shell';
import Icon from './Icon.vue';

const props = defineProps({
    // false 无返回;true → history.back;字符串 → 跳该路径
    back: { type: [Boolean, String], default: false },
    title: { type: String, default: '' },
    subtitle: { type: String, default: '' },
});

const router = useRouter();
const shell = useShellStore();

function goBack() {
    if (typeof props.back === 'string') { router.push(props.back); return; }
    if (window.history.length > 1) router.back();
    else router.push('/chat');
}
</script>

<template>
    <header class="topbar">
        <button v-if="!back" class="icon-btn ghost menu-btn" title="菜单" @click="shell.toggleSidebar()">
            <Icon name="menu" style="width:19px;height:19px" />
        </button>
        <button v-if="back" class="icon-btn ghost" title="返回" @click="goBack">
            <Icon name="back" style="width:18px;height:18px" />
        </button>
        <span v-if="title" class="title">{{ title }}</span>
        <span v-if="subtitle" class="subtitle">{{ subtitle }}</span>
        <span class="spacer"></span>
        <!-- 页面自定义按钮(如「新建」) -->
        <slot name="actions"></slot>
    </header>
</template>

<style scoped>
/* 汉堡只在窄屏出现(桌面侧栏常驻) */
.menu-btn { display: none; }
@media (max-width: 640px) {
    .menu-btn { display: grid; }
}
</style>
