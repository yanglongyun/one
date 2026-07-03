<script setup>
// 文件列表大卡(demo .file-card):表头 + 行 + 底部「只读访问」。逻辑不变。
import { useFilesStore, humanSize, relTime } from '@/system/views/device/files/store';
import Icon from '@/system/components/Icon.vue';

const files = useFilesStore();

let pressTimer = null;
let pressTriggered = false;

function onPressStart(entry) {
    pressTriggered = false;
    clearTimeout(pressTimer);
    pressTimer = setTimeout(() => {
        pressTriggered = true;
        files.openActionSheet(entry);
    }, 500);
}
function onPressEnd() { clearTimeout(pressTimer); }
function onClick(entry) {
    if (pressTriggered) { pressTriggered = false; return; }
    files.openEntry(entry);
}
</script>

<template>
    <div class="card file-card">
        <div class="f-grid f-head">
            <span></span>
            <span>名称</span>
            <span style="text-align:right">大小</span>
            <span class="f-time-col">修改时间</span>
            <span></span>
        </div>

        <div v-if="files.loading" class="f-msg">加载中…</div>
        <div v-else-if="files.errorMsg" class="f-msg bad">{{ files.errorMsg }}</div>
        <div v-else-if="files.viewEntries.length === 0" class="f-msg">
            {{ files.filterText ? `没有匹配「${files.filterText}」的文件` : '(空目录)' }}
        </div>

        <template v-else>
            <div v-for="entry in files.viewEntries" :key="entry.name"
                class="f-grid f-row" :class="{ 'is-dir': entry.type === 'dir' }"
                @click="onClick(entry)"
                @pointerdown="onPressStart(entry)"
                @pointerup="onPressEnd"
                @pointerleave="onPressEnd"
                @pointercancel="onPressEnd"
                @contextmenu.prevent="files.openActionSheet(entry)">
                <span class="f-ico" :class="entry.type === 'dir' ? 'dir' : 'doc'">
                    <Icon :name="entry.type === 'dir' ? 'folder' : 'doc'" />
                </span>
                <span class="f-name">{{ entry.name }}</span>
                <span class="f-size mono" :class="{ dim: entry.type === 'dir' }">
                    {{ entry.type === 'dir' ? '—' : humanSize(entry.size) }}
                </span>
                <span class="f-time f-time-col">{{ relTime(entry.mtime) }}</span>
                <span class="f-more">
                    <svg v-if="entry.type === 'dir'" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><polyline points="9.5 6 15.5 12 9.5 18"/></svg>
                </span>
            </div>
        </template>

        <div class="f-note">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="5" y="10.5" width="14" height="9.5" rx="2.5"/><path d="M8.5 10.5V7.5a3.5 3.5 0 0 1 7 0v3"/><circle cx="12" cy="15.2" r="1" fill="currentColor" stroke="none"/></svg>
            只读访问
        </div>
    </div>
</template>

<style scoped>
.file-card { padding: 8px 8px 0; }
.f-grid { display: grid; grid-template-columns: 30px minmax(0,1fr) 88px 104px 18px; align-items: center; gap: 10px; }
.f-head {
    padding: 8px 12px 7px;
    font-size: 11px; font-weight: 800; letter-spacing: .04em;
    color: var(--ink-3);
    border-bottom: 1px solid var(--line-soft);
}
.f-row {
    padding: 8px 12px;
    border-radius: 12px;
    cursor: pointer;
    transition: background .13s;
    text-align: left;
}
.f-row:hover { background: var(--well); }
.f-ico {
    width: 28px; height: 28px; border-radius: 9px;
    display: grid; place-items: center;
}
.f-ico :deep(svg) { width: 15px; height: 15px; }
.f-ico.dir { background: var(--run-soft); color: var(--run); }
.f-ico.doc { background: var(--candy-soft); color: var(--candy); }
.f-name { font-size: 13px; font-weight: 600; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.f-size { font-size: 12px; color: var(--ink2); text-align: right; }
.f-size.dim { color: var(--ink-4); }
.f-time { font-size: 12px; color: var(--ink-3); font-weight: 500; }
.f-more { color: var(--ink-4); display: grid; place-items: center; }
.f-more svg { width: 13px; height: 13px; }
.f-msg { padding: 26px 12px; text-align: center; font-size: 12.5px; color: var(--ink-3); }
.f-msg.bad { color: var(--bad, #d4494e); }
.f-note {
    margin-top: 6px;
    padding: 10px 12px 12px;
    border-top: 1px solid var(--line-soft);
    display: flex; align-items: center; gap: 7px;
    font-size: 11.5px; font-weight: 500; color: var(--ink-3);
}
.f-note svg { width: 13px; height: 13px; flex-shrink: 0; }

@media (max-width: 640px) {
    .f-grid { grid-template-columns: 30px minmax(0,1fr) 72px 18px; }
    .f-time-col { display: none; }
}
</style>
