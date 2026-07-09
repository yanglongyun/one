<script setup>
// 对话顶栏:左侧汉堡切换会话侧栏(ChatSidebar,topbar 之下推开式),标题显示当前会话名。
import { computed } from 'vue';
import { useChatStore } from '@/apps/chat/store';
import Icon from '@/system/components/Icon.vue';
import LinksPanel from '@/system/components/LinksPanel.vue';
import AppsPanel from '@/system/components/AppsPanel.vue';

const chat = useChatStore();
const currentTitle = computed(() => chat.currentChat?.title || '新会话');

function toggle() {
    if (!chat.panelOpen) chat.loadChats();
    chat.panelOpen = !chat.panelOpen;
}
</script>

<template>
    <header class="topbar">
        <button class="icon-btn ghost" :class="{ 'menu-on': chat.panelOpen }" title="会话列表" @click="toggle">
            <Icon name="menu" style="width:19px;height:19px" />
        </button>
        <span class="chat-title ellipsis">{{ currentTitle }}</span>
        <span class="spacer"></span>
        <LinksPanel />
        <AppsPanel />
    </header>
</template>

<style scoped>
.chat-title { font-size: 16px; font-weight: 700; letter-spacing: .01em; max-width: 52vw; }
.menu-on { color: var(--candy-deep); background: var(--glass-strong); }
</style>
