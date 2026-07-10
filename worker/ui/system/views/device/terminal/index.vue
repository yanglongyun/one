<script setup>
import { computed, nextTick, onActivated, onMounted, onUnmounted, ref, watch } from 'vue';
import { useRoute } from 'vue-router';
import TopBar from '@/system/components/TopBar.vue';
import Icon from '@/system/components/Icon.vue';
import { useWsStore } from '@/system/stores/ws';
import { useTerminalStore } from './store';
import TerminalToolbar from './components/TerminalToolbar.vue';
import TerminalInput from './components/TerminalInput.vue';
import NewTerminalModal from './components/NewTerminalModal.vue';

const route = useRoute();
const ws = useWsStore();
const terminal = useTerminalStore();
const device = computed(() => decodeURIComponent(String(route.params.dev || '')));
const hand = computed(() => ws.hands.find((item) => item.name === device.value) || null);
const online = computed(() => Boolean(hand.value && (hand.value.caps || []).includes('terminal')));
const newOpen = ref(false);
const stage = ref(null);
let observer = null;

function initialize() {
    terminal.initialize(device.value);
    nextTick(terminal.scheduleFit);
}

function setContainer(id, element) {
    if (element) terminal.mount(id, element);
}

onMounted(() => {
    observer = new ResizeObserver(() => terminal.scheduleFit());
    if (stage.value) observer.observe(stage.value);
});
// 页面由 KeepAlive 承载，首次挂载时也会触发 onActivated；只在这里初始化，避免首屏重复请求。
onActivated(initialize);
onUnmounted(() => observer?.disconnect());
watch(device, initialize);
watch(() => ws.connected, (connected) => { if (connected) terminal.requestList(); });
watch(online, (value) => { if (value) terminal.requestList(); });
</script>

<template>
    <div class="app terminal-app">
        <TopBar :back="`/devices/${encodeURIComponent(device)}`" title="终端" :subtitle="device">
            <template #actions>
                <span v-if="online" class="pill pill-ok"><i></i>已连接</span>
            </template>
        </TopBar>

        <template v-if="online">
            <TerminalToolbar @new="newOpen = true" />
            <main ref="stage" class="terminal-stage">
                <section v-for="tab in terminal.tabs" :key="tab.id" v-show="tab.id === terminal.activeId"
                    :ref="(element) => setContainer(tab.id, element)" class="terminal-canvas"></section>
                <div v-if="!terminal.tabs.length" class="terminal-wait">
                    <Icon name="terminal" />
                    <span>正在启动终端…</span>
                </div>
            </main>
            <TerminalInput />
        </template>

        <main v-else class="terminal-offline">
            <div class="empty">
                <div class="empty-art"><Icon name="terminal" /></div>
                <div class="empty-title">终端不可用</div>
                <div class="empty-sub">打开「{{ device }}」上的新版 one 桌面端，连接后即可使用交互式终端。</div>
            </div>
        </main>

        <NewTerminalModal :open="newOpen" @close="newOpen = false" />
    </div>
</template>

<style scoped>
.terminal-app { background: var(--sky-low); }
.terminal-stage { position: relative; flex: 1; min-height: 0; overflow: hidden; background: var(--sky-low); }
.terminal-canvas { position: absolute; inset: 0; min-width: 0; min-height: 0; overflow: hidden; }
.terminal-wait { height: 100%; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 10px; color: var(--ink-3); font-size: 12.5px; }
.terminal-wait .o-icon { width: 30px; height: 30px; color: var(--candy); }
.terminal-offline { flex: 1; min-height: 0; display: grid; place-items: center; }
.terminal-offline .empty-art .o-icon { width: 48px; height: 48px; }
:deep(.xterm) { height: 100%; padding: 10px 12px; }
:deep(.xterm-viewport) { overflow-y: auto !important; background: transparent !important; }
:deep(.xterm-screen) { min-height: 100%; }
@media (max-width: 640px) { :deep(.xterm) { padding: 8px; } }
</style>
