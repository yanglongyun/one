<script setup>
import { computed, ref } from 'vue';
import { useChatStore } from '@/apps/chat/store';
import { useWsStore } from '@/system/stores/ws';
import Icon from '@/system/components/Icon.vue';

const chat = useChatStore();
const ws = useWsStore();
const input = ref('');
const taRef = ref(null);

const canSend = computed(() => ws.connected && !chat.busy && input.value.trim().length > 0);

// 输入法组合态:WebKit(桌面 / 移动 WebView)确认拼音候选词的那个 Enter,
// 往往先触发 compositionend、再 keydown 且 isComposing 已为 false —— 只判 isComposing 会漏拦、误发。
// 自己用 compositionstart/end 兜一个「刚结束」标志,拦住紧随其后的确认 Enter。
let composing = false;
let justComposed = false;
function onCompositionStart() { composing = true; }
function onCompositionEnd() {
    composing = false;
    justComposed = true;
    setTimeout(() => { justComposed = false; }, 0);
}

function onKeydown(event) {
    if (event.key !== 'Enter' || event.shiftKey) return;      // Shift+Enter 换行
    if (composing || justComposed || event.isComposing || event.keyCode === 229) return;  // 输入法组合中,不发
    event.preventDefault();
    send();
}

function send() {
    if (!canSend.value) return;
    const text = input.value;
    input.value = '';
    if (taRef.value) taRef.value.style.height = 'auto';
    chat.send(text);
}

function autoGrow(event) {
    const el = event.target;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 140)}px`;
}

</script>

<template>
    <div class="composer-wrap">
        <div class="composer">
            <textarea
                ref="taRef"
                v-model="input"
                rows="1"
                :placeholder="ws.connected ? '和助理说点什么…' : '等待连接…'"
                :disabled="!ws.connected"
                @keydown="onKeydown"
                @compositionstart="onCompositionStart"
                @compositionend="onCompositionEnd"
                @input="autoGrow"
            ></textarea>
            <button v-if="chat.busy" class="round stop" :title="chat.aborting ? '停止中' : '停止'" :disabled="chat.aborting" @click="chat.abort()">
                <Icon name="stopSq" style="width:18px;height:18px;display:block" />
            </button>
            <button v-else class="round send" title="发送" :disabled="!canSend" @click="send">
                <Icon name="send" style="width:18px;height:18px;display:block" />
            </button>
        </div>
    </div>
</template>
