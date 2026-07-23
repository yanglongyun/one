<script setup>
import { computed, nextTick, onMounted, ref, watch } from 'vue';
import { useRoute } from 'vue-router';
import { useTaskThreadStore } from './threadStore';
import { statusOf, originOf } from './meta';
import { renderMd, fmtTime, fmtArgs, fmtResult, toolLabel, toolSubtitle } from '@/system/lib/thread/format';
import { isToolRow } from '@/system/lib/thread/messages';
import TopBar from '@/system/components/TopBar.vue';
import Icon from '@/system/components/Icon.vue';

const route = useRoute();
const thread = useTaskThreadStore();
const streamRef = ref(null);

// 工具结果里带 error 视为失败步骤(节点变红)
function isFailed(item) {
    try { const r = typeof item.result === 'string' ? JSON.parse(item.result) : item.result; return Boolean(r && r.error); }
    catch { return false; }
}

const origin = computed(() => (thread.task ? originOf(thread.task.origin) : null));

// 结果导向的时间线:AI/你 的发言紧凑呈现(demo .say),连续的工具调用合成一张 .toolcard。
const blocks = computed(() => {
    const out = [];
    for (const message of thread.messages) {
        if (isToolRow(message)) {
            const last = out[out.length - 1];
            if (last?.kind === 'tools') last.items.push(message);
            else out.push({ kind: 'tools', key: `tools:${message._key}`, items: [message] });
            continue;
        }
        out.push({ kind: 'message', key: message._key, message });
    }
    return out;
});

// 详情页从顶部读起(概览/结果优先),不自动滚到底;接近顶部时加载更早,并保持视口不跳
async function onScroll() {
    const el = streamRef.value;
    if (!el || thread.loadingOlder || !thread.hasMore) return;
    if (el.scrollTop > 48) return;
    const prevH = el.scrollHeight; const prevTop = el.scrollTop;
    const count = await thread.loadOlder();
    if (!count) return;
    await nextTick();
    requestAnimationFrame(() => { el.scrollTop = prevTop + (el.scrollHeight - prevH); });
}

function load(id) {
    thread.open(id).then(() => nextTick(() => { if (streamRef.value) streamRef.value.scrollTop = 0; }));
}
onMounted(() => load(route.params.id));
watch(() => route.params.id, (id) => { if (id) load(id); });
</script>

<template>
    <div class="app">
        <TopBar back="/tasks" title="任务详情" />

        <main ref="streamRef" class="page" @scroll.passive="onScroll">
            <div class="page-inner">
                <div v-if="thread.loadingOlder" class="td-older">加载更早…</div>

                <!-- 概览:第一眼看结果 -->
                <div v-if="thread.task" class="card overview">
                    <div class="meta">
                        <span class="origin-badge">
                            <Icon :name="origin.icon" />
                            <template v-if="origin.link && thread.task.origin_id">
                                {{ origin.label }} ·&nbsp;<RouterLink :to="origin.link + thread.task.origin_id">{{ thread.task.origin_title || '查看' }}</RouterLink>
                            </template>
                            <template v-else>{{ origin.label }}</template>
                        </span>
                        <span class="sep"></span>
                        <span>{{ fmtTime(thread.task.created_at) }}<template v-if="thread.task.finished_at"> → {{ fmtTime(thread.task.finished_at) }}</template></span>
                    </div>

                    <div class="prompt-text">{{ thread.task.prompt }}</div>

                    <div v-if="thread.task.summary" class="result-block" :class="{ bad: thread.task.status === 'failed' }">
                        <div class="r-label"><Icon v-if="thread.task.status !== 'failed'" name="check" style="width:14px;height:14px" />结果</div>
                        <div class="r-text md" v-html="renderMd(thread.task.summary)"></div>
                    </div>
                </div>

                <!-- 完整过程:单卡竖轨时间线 -->
                <div v-if="blocks.length" class="timeline-label">执行过程</div>

                <div v-if="blocks.length" class="card trace">
                    <template v-for="block in blocks" :key="block.key">
                        <template v-if="block.kind === 'tools'">
                            <div
                                v-for="item in block.items" :key="item._key"
                                class="step tool"
                                :class="{ open: item.expanded, run: item.status === 'running', fail: isFailed(item) }"
                            >
                                <span class="node"></span>
                                <div class="t-head" @click="item.expanded = !item.expanded">
                                    <span class="t-sum">{{ toolSubtitle(item) || toolLabel(item.name) }}</span>
                                    <span v-if="item.status === 'running'" class="t-meta">执行中…</span>
                                    <span v-else-if="isFailed(item)" class="t-meta fail">失败</span>
                                    <svg class="caret" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 6 15 12 9 18"/></svg>
                                </div>
                                <div class="t-body">
                                    <div class="k">输入</div>
                                    <pre>{{ fmtArgs(item.args) }}</pre>
                                    <template v-if="item.result">
                                        <div class="k">返回</div>
                                        <pre>{{ fmtResult(item.result) }}</pre>
                                    </template>
                                </div>
                            </div>
                        </template>

                        <div v-else-if="block.message.role === 'user'" class="step user">
                            <span class="node"></span>
                            <div class="say-text td-plain">{{ block.message.content }}</div>
                        </div>

                        <div v-else-if="block.message.role === 'assistant'" class="step">
                            <span class="node"></span>
                            <div class="say-text md" v-html="renderMd(block.message.content)"></div>
                        </div>

                        <div v-else-if="block.message.role === 'system'" class="step sys">
                            <span class="node"></span>
                            <div class="say-text sys-text">{{ block.message.content }}</div>
                        </div>
                    </template>
                </div>

                <div v-if="thread.busy && !thread.messages.some(m => m.streaming)" class="td-typing">
                    <i></i><i style="animation-delay:.2s"></i><i style="animation-delay:.4s"></i>
                </div>
            </div>
        </main>
    </div>
</template>

<style>
/* 任务详情页—— 页面级样式,组件类走全局 style.css */
.overview { padding: 18px 20px; }
.overview .origin-badge { display: inline-flex; align-items: center; gap: 4px; }
.overview .origin-badge a { color: var(--candy-deep); text-decoration: none; font-weight: 600; }
.overview .origin-badge a:hover { text-decoration: underline; }
.result-block { margin-top: 14px; border-radius: 15px; background: var(--ok-soft); padding: 14px 16px; }
.result-block .r-label { display: flex; align-items: center; gap: 6px; font-size: 11.5px; font-weight: 800; color: var(--ok-ink); letter-spacing: .04em; margin-bottom: 7px; }
.result-block .r-label svg { width: 14px; height: 14px; }
.result-block .r-text { font-size: 13.5px; line-height: 1.85; white-space: pre-wrap; word-break: break-word; }
.result-block.bad { background: var(--bad-soft); }
.result-block.bad .r-label { color: var(--bad); }
.prompt-text { margin-top: 12px; font-size: 13px; line-height: 1.75; color: var(--ink2);
    background: var(--well); border-radius: 13px; padding: 11px 14px; white-space: pre-wrap; word-break: break-word; }
/* 过程时间线 */
.timeline-label { margin: 22px 2px 10px; font-size: 12px; font-weight: 800; color: var(--ink-3); letter-spacing: .05em; display: flex; align-items: center; gap: 8px; }
.timeline-label::after { content: ""; flex: 1; height: 1px; background: var(--line); }
.trace { padding: 8px 18px; }
.step { position: relative; padding: 12px 0 12px 24px; }
.step::before { content: ""; position: absolute; left: 5px; top: 0; bottom: 0; width: 2px; background: var(--line-soft); }
.step:first-child::before { top: 18px; }
.step:last-child::before { bottom: calc(100% - 18px); }
.step:only-child::before { display: none; }
.step .node { position: absolute; left: 0; top: 14px; width: 12px; height: 12px; border-radius: 99px;
    background: var(--candy); box-shadow: 0 0 0 3px var(--panel); }
.step.user .node { background: var(--ink-4); }
.step.sys .node { background: var(--ink-4); opacity: .5; }
.step.tool .node { background: var(--ok); }
.step.tool.run .node { background: var(--run); animation: pulse 1.3s ease-in-out infinite; }
.step.tool.fail .node { background: var(--bad); }
.say-text { font-size: 13.5px; line-height: 1.8; min-width: 0; }
.say-text p { margin: 0 0 .5em; } .say-text p:last-child { margin: 0; }
.say-text.td-plain { white-space: pre-wrap; word-break: break-word; }
.say-text.sys-text { font-size: 12px; color: var(--ink-3); }
/* 工具步骤:一行摘要,点击展开输入/输出 */
.step .t-head { display: flex; align-items: center; gap: 8px; cursor: pointer; user-select: none; }
.step .t-sum { font-size: 13px; font-weight: 600; min-width: 0; }
.step .t-meta { font-size: 11px; color: var(--ink-4); font-weight: 500; flex-shrink: 0; }
.step .t-meta.fail { color: var(--bad); font-weight: 700; }
.step .caret { margin-left: auto; color: var(--ink-4); transition: transform .2s var(--ease); flex-shrink: 0; }
.step.open .caret { transform: rotate(90deg); }
.step .t-body { display: none; padding-top: 8px; }
.step.open .t-body { display: block; }
.step .t-body .k { font-size: 11px; font-weight: 700; color: var(--ink-3); margin: 7px 0 4px; }
.step .t-body pre { margin: 0; padding: 9px 11px; background: var(--code); border-radius: 10px;
    font-family: var(--mono); font-size: 11.5px; line-height: 1.65; color: var(--ink2);
    white-space: pre-wrap; word-break: break-word; max-height: 240px; overflow: auto; }
.td-older { padding: 4px 0 10px; text-align: center; font-size: 11.5px; color: var(--ink-4); }
.td-sys { display: flex; justify-content: center; margin: 10px 0; }
.td-sys span { background: var(--well); border-radius: 99px; padding: 6px 14px; font-size: 11.5px; font-weight: 600; color: var(--ink-3); text-align: center; line-height: 1.5; }
.td-typing { display: flex; align-items: center; gap: 5px; margin: 12px 2px 12px 42px; }
.td-typing i { width: 6px; height: 6px; border-radius: 99px; background: var(--candy); opacity: .5; animation: pulse 1.2s infinite; }
</style>
