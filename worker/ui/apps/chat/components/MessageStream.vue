<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { useChatStore } from '@/apps/chat/store';
import { renderMd } from '@/system/lib/thread/format';
import { isToolRow } from '@/system/lib/thread/messages';
import Icon from '@/system/components/Icon.vue';
import ToolGroup from './ToolGroup.vue';

const chat = useChatStore();
const streamRef = ref(null);
const innerRef = ref(null);

const showTyping = computed(() => {
    if (!chat.busy) return false;
    const last = chat.messages[chat.messages.length - 1];
    return !(last && last.role === 'assistant' && last.streaming);
});

// 按 created_at 生成「今天/昨天/日期」分隔标签(消息没带时间时不显示)
function dayLabel(ts) {
    if (!ts) return '';
    const d = new Date(ts);
    if (Number.isNaN(d.getTime())) return '';
    const today = new Date();
    const startOf = (x) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
    const diff = Math.round((startOf(today) - startOf(d)) / 86400000);
    if (diff === 0) return '今天';
    if (diff === 1) return '昨天';
    return `${d.getMonth() + 1}月${d.getDate()}日`;
}

const blocks = computed(() => {
    const out = [];
    let lastDay = '';
    for (const message of chat.messages) {
        const day = dayLabel(message.created_at);
        if (day && day !== lastDay) {
            out.push({ kind: 'day', key: `day:${message._key}`, label: day });
            lastDay = day;
        }
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

// ── 滚动:正常布局 + 「粘底」标志 ──
// stick=true 时,任何内容高度变化(新消息、markdown/图片延迟撑高、流式吐字)都瞬时贴底;
// 用户手动向上滚离底部 → stick=false,不再打扰;滚回底部 → 重新粘上。ResizeObserver 兜住异步高度。
let stick = true;
let restoreFromTop = 0; // >0 表示本次高度增长来自「加载更早」,需保持视口不跳

function scrollToBottom() {
    const el = streamRef.value;
    if (el) el.scrollTop = el.scrollHeight;
}

function onScroll() {
    const el = streamRef.value;
    if (!el) return;
    const distToBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
    stick = distToBottom < 80;
    // 接近顶部:加载更早,并记住旧内容高度以便加载后保持视口
    if (el.scrollTop < 60 && chat.hasMore && !chat.loadingOlder) {
        restoreFromTop = el.scrollHeight;
        chat.loadOlder();
    }
}

let ro = null;
onMounted(() => {
    scrollToBottom();
    // 内容高度变化时:加载更早→保持视口;否则若粘底→贴底
    ro = new ResizeObserver(() => {
        const el = streamRef.value;
        if (!el) return;
        if (restoreFromTop) {
            el.scrollTop = el.scrollHeight - restoreFromTop;
            restoreFromTop = 0;
        } else if (stick) {
            el.scrollTop = el.scrollHeight;
        }
    });
    if (innerRef.value) ro.observe(innerRef.value);
});
onBeforeUnmount(() => ro?.disconnect());

// 切会话 / 自己发消息:强制回底并重新粘上
watch(() => chat.viewSeq, () => {
    stick = true;
    restoreFromTop = 0;
    nextTick(scrollToBottom);
});
</script>

<template>
    <main ref="streamRef" class="page chat-scroll" @scroll.passive="onScroll">
        <div ref="innerRef" class="chat-inner">
            <span v-if="chat.loadingOlder" class="sys-chip">正在加载更早的消息…</span>
            <span v-else-if="chat.hasMore && chat.messages.length" class="sys-chip" style="opacity:.7">↑ 上滑加载更早</span>

            <!-- 切换会话:先显示加载态,拉到历史后再填充;空会话走 .empty -->
            <span v-if="!chat.ready && !chat.messages.length" class="sys-chip">正在载入会话…</span>

            <div v-else-if="!chat.messages.length" class="empty rise-enter">
                <div class="empty-art"><Icon name="chat" /></div>
                <div class="empty-title">今天想做点什么?</div>
                <div class="empty-sub">在你的电脑、手机上跑命令、开网页,或者现做个小应用。</div>
            </div>

            <template v-for="block in blocks" :key="block.key">
                <span v-if="block.kind === 'day'" class="day-chip">{{ block.label }}</span>

                <ToolGroup v-else-if="block.kind === 'tools'" :items="block.items" />

                <div v-else-if="block.message.role === 'user'" class="msg-user rise-enter">
                    <div class="bubble">
                        <div v-if="block.message.images?.length" style="display:flex;flex-wrap:wrap;gap:6px;justify-content:flex-end" :style="block.message.content ? 'margin-bottom:6px' : ''">
                            <span v-for="(f, i) in block.message.images" :key="i" style="display:inline-flex;align-items:center;gap:5px;max-width:200px;padding:3px 9px;border-radius:10px;border:1px solid rgba(255,255,255,.35);background:rgba(255,255,255,.18)">
                                <img v-if="f.dataUrl" :src="f.dataUrl" :alt="f.name" style="width:18px;height:18px;border-radius:5px;object-fit:cover;flex-shrink:0" />
                                <Icon v-else name="clip" style="width:12px;height:12px;flex-shrink:0" />
                                <span style="font-size:11px;font-weight:600;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">{{ f.name }}</span>
                            </span>
                        </div>
                        <template v-if="block.message.content">{{ block.message.content }}</template>
                    </div>
                </div>

                <div v-else-if="block.message.role === 'assistant'" class="msg-ai rise-enter">
                    <span class="ai-mark">AI</span>
                    <div class="grow" style="min-width:0">
                        <div class="bubble">
                            <div class="md" v-html="renderMd(block.message.content)"></div>
                        </div>
                        <div v-if="block.message.streaming" class="msg-time" style="color:var(--run)">正在输出…</div>
                    </div>
                </div>

                <div v-else-if="block.message.type === 'shot'" style="align-self:center;margin:10px 0;max-width:92%">
                    <img style="max-width:100%;border-radius:14px;box-shadow:var(--shadow-m)" :src="block.message.dataUrl" alt="屏幕截图" />
                </div>

                <span v-else-if="block.message.role === 'system'" class="sys-chip">{{ block.message.content }}<router-link
                        v-if="block.message.code === 'model_unconfigured'"
                        to="/settings"
                        class="sys-cta"
                    >去设置 →</router-link></span>
            </template>

            <div v-if="showTyping" class="msg-ai rise-enter">
                <span class="ai-mark">AI</span>
                <div class="bubble" style="display:flex;align-items:center;gap:5px;padding:15px">
                    <i style="width:7px;height:7px;border-radius:99px;background:var(--candy);animation:typing-blink 1.2s infinite"></i>
                    <i style="width:7px;height:7px;border-radius:99px;background:var(--candy);animation:typing-blink 1.2s infinite;animation-delay:.2s"></i>
                    <i style="width:7px;height:7px;border-radius:99px;background:var(--candy);animation:typing-blink 1.2s infinite;animation-delay:.4s"></i>
                </div>
            </div>
        </div>
    </main>
</template>

<style scoped>
.chat-scroll { overflow-y: auto; overflow-x: hidden; }
.chat-inner {
    width: 100%;
    max-width: min(800px, 100%);
    min-width: 0;
    margin: 0 auto;
    padding: 20px 20px 8px;
    display: flex;
    flex-direction: column;
    overflow-x: hidden;
}
.day-chip {
    align-self: center;
    margin: 14px 0 10px;
    font-size: 11px;
    font-weight: 700;
    color: var(--ink-3);
    background: rgba(255,255,255,.7);
    padding: 4px 12px;
    border-radius: 99px;
    box-shadow: var(--shadow-s);
}
.sys-chip {
    align-self: center;
    margin: 10px 0;
    font-size: 11.5px;
    font-weight: 500;
    color: var(--ink-3);
    background: rgba(255,255,255,.55);
    padding: 5px 13px;
    border-radius: 99px;
}
.sys-cta {
    margin-left: 6px;
    color: var(--candy);
    font-weight: 700;
    text-decoration: none;
    white-space: nowrap;
}
.sys-cta:hover { text-decoration: underline; }
.msg-user {
    align-self: flex-end;
    max-width: 76%;
    min-width: 0;
    margin: 5px 0;
}
.msg-user .bubble {
    background: linear-gradient(160deg, #55acf8, var(--candy-deep));
    color: #fff;
    border-radius: 20px 20px 6px 20px;
    padding: 11px 15px;
    font-size: 13.5px;
    line-height: 1.75;
    font-weight: 500;
    box-shadow: var(--gloss), 0 8px 20px -6px rgba(43,134,228,.5);
    white-space: pre-wrap;
    overflow-wrap: anywhere;
}
.msg-ai {
    align-self: flex-start;
    max-width: 82%;
    min-width: 0;
    margin: 5px 0;
    display: flex;
    gap: 10px;
}
.msg-ai .ai-mark {
    flex-shrink: 0;
    width: 28px;
    height: 28px;
    border-radius: 10px;
    margin-top: 2px;
    display: grid;
    place-items: center;
    background: #fff;
    color: var(--candy-deep);
    font-size: 12px;
    font-weight: 800;
    box-shadow: var(--shadow-s);
}
.msg-ai .bubble {
    background: var(--panel);
    border: 1px solid rgba(255,255,255,.8);
    border-radius: 6px 20px 20px 20px;
    padding: 11px 16px;
    font-size: 13.5px;
    line-height: 1.8;
    box-shadow: var(--shadow-s);
    min-width: 0;
    overflow-wrap: anywhere;
}
.msg-time {
    font-size: 10.5px;
    color: var(--ink-4);
    font-weight: 500;
    margin: 2px 6px 0;
}

@media (max-width: 640px) {
    .chat-inner { padding: 14px 12px 6px; }
    .msg-user { max-width: 88%; }
    .msg-ai { max-width: 96%; gap: 8px; }
    .msg-ai .ai-mark { width: 24px; height: 24px; border-radius: 8px; font-size: 10.5px; }
}
</style>
