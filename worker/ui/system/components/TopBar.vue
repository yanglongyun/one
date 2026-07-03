<script setup>
// 共享顶栏(demo .topbar):
//   <TopBar title="任务">                      → brand + 标题 + 默认右侧(设备/应用面板)
//   <TopBar back title="详情">                 → 返回按钮(history.back)
//   <TopBar back="/tasks" title="详情">        → 返回到指定路径
//   <template #actions>…</template>            → 面板左侧插入页面自定义按钮(如「新建」)
import { useRouter } from 'vue-router';
import Icon from './Icon.vue';
import LinksPanel from './LinksPanel.vue';
import AppsPanel from './AppsPanel.vue';

const props = defineProps({
    // false 无返回;true → history.back;字符串 → 跳该路径
    back: { type: [Boolean, String], default: false },
    // 是否显示品牌方块(有返回按钮时通常不显示)
    brand: { type: Boolean, default: undefined },
    // 品牌处显示 emoji 瓷砖(小应用容器用:左上角 = 应用图标)
    emoji: { type: String, default: '' },
    title: { type: String, default: '' },
    subtitle: { type: String, default: '' },
    // 是否渲染默认右侧面板(设备 + 应用)
    panels: { type: Boolean, default: true },
});

const router = useRouter();
const showBrand = () => (props.brand === undefined ? !props.back : props.brand);

function goBack() {
    if (typeof props.back === 'string') { router.push(props.back); return; }
    if (window.history.length > 1) router.back();
    else router.push('/chat');
}
</script>

<template>
    <header class="topbar">
        <button v-if="back" class="icon-btn ghost" title="返回" @click="goBack">
            <Icon name="back" style="width:18px;height:18px" />
        </button>
        <span v-if="emoji" class="brand brand-emoji">{{ emoji }}</span>
        <span v-else-if="showBrand()" class="brand">1</span>
        <span v-if="title" class="title">{{ title }}</span>
        <span v-if="subtitle" class="subtitle">{{ subtitle }}</span>
        <span class="spacer"></span>
        <!-- 页面自定义按钮(如「新建」) -->
        <slot name="actions"></slot>
        <template v-if="panels">
            <LinksPanel />
            <AppsPanel />
        </template>
    </header>
</template>
