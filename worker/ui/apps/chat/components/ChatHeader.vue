<script setup>
// 对话顶栏:窄屏汉堡开全局侧栏,标题显示当前会话名。
import { computed } from 'vue';
import { useChatStore } from '@/apps/chat/store';
import { useShellStore } from '@/system/stores/shell';
import Icon from '@/system/components/Icon.vue';

const chat = useChatStore();
const shell = useShellStore();
const currentTitle = computed(() => chat.currentChat?.title || '新对话');
</script>

<template>
    <header class="topbar">
        <button class="icon-btn ghost menu-btn" title="菜单" @click="shell.toggleSidebar()">
            <Icon name="menu" style="width:19px;height:19px" />
        </button>
        <span class="chat-title ellipsis">{{ currentTitle }}</span>
        <span class="spacer"></span>
    </header>
</template>

<style scoped>
.chat-title { font-size: 15px; font-weight: 600; letter-spacing: .01em; max-width: 52vw; }
.menu-btn { display: none; }
@media (max-width: 640px) {
    .menu-btn { display: grid; }
}
</style>
