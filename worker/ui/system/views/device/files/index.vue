<script setup>
// 文件(只读)(demo device-files.html)。数据逻辑不变:useFilesStore + ws。
import { computed, onMounted, watch } from 'vue';
import { useRoute } from 'vue-router';
import { useFilesStore } from '@/system/views/device/files/store';
import { useWsStore } from '@/system/stores/ws';
import TopBar from '@/system/components/TopBar.vue';
import Icon from '@/system/components/Icon.vue';
import FilesToolbar from '@/system/views/device/files/components/FilesToolbar.vue';
import FileList from '@/system/views/device/files/components/FileList.vue';
import PreviewModal from '@/system/views/device/files/components/PreviewModal.vue';
import ActionSheet from '@/system/views/device/files/components/ActionSheet.vue';

const files = useFilesStore();
const ws = useWsStore();
const route = useRoute();
const dev = computed(() => route.params.dev);              // 这台设备的 id(/devices/:dev/files)
const online = computed(() => ws.hands.some((h) => h.name === dev.value));

function bind() {
    if (ws.connected && online.value) files.setDevice(dev.value);
}

onMounted(bind);
watch(dev, bind);                                          // 切设备
watch(() => ws.connected, (v) => { if (v) bind(); });     // 重连后
watch(online, (v) => { if (v) bind(); });                 // 这台设备上线后
</script>

<template>
    <div class="app">
        <TopBar :back="'/devices/' + encodeURIComponent(dev)" title="文件" :subtitle="dev" />

        <main class="page">
            <div class="page-inner">
                <template v-if="online">
                    <FilesToolbar />
                    <FileList />
                </template>
                <div v-else class="empty">
                    <div class="empty-art"><Icon name="folder" style="width:34px;height:34px" /></div>
                    <div class="empty-title">设备不在线</div>
                    <div class="empty-sub">「{{ dev }}」上线后就能浏览它的文件了。打开这台设备上的 One,连到本账户即可。</div>
                </div>
            </div>
        </main>

        <PreviewModal />
        <ActionSheet />
    </div>
</template>
