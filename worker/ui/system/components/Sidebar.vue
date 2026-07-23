<script setup>
// 全局左侧栏(ChatGPT 式),三组:
//   ① 功能入口 —— 新对话 / 笔记 / 任务 / 日程 / 目标 / 记忆
//   ② 历史对话列表(chat store)
//   ③ 底部常驻 —— 设置
// 桌面常驻;窄屏收成抽屉(shell.sidebarOpen 控制,遮罩点击收回)。
import { onMounted, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useChatStore } from '@/apps/chat/store';
import { useShellStore } from '@/system/stores/shell';
import Icon from './Icon.vue';
import LinksPanel from './LinksPanel.vue';
import { confirmDialog } from '@/system/lib/confirm';

const route = useRoute();
const router = useRouter();
const chat = useChatStore();
const shell = useShellStore();

const NAV = [
    { path: '/notes', icon: 'notes', label: '笔记' },
    { path: '/tasks', icon: 'tasks', label: '任务' },
    { path: '/schedules', icon: 'schedule', label: '日程' },
    { path: '/goals', icon: 'goals', label: '目标' },
    { path: '/memories', icon: 'memory', label: '记忆' },
];

function go(path) {
    shell.closeSidebar();
    if (route.path !== path) router.push(path);
}

function newChat() {
    shell.closeSidebar();
    if (route.path !== '/chat') router.push('/chat');
    chat.createChat(); // 只进空白草稿,发首条消息才真正建会话
}

function pick(id) {
    shell.closeSidebar();
    chat.switchChat(id);
    if (route.path !== '/chat') router.push('/chat');
}

async function onRemove(c) {
    const ok = await confirmDialog({ title: '删除会话', message: `删除会话「${c.title || '新会话'}」?消息将一并删除。`, confirmText: '删除', danger: true });
    if (ok) chat.removeChat(c.id);
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

// 不依赖聊天页先打开:侧栏自己兜底拉一次会话列表(失败静默,登录后 chat.init 会再拉)
onMounted(() => { chat.loadChats().catch(() => {}); });
</script>

<template>
    <div v-if="shell.sidebarOpen" class="side-mask" @click="shell.closeSidebar()"></div>
    <aside class="sidebar" :class="{ open: shell.sidebarOpen }">
        <div class="side-brand">
            <span class="side-logo">1</span>
            <span class="side-name">one</span>
            <span class="grow"></span>
            <LinksPanel align="left" />
        </div>

        <!-- ① 功能入口 -->
        <nav class="side-nav">
            <button class="side-item" @click="newChat">
                <Icon name="pencil" /><span>新对话</span>
            </button>
            <button
                v-for="n in NAV" :key="n.path"
                class="side-item" :class="{ on: route.path.startsWith(n.path) }"
                @click="go(n.path)"
            >
                <Icon :name="n.icon" /><span>{{ n.label }}</span>
            </button>
        </nav>

        <!-- ② 历史对话 -->
        <div class="side-history">
            <div class="side-label">对话</div>
            <div
                v-for="c in chat.chats" :key="c.id"
                class="conv" :class="{ on: c.id === chat.currentId && route.path === '/chat' }"
                @click="pick(c.id)"
            >
                <Icon v-if="c.pinned" name="pin" class="conv-pin" />
                <span class="conv-title ellipsis">{{ c.title || '新会话' }}</span>
                <span class="conv-time">{{ fmtTime(c.updated_at) }}</span>
                <span class="conv-ops" @click.stop>
                    <button class="op" :class="{ pinned: c.pinned }" :title="c.pinned ? '取消置顶' : '置顶'" @click="chat.togglePin(c.id)"><Icon name="pin" /></button>
                    <button class="op" title="重命名" @click="startRename(c)"><Icon name="pencil" /></button>
                    <button class="op danger" title="删除" @click="onRemove(c)"><Icon name="trash" /></button>
                </span>
            </div>
            <button v-if="chat.chatNextCursor" class="conv-more" :disabled="chat.loadingChats" @click="chat.loadMoreChats">
                {{ chat.loadingChats ? '加载中…' : '加载更多' }}
            </button>
            <div v-if="!chat.chats.length" class="conv-empty">还没有对话</div>
        </div>

        <!-- ③ 常驻设置 -->
        <div class="side-bottom">
            <button class="side-item" :class="{ on: route.path.startsWith('/settings') }" @click="go('/settings')">
                <Icon name="settings" /><span>设置</span>
            </button>
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
.sidebar {
    flex-shrink: 0;
    width: 260px;
    height: 100%;
    background: var(--side-bg);
    border-right: 1px solid var(--line-soft);
    display: flex; flex-direction: column;
    padding: 8px;
}

.side-brand {
    display: flex; align-items: center; gap: 8px;
    padding: 10px 10px 12px;
    flex-shrink: 0;
}
.side-logo {
    width: 24px; height: 24px; border-radius: 7px;
    display: grid; place-items: center;
    background: var(--candy); color: var(--on-accent);
    font-size: 13px; font-weight: 800;
}
.side-name { font-size: 15px; font-weight: 700; }

.side-nav { flex-shrink: 0; display: flex; flex-direction: column; gap: 1px; }
.side-item {
    display: flex; align-items: center; gap: 10px;
    height: 36px; padding: 0 10px;
    border-radius: 8px;
    font-size: 13.5px; font-weight: 500; color: var(--ink);
    text-align: left;
    transition: background .15s;
}
.side-item:hover { background: var(--surface-hover); }
.side-item.on { background: var(--candy-soft); color: var(--candy-deep); font-weight: 600; }
.side-item :deep(.o-icon) { width: 17px; height: 17px; color: var(--ink-3); flex-shrink: 0; }
.side-item.on :deep(.o-icon) { color: var(--candy-deep); }

.side-history {
    flex: 1; min-height: 0;
    overflow-y: auto;
    margin-top: 14px;
    /* 吃掉 aside 的右内边距,让滚动条贴住面板右缘;内容用 padding 补回原位 */
    margin-right: -8px;
    padding-right: 8px;
    display: flex; flex-direction: column; gap: 1px;
}
/* 侧栏滚动条细一档 */
.side-history::-webkit-scrollbar { width: 8px; }
.side-label {
    font-size: 11px; font-weight: 700; letter-spacing: .04em;
    color: var(--ink-3);
    padding: 4px 10px 6px;
    flex-shrink: 0;
}
.conv {
    position: relative;
    display: flex; align-items: center; gap: 7px;
    height: 36px; flex-shrink: 0; padding: 0 10px;
    border-radius: 8px;
    font-size: 13.5px;
    cursor: pointer;
    transition: background .15s;
}
.conv:hover { background: var(--surface-hover); }
.conv.on { background: var(--candy-soft); }
.conv.on .conv-title { color: var(--candy-deep); font-weight: 600; }
.conv-pin { width: 12px; height: 12px; flex-shrink: 0; color: var(--candy); }
.conv-title { flex: 1; min-width: 0; }
.conv-time { font-size: 11px; color: var(--ink-4); flex-shrink: 0; }
.conv-ops {
    display: none; align-items: center; gap: 2px;
    position: absolute; right: 4px; top: 0; bottom: 0;
    padding-left: 16px;
    background: linear-gradient(90deg, transparent, var(--side-bg) 30%);
}
.conv.on .conv-ops { background: linear-gradient(90deg, transparent, var(--candy-soft) 30%); }
.conv:hover .conv-ops { display: inline-flex; }
@media (hover: none) {
    .conv .conv-ops { display: inline-flex; }
    .conv-time { display: none; }
}
.conv-ops .op {
    width: 26px; height: 26px; border-radius: 7px;
    display: grid; place-items: center;
    color: var(--ink-3);
    transition: background .15s, color .15s;
}
.conv-ops .op :deep(.o-icon) { width: 14px; height: 14px; }
.conv-ops .op:hover { background: var(--surface-hover); color: var(--ink); }
.conv-ops .op.pinned { color: var(--candy-deep); }
.conv-ops .op.pinned :deep(svg) { fill: currentColor; }
.conv-ops .op.danger:hover { color: var(--bad); }
.conv-empty { padding: 16px 0; text-align: center; font-size: 12px; color: var(--ink-4); }
.conv-more { flex-shrink: 0; margin: 4px 8px; padding: 6px; border-radius: 8px; color: var(--ink-3); font-size: 11.5px; font-weight: 600; }
.conv-more:hover { background: var(--surface-hover); color: var(--ink); }

.side-bottom {
    flex-shrink: 0;
    border-top: 1px solid var(--line-soft);
    padding-top: 8px; margin-top: 8px;
    padding-bottom: env(safe-area-inset-bottom);
}

.side-mask { display: none; }

/* 窄屏:侧栏收成抽屉,盖在内容上 + 遮罩 */
@media (max-width: 640px) {
    .side-mask {
        display: block;
        position: fixed; inset: 0; z-index: 79;
        background: var(--overlay);
        animation: fade .18s ease-out;
    }
    .sidebar {
        position: fixed; left: 0; top: 0; bottom: 0; z-index: 80;
        width: min(300px, 82vw);
        transform: translateX(-102%);
        transition: transform .24s var(--ease);
        box-shadow: none;
    }
    .sidebar.open { transform: translateX(0); box-shadow: var(--shadow-l); }
}
</style>
