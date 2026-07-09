<script setup>
import { fmtArgs, fmtResult, toolLabel, toolSubtitle } from '@/system/lib/thread/format';

defineProps({
    items: { type: Array, required: true },
});

// 三态:执行中 / 失败(result.error 存在)/ 完成
function pillOf(item) {
    if (item.status === 'running') return { cls: 'pill-run', text: '执行中' };
    if (isFailed(item)) return { cls: 'pill-bad', text: '失败' };
    return { cls: 'pill-ok', text: '完成' };
}

function isFailed(item) {
    const r = item.result;
    if (r && typeof r === 'object') return Boolean(r.error);
    if (typeof r === 'string') {
        try { return Boolean(JSON.parse(r)?.error); } catch { return false; }
    }
    return false;
}
</script>

<template>
    <div class="msg-tools rise-enter">
        <span class="ai-mark">AI</span>
        <div class="toolcard">
            <div
                v-for="item in items"
                :key="item._key"
                class="tool-row"
                :class="{ open: item.expanded }"
            >
                <div class="tool-head" @click="item.expanded = !item.expanded">
                    <svg class="caret" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 6 15 12 9 18"/></svg>
                    <span class="summary">{{ toolSubtitle(item) || toolLabel(item.name) }}</span>
                    <span class="pill" :class="pillOf(item).cls"><i></i>{{ pillOf(item).text }}</span>
                </div>
                <div class="tool-body">
                    <div class="k">输入</div>
                    <pre>{{ fmtArgs(item.args) }}</pre>
                    <template v-if="item.result">
                        <div class="k">输出</div>
                        <pre>{{ fmtResult(item.result) }}</pre>
                    </template>
                </div>
            </div>
        </div>
    </div>
</template>

<style scoped>
.msg-tools {
    align-self: flex-start;
    width: min(82%, 640px);
    margin: 5px 0;
    display: flex;
    gap: 10px;
}
.msg-tools .ai-mark {
    flex-shrink: 0;
    width: 28px;
    height: 28px;
    border-radius: 10px;
    margin-top: 2px;
    display: grid;
    place-items: center;
    background: var(--panel);
    color: var(--candy-deep);
    font-size: 12px;
    font-weight: 800;
    box-shadow: var(--shadow-s);
}
.msg-tools .toolcard {
    flex: 1;
    min-width: 0;
}
.toolcard {
    border-radius: var(--r-m);
    background: var(--panel);
    box-shadow: var(--shadow-s);
    border: 1px solid var(--line-soft);
    overflow: hidden;
}
.tool-row { border-top: 1px solid var(--line-soft); }
.tool-row:first-child { border-top: 0; }
.tool-head {
    display: flex;
    align-items: center;
    gap: 9px;
    padding: 10px 14px;
    cursor: pointer;
    user-select: none;
    transition: background .15s;
}
.tool-head:hover { background: var(--well); }
.tool-head .caret {
    color: var(--ink-4);
    transition: transform .2s var(--ease);
    flex-shrink: 0;
}
.tool-row.open .caret { transform: rotate(90deg); }
.tool-head .summary {
    flex: 1;
    min-width: 0;
    font-size: 13px;
    font-weight: 600;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
}
.tool-body {
    padding: 2px 14px 12px;
    display: none;
}
.tool-row.open .tool-body { display: block; }
.tool-body .k {
    font-size: 11px;
    font-weight: 700;
    color: var(--ink-3);
    margin: 9px 0 5px;
}
.tool-body pre {
    margin: 0;
    padding: 10px 12px;
    background: var(--code);
    border-radius: 10px;
    font-family: var(--mono);
    font-size: 11.5px;
    line-height: 1.65;
    color: var(--ink2);
    white-space: pre-wrap;
    word-break: break-word;
    max-height: 240px;
    overflow: auto;
}

@media (max-width: 640px) {
    .msg-tools { width: 100%; margin-left: 0; }
    .msg-tools .ai-mark { width: 24px; height: 24px; border-radius: 8px; font-size: 10.5px; }
    .tool-head { padding: 10px 12px; }
    .tool-body { padding: 2px 12px 12px; }
}
</style>
