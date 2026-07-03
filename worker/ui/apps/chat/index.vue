<script setup>
import { onMounted, watch } from 'vue';
import { useChatStore } from '@/apps/chat/store';
import { useWsStore } from '@/system/stores/ws';
import ChatHeader from './components/ChatHeader.vue';
import Composer from './components/Composer.vue';
import MessageStream from './components/MessageStream.vue';
import ChatSidebar from './components/ChatSidebar.vue';

const chat = useChatStore();
const ws = useWsStore();

onMounted(() => {
    chat.init();
});
// 首次连接不重刷(init 的数据就是刚拉的,重刷只会闪一下);真正断线重连才刷,补上断线期间漏掉的消息
let hadConnected = false;
watch(() => ws.connected, (ok) => {
    if (!ok) return;
    if (!hadConnected) {
        hadConnected = true;
        if (!chat.currentId) chat.init(); // init 尚未完成时的兜底
        return;
    }
    if (chat.currentId) { chat.loadChats(); chat.refresh(); } else { chat.init(); }
});
</script>

<template>
    <div class="app">
        <ChatHeader />
        <div class="chat-body">
            <ChatSidebar />
            <div class="chat-main">
                <MessageStream />
                <Composer />
            </div>
        </div>
    </div>
</template>

<style scoped>
/* topbar 之下:侧栏 + 对话区并排,侧栏展开时把对话区推开 */
.chat-body { flex: 1; min-height: 0; display: flex; position: relative; }
.chat-main { flex: 1; min-width: 0; display: flex; flex-direction: column; }
</style>
