<script setup>
// 长按/右键操作单(.modal 皮)。逻辑不变:目前只有「下载到本地」。
import { useFilesStore, humanSize } from '@/system/views/device/files/store';
const files = useFilesStore();

function handle(kind) {
    const e = files.actionSheet;
    if (!e) return;
    files.closeActionSheet();
    if (kind === 'download') files.downloadEntry(e);
}
</script>

<template>
    <div v-if="files.actionSheet" class="modal-mask" @click.self="files.closeActionSheet">
        <div class="modal">
            <div class="modal-title as-title">
                <span class="ellipsis">{{ files.actionSheet.name }}</span>
                <span class="as-sub mono">{{ files.actionSheet.type === 'dir' ? '目录' : humanSize(files.actionSheet.size) }}</span>
            </div>
            <div class="as-actions">
                <button v-if="files.actionSheet.type !== 'dir'" class="as-item" @click="handle('download')">
                    下载到本地
                </button>
            </div>
            <div class="modal-foot">
                <button class="btn btn-plain" @click="files.closeActionSheet">取消</button>
            </div>
        </div>
    </div>
</template>

<style scoped>
.as-title { display: flex; align-items: baseline; gap: 10px; min-width: 0; }
.as-sub { font-size: 11.5px; font-weight: 600; color: var(--ink-3); flex-shrink: 0; }
.as-actions { display: flex; flex-direction: column; gap: 4px; }
.as-item {
    text-align: left; font-size: 13.5px; font-weight: 600; color: var(--ink);
    padding: 11px 12px; border-radius: 12px;
    transition: background .13s;
}
.as-item:hover { background: var(--well); }
</style>
