<script setup>
import { computed, ref } from 'vue';
import { useChatStore } from '@/apps/chat/store';
import { useWsStore } from '@/system/stores/ws';
import Icon from '@/system/components/Icon.vue';

const chat = useChatStore();
const ws = useWsStore();
const input = ref('');
const taRef = ref(null);
const fileRef = ref(null);
const images = ref([]);

const canSend = computed(() => ws.connected && !chat.busy && (input.value.trim().length > 0 || images.value.length > 0));

function onKeydown(event) {
    if (event.key === 'Enter' && !event.shiftKey && !event.isComposing) {
        event.preventDefault();
        send();
    }
}

function send() {
    if (!canSend.value) return;
    const text = input.value;
    const selected = images.value;
    input.value = '';
    images.value = [];
    if (fileRef.value) fileRef.value.value = '';
    if (taRef.value) taRef.value.style.height = 'auto';
    chat.send(text, selected);
}

function autoGrow(event) {
    const el = event.target;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 140)}px`;
}

function chooseImages() {
    if (!ws.connected || chat.busy) return;
    fileRef.value?.click();
}

async function onFiles(event) {
    const files = Array.from(event.target.files || [])
        .filter((file) => file.type.startsWith('image/'))
        .slice(0, Math.max(0, 10 - images.value.length));
    const next = [];
    for (const file of files) {
        next.push({
            name: file.name,
            type: file.type,
            size: file.size,
            dataUrl: await readDataUrl(file),
        });
    }
    images.value = [...images.value, ...next].slice(0, 10);
    event.target.value = '';
}

function removeImage(index) {
    images.value = images.value.filter((_, i) => i !== index);
}

function readDataUrl(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result || ''));
        reader.onerror = reject;
        reader.readAsDataURL(file);
    });
}

</script>

<template>
    <div class="composer-wrap">
        <button v-if="chat.busy" class="stop-float" @click="chat.abort()"><span class="sq"></span>停止生成</button>
        <div v-if="images.length" class="image-strip">
            <button v-for="(image, i) in images" :key="`${image.name}:${i}`" class="image-chip" title="移除图片" @click="removeImage(i)">
                <img :src="image.dataUrl" :alt="image.name" />
                <span>{{ image.name }}</span>
            </button>
        </div>
        <div class="composer">
            <input ref="fileRef" type="file" accept="image/*" multiple style="display:none" @change="onFiles" />
            <button class="round" title="图片" :disabled="!ws.connected || chat.busy || images.length >= 10" @click="chooseImages">
                <Icon name="clip" style="width:19px;height:19px;display:block" />
            </button>
            <textarea
                ref="taRef"
                v-model="input"
                rows="1"
                :placeholder="ws.connected ? '和助理说点什么…' : '等待连接…'"
                :disabled="!ws.connected"
                @keydown="onKeydown"
                @input="autoGrow"
            ></textarea>
            <button v-if="chat.busy" class="round stop" title="停止" @click="chat.abort()">
                <Icon name="stopSq" style="width:18px;height:18px;display:block" />
            </button>
            <button v-else class="round send" title="发送" :disabled="!canSend" @click="send">
                <Icon name="send" style="width:18px;height:18px;display:block" />
            </button>
        </div>
    </div>
</template>

<style scoped>
.stop-float {
    position: absolute;
    left: 50%;
    top: -34px;
    transform: translateX(-50%);
    display: inline-flex;
    align-items: center;
    gap: 7px;
    height: 34px;
    padding: 0 15px;
    border-radius: 99px;
    background: rgba(255,255,255,.94);
    box-shadow: var(--shadow-m);
    border: 1px solid rgba(255,255,255,.9);
    font-size: 12.5px;
    font-weight: 700;
    color: var(--bad);
    transition: transform .18s var(--spring), box-shadow .18s;
}
.stop-float:hover {
    transform: translate(-50%, -2px);
    box-shadow: var(--shadow-l);
}
.stop-float .sq {
    width: 9px;
    height: 9px;
    border-radius: 3px;
    background: var(--bad);
}
.image-strip {
    display: flex;
    gap: 8px;
    max-width: min(720px, 100%);
    margin: 0 auto 8px;
    overflow-x: auto;
    padding: 2px;
}
.image-chip {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    min-width: 0;
    max-width: 150px;
    height: 40px;
    padding: 4px 8px 4px 4px;
    border-radius: 12px;
    background: rgba(255,255,255,.92);
    border: 1px solid rgba(255,255,255,.95);
    box-shadow: var(--shadow-s);
    color: var(--ink2);
    font-size: 11px;
    font-weight: 700;
}
.image-chip img {
    width: 32px;
    height: 32px;
    border-radius: 8px;
    object-fit: cover;
    flex: 0 0 auto;
}
.image-chip span {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
}
</style>
