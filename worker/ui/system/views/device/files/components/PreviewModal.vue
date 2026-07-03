<script setup>
// 文件预览弹窗(.modal 皮)。逻辑不变:text / image / other / loading / error。
import { useFilesStore, humanSize } from '@/system/views/device/files/store';
const files = useFilesStore();
</script>

<template>
    <div v-if="files.preview" class="modal-mask" @click.self="files.closePreview">
        <div class="modal pv-modal">
            <div class="pv-head">
                <div class="grow" style="min-width:0">
                    <div class="pv-name ellipsis">{{ files.preview.name }}</div>
                    <div class="pv-meta ellipsis mono">{{ files.preview.mime || '未知类型' }} · {{ humanSize(files.preview.size) }}</div>
                </div>
                <button class="btn btn-plain" @click="files.downloadPreview">下载</button>
                <button class="icon-btn ghost" title="关闭" @click="files.closePreview">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" style="width:16px;height:16px"><path d="M6 6l12 12M18 6 6 18"/></svg>
                </button>
            </div>

            <div class="pv-body">
                <div v-if="files.preview.kind === 'loading'" class="pv-center">加载中…</div>
                <div v-else-if="files.preview.kind === 'error'" class="pv-center bad">{{ files.preview.error }}</div>
                <pre v-else-if="files.preview.kind === 'text'" class="pv-text mono">{{ files.preview.content }}</pre>
                <div v-else-if="files.preview.kind === 'image'" class="pv-center">
                    <img :src="files.preview.url" class="pv-img" />
                </div>
                <div v-else class="pv-center pv-other">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" style="width:44px;height:44px"><path d="M6 3.5h9.5L20 8v12.5H6z"/><path d="M15 3.5V8.5H20"/></svg>
                    <div>无法预览此文件类型</div>
                    <button class="btn btn-primary" @click="files.downloadPreview">下载查看</button>
                </div>
            </div>
        </div>
    </div>
</template>

<style scoped>
.pv-modal { width: min(760px, 100%); display: flex; flex-direction: column; max-height: 85vh; }
.pv-head { display: flex; align-items: center; gap: 8px; padding-bottom: 14px; border-bottom: 1px solid var(--line-soft); }
.pv-name { font-size: 14px; font-weight: 800; }
.pv-meta { margin-top: 2px; font-size: 11px; font-weight: 500; color: var(--ink-3); }
.pv-body { flex: 1; min-height: 120px; overflow: auto; margin-top: 14px; border-radius: 14px; background: var(--well); }
.pv-center { min-height: 160px; height: 100%; display: flex; align-items: center; justify-content: center; padding: 16px; font-size: 12.5px; color: var(--ink-3); }
.pv-center.bad { color: var(--bad, #d4494e); }
.pv-text { padding: 14px 16px; font-size: 12px; line-height: 1.7; white-space: pre-wrap; word-break: break-all; color: var(--ink); }
.pv-img { max-width: 100%; max-height: 70vh; object-fit: contain; border-radius: 10px; }
.pv-other { flex-direction: column; gap: 12px; }
</style>
