<script setup>
// 会话侧栏:位于 topbar 之下,展开时把对话区往右推开(不是浮层)。
// 开关状态在 store.panelOpen,由 ChatHeader 的汉堡按钮切换。
import { ref } from 'vue';
import { useChatStore } from '@/apps/chat/store';
import Icon from '@/system/components/Icon.vue';

const chat = useChatStore();

function pick(id) {
    chat.switchChat(id);
    // 窄屏(悬浮面板)选完自动收起;桌面保持展开
    if (window.innerWidth <= 640) chat.panelOpen = false;
}

function onRemove(c) {
    if (!window.confirm(`删除会话「${c.title || '新会话'}」?消息将一并删除。`)) return;
    chat.removeChat(c.id);
}

// ── 重命名弹窗 ──
const renaming = ref(null);
const renameText = ref('');
function startRename(c) {
    renaming.value = c;
    renameText.value = c.title || '';
}
async function confirmRename() {
    const c = renaming.value;
    renaming.value = null;
    if (!c) return;
    const t = renameText.value.trim();
    if (t && t !== c.title) await chat.renameChat(c.id, t);
}

// 今天 HH:MM,昨天「昨天」,更早「M月D日」
function fmtTime(ts) {
    if (!ts) return '';
    const d = new Date(ts);
    if (Number.isNaN(d.getTime())) return '';
    const now = new Date();
    const startOf = (x) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
    const diff = Math.round((startOf(now) - startOf(d)) / 86400000);
    if (diff === 0) return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
    if (diff === 1) return '昨天';
    return `${d.getMonth() + 1}月${d.getDate()}日`;
}
</script>

<template>
    <!-- 移动端悬浮模式的遮罩(桌面隐藏) -->
    <div v-if="chat.panelOpen" class="side-mask" @click="chat.panelOpen = false"></div>
    <aside class="chats-side" :class="{ open: chat.panelOpen }">
        <div class="side-inner">
            <button class="chat-new" @click="chat.createChat()">
                <Icon name="plus" style="width:15px;height:15px" />新会话
            </button>

            <div class="chat-list">
                <div
                    v-for="c in chat.chats"
                    :key="c.id"
                    class="chat-row"
                    :class="{ on: c.id === chat.currentId }"
                    @click="pick(c.id)"
                >
                    <Icon v-if="c.pinned" name="pin" class="row-pin" />
                    <span class="row-title ellipsis">{{ c.title || '新会话' }}</span>
                    <span class="row-time">{{ fmtTime(c.updated_at) }}</span>
                    <span class="row-ops" @click.stop>
                        <button class="op" :class="{ pinned: c.pinned }" :title="c.pinned ? '取消置顶' : '置顶'" @click="chat.togglePin(c.id)">
                            <Icon name="pin" />
                        </button>
                        <button class="op" title="重命名" @click="startRename(c)">
                            <Icon name="pencil" />
                        </button>
                        <button class="op danger" title="删除" @click="onRemove(c)">
                            <Icon name="trash" />
                        </button>
                    </span>
                </div>
                <button v-if="chat.chatNextCursor" class="chat-more" :disabled="chat.loadingChats" @click="chat.loadMoreChats">
                    {{ chat.loadingChats ? '加载中…' : '加载更多会话' }}
                </button>
                <div v-if="!chat.chats.length" class="chat-empty">还没有会话</div>
            </div>
        </div>
    </aside>

    <Teleport to="body">
        <div v-if="renaming" class="modal-mask" @click.self="renaming = null">
            <div class="modal">
                <div class="modal-title">重命名会话</div>
                <input
                    v-model="renameText"
                    class="input"
                    style="width:100%"
                    placeholder="会话标题"
                    @keydown.enter="confirmRename"
                />
                <div class="modal-foot">
                    <button class="btn btn-plain" @click="renaming = null">取消</button>
                    <button class="btn btn-primary" @click="confirmRename">保存</button>
                </div>
            </div>
        </div>
    </Teleport>
</template>

<style scoped>
/* 推开式侧栏:宽度 0↔264 过渡,内容固定宽防挤压变形 */
.chats-side {
    flex-shrink: 0;
    width: 0;
    overflow: hidden;
    background: var(--glass-soft);
    border-right: 1px solid transparent;
    transition: width .24s var(--ease), border-color .24s;
}
.chats-side.open {
    width: 264px;
    border-right-color: var(--line-soft);
}
.side-inner {
    width: 264px; height: 100%;
    display: flex; flex-direction: column;
    padding: 12px 10px calc(10px + env(safe-area-inset-bottom));
}

.chat-new {
    display: flex; align-items: center; justify-content: center; gap: 6px;
    flex-shrink: 0;
    height: 38px; margin: 0 2px 10px;
    border: 1.5px dashed var(--candy);
    border-radius: 13px;
    color: var(--candy-deep); font-size: 13px; font-weight: 700;
    transition: background .15s;
}
.chat-new:hover { background: var(--candy-soft); }

.chat-list {
    flex: 1; min-height: 0; overflow-y: auto;
    display: flex; flex-direction: column; gap: 2px;
    padding: 0 2px;
}
.chat-row {
    position: relative;
    display: flex; align-items: center; gap: 7px;
    height: 42px; flex-shrink: 0; padding: 0 10px;
    border-radius: 12px;
    cursor: pointer;
    transition: background .15s;
}
.chat-row:hover { background: var(--surface-hover); }
.chat-row.on { background: var(--candy-soft); }
.chat-row.on .row-title { color: var(--candy-deep); }
.row-pin { width: 12px; height: 12px; flex-shrink: 0; color: var(--candy); }
.row-title { flex: 1; min-width: 0; font-size: 13px; font-weight: 600; }
.row-time { font-size: 11px; color: var(--ink-3); flex-shrink: 0; }
.row-ops {
    display: none; align-items: center; gap: 2px;
    position: absolute; right: 6px; top: 0; bottom: 0;
    padding-left: 18px;
    background: linear-gradient(90deg, transparent, var(--panel) 30%);
}
.chat-row.on .row-ops { background: linear-gradient(90deg, transparent, var(--candy-soft) 30%); }
.chat-row:hover .row-ops { display: inline-flex; }
@media (hover: none) {
    .chat-row .row-ops { display: inline-flex; }
    .row-time { display: none; }
}
.row-ops .op {
    width: 28px; height: 28px; border-radius: 9px;
    display: grid; place-items: center;
    color: var(--ink-3);
    transition: background .15s, color .15s;
}
.row-ops .op :deep(.o-icon) { width: 15px; height: 15px; }
.row-ops .op:hover { background: var(--glass-strong); color: var(--candy-deep); }
.row-ops .op.pinned { color: var(--candy-deep); }
.row-ops .op.pinned :deep(svg) { fill: currentColor; }
.row-ops .op.danger:hover { color: var(--bad); }
.chat-empty { padding: 18px 0; text-align: center; font-size: 12px; color: var(--ink-3); }
.chat-more { flex: 0 0 auto; margin: 5px 8px; padding: 7px; border-radius: 9px; color: var(--candy-deep); font-size: 11px; font-weight: 700; }
.chat-more:hover { background: var(--candy-soft); }

.side-mask { display: none; }

/* 窄屏:推开没有空间 → 悬浮面板(覆盖对话区,仍在 topbar 之下)+ 遮罩 */
@media (max-width: 640px) {
    .side-mask {
        display: block;
        position: absolute; inset: 0; z-index: 39;
        background: var(--overlay);
        animation: fade .18s ease-out;
    }
    .chats-side {
        position: absolute; left: 0; top: 0; bottom: 0; z-index: 40;
        background: var(--panel);
    }
    .chats-side.open {
        width: min(300px, 82vw);
        box-shadow: var(--shadow-l);
    }
    .side-inner { width: min(300px, 82vw); }
}
</style>
