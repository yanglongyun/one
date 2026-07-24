<script setup>
import { computed, onMounted, reactive, ref } from 'vue';
import { useNotesStore } from './store';
import TopBar from '@/system/components/TopBar.vue';
import Icon from '@/system/components/Icon.vue';
import { confirmDialog } from '@/system/lib/confirm';

const notes = useNotesStore();
const showModal = ref(false);
const editingId = ref(null);
const form = reactive({ content: '', color: 'yellow', pinned: false });

const COLORS = ['yellow', 'blue', 'green', 'pink', 'purple', 'slate', 'plain'];
const colorOf = (c) => (COLORS.includes(c) ? c : 'plain');

const titleOf = (n) => (n.content || '').split('\n')[0].trim();
const bodyLines = (n) => (n.content || '').split('\n').slice(1).map((s) => s.trim()).filter(Boolean);

const isEditing = computed(() => Boolean(editingId.value));
const canSave = computed(() => form.content.trim().length > 0);

// 新建草稿缓存:边输入边存,意外关掉弹窗不丢;保存成功才清。只缓存「新建」,编辑已有笔记不进草稿。
const DRAFT_KEY = 'one.notes.draft';
function saveDraft() {
    if (editingId.value) return;
    try {
        if (form.content.trim() || form.pinned) localStorage.setItem(DRAFT_KEY, JSON.stringify({ content: form.content, color: form.color, pinned: form.pinned }));
        else localStorage.removeItem(DRAFT_KEY);
    } catch { /* 存不了就算了 */ }
}
function clearDraft() { try { localStorage.removeItem(DRAFT_KEY); } catch { /* 同上 */ } }

// 每次新建随机一个颜色(排除 plain,保证有色);有草稿则沿用草稿
const PICKABLE = COLORS.filter((c) => c !== 'plain');
const randomColor = () => PICKABLE[Math.floor(Math.random() * PICKABLE.length)];

function openCreate() {
    editingId.value = null;
    let d = null;
    try { d = JSON.parse(localStorage.getItem(DRAFT_KEY) || 'null'); } catch { /* 草稿坏了当没有 */ }
    form.content = d?.content || '';
    form.color = colorOf(d?.color || randomColor());
    form.pinned = Boolean(d?.pinned);
    showModal.value = true;
}
function openEdit(item) {
    editingId.value = item.id;
    form.content = item.content || '';
    form.color = colorOf(item.color);
    form.pinned = Boolean(item.pinned);
    showModal.value = true;
}
async function save() {
    if (!canSave.value) return;
    await notes.save({ id: editingId.value, content: form.content.trim(), color: form.color, pinned: form.pinned });
    if (!editingId.value) clearDraft();
    showModal.value = false;
}
async function del(item) {
    if (!(await confirmDialog({ title: '删除笔记', message: '删除这条笔记?', confirmText: '删除', danger: true }))) return;
    await notes.remove(item.id);
}
async function setColor(item, c) {
    if (colorOf(item.color) === c) return;
    await notes.save({ id: item.id, color: c });
}

function fmtTime(ts) {
    const t = Number(ts) || 0;
    if (!t) return '';
    const diff = Date.now() - t;
    if (diff < 60000) return '刚刚';
    if (diff < 3600000) return `${Math.floor(diff / 60000)} 分钟前`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)} 小时前`;
    const d = new Date(t);
    return `${d.getMonth() + 1}月${d.getDate()}日`;
}

onMounted(() => { notes.bind(); notes.load(); });
</script>

<template>
    <div class="app">
        <TopBar title="笔记">
            <template #actions>
                <button class="btn btn-primary" @click="openCreate">
                    <Icon name="plus" style="width:15px;height:15px" />新建
                </button>
            </template>
        </TopBar>

        <main class="page">
            <div class="page-inner">
                <div v-if="!notes.items.length && !notes.loading" class="note-empty">
                    <div class="e-icon">📝</div>
                    <div class="e-title">还没有笔记</div>
                    <div class="e-sub">记下想法、清单、备忘 —— 你和 AI 都能读写这块便签板</div>
                </div>

                <div class="note-board">
                    <div
                        v-for="item in notes.items" :key="item.id"
                        class="note-card" :class="`note-${colorOf(item.color)}`"
                        @click="openEdit(item)"
                    >
                        <span v-if="item.pinned" class="note-pin">📌</span>
                        <div class="note-title">{{ titleOf(item) }}</div>
                        <div v-if="bodyLines(item).length" class="note-body">
                            <p v-for="(line, i) in bodyLines(item)" :key="i">{{ line }}</p>
                        </div>
                        <div class="note-foot">
                            <span class="note-time">{{ fmtTime(item.updated_at || item.created_at) }}</span>
                            <span class="note-acts" @click.stop>
                                <button
                                    v-for="c in COLORS" :key="c"
                                    class="cdot" :class="[`cdot-${c}`, { on: colorOf(item.color) === c }]"
                                    @click="setColor(item, c)"
                                ></button>
                                <button class="note-trash" title="删除" @click="del(item)"><Icon name="trash" style="width:13px;height:13px" /></button>
                            </span>
                        </div>
                    </div>
                </div>
                <button v-if="notes.nextCursor" class="btn btn-plain load-more" :disabled="notes.loading" @click="notes.loadMore">{{ notes.loading ? '加载中…' : '加载更多' }}</button>
            </div>
        </main>

        <!-- 新建 / 编辑笔记 -->
        <Teleport to="body">
            <div v-if="showModal" class="modal-mask" @click.self="showModal = false">
                <div class="modal">
                    <div class="modal-title">{{ isEditing ? '编辑笔记' : '新建笔记' }}</div>
                    <div class="field">
                        <textarea
                            :value="form.content" class="input" rows="6" placeholder="第一行是标题,想到什么写什么…"
                            @input="form.content = $event.target.value; saveDraft()"
                        ></textarea>
                    </div>
                    <div class="note-form-row">
                        <span class="note-form-colors">
                            <button
                                v-for="c in COLORS" :key="c"
                                class="cdot lg" :class="[`cdot-${c}`, { on: form.color === c }]"
                                @click="form.color = c; saveDraft()"
                            ></button>
                        </span>
                        <button class="note-pin-toggle" :class="{ on: form.pinned }" @click="form.pinned = !form.pinned; saveDraft()">📌 置顶</button>
                    </div>
                    <div class="modal-foot">
                        <button class="btn btn-plain" @click="showModal = false">取消</button>
                        <button class="btn btn-primary" :disabled="!canSave" @click="save">保存</button>
                    </div>
                </div>
            </div>
        </Teleport>
    </div>
</template>

<style>
/* 笔记页 —— 便签纸网格;paper-* 色板来自全局,purple/slate 两色此处补齐 */
.note-board {
    --paper-purple: #f1e9fe; --paper-purple-deep: #a855f7;
    --paper-slate:  #eef1f5; --paper-slate-deep:  #64748b;
    display: grid; grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); gap: 12px;
}
:root[data-theme="night"] .note-board {
    --paper-purple: #3a2c56; --paper-purple-deep: #c084fc;
    --paper-slate:  #2f3552; --paper-slate-deep:  #9aa3d4;
}

.note-card {
    position: relative; padding: 14px 15px 10px;
    border-radius: var(--r-m); box-shadow: var(--shadow-s);
    cursor: pointer; transition: box-shadow .15s, transform .15s;
}
.note-card:hover { box-shadow: var(--shadow-m); transform: translateY(-1px); }
.note-yellow { background: var(--paper-yellow); }
.note-blue   { background: var(--paper-blue); }
.note-green  { background: var(--paper-green); }
.note-pink   { background: var(--paper-pink); }
.note-purple { background: var(--paper-purple); }
.note-slate  { background: var(--paper-slate); }
.note-plain  { background: var(--paper-plain); }

.note-pin { position: absolute; top: -7px; right: 10px; font-size: 15px; }
.note-title { font-size: 14px; font-weight: 700; line-height: 1.5; word-break: break-word; }
.note-body { margin-top: 6px; font-size: 12.5px; line-height: 1.7; color: var(--ink2);
    display: -webkit-box; -webkit-line-clamp: 6; -webkit-box-orient: vertical; overflow: hidden; }
.note-body p { margin: 0; word-break: break-word; }
.note-foot { margin-top: 10px; display: flex; align-items: center; justify-content: space-between; gap: 8px; }
.note-time { font-size: 11px; font-weight: 600; color: var(--ink-3); }
.note-acts { display: flex; align-items: center; gap: 5px; opacity: 0; transition: opacity .15s; }
.note-card:hover .note-acts { opacity: 1; }
@media (hover: none), (max-width: 640px) { .note-acts { opacity: .6; } }

/* 色点(卡片上小号 / 弹窗里大号) */
.cdot { width: 13px; height: 13px; border-radius: 50%; border: 1.5px solid transparent; transition: transform .12s; }
.cdot:hover { transform: scale(1.25); }
.cdot.lg { width: 20px; height: 20px; }
.cdot.on { border-color: var(--ink2); }
.cdot-yellow { background: var(--paper-yellow-deep); }
.cdot-blue   { background: var(--paper-blue-deep); }
.cdot-green  { background: var(--paper-green-deep); }
.cdot-pink   { background: var(--paper-pink-deep); }
.cdot-purple { background: var(--paper-purple-deep, #a855f7); }
.cdot-slate  { background: var(--paper-slate-deep, #64748b); }
.cdot-plain  { background: var(--paper-plain-deep); }

.note-trash { margin-left: 3px; width: 24px; height: 24px; border-radius: 8px; display: grid; place-items: center;
    color: var(--ink-3); transition: all .15s; }
.note-trash:hover { background: var(--bad-soft); color: var(--bad); }

/* 弹窗附加行:色板 + 置顶 */
.note-form-row { margin-top: 12px; display: flex; align-items: center; justify-content: space-between; gap: 10px;
    --paper-purple-deep: #a855f7; --paper-slate-deep: #64748b; }
:root[data-theme="night"] .note-form-row { --paper-purple-deep: #c084fc; --paper-slate-deep: #9aa3d4; }
.note-form-colors { display: flex; gap: 8px; }
.note-pin-toggle { font-size: 12.5px; font-weight: 700; color: var(--ink-3);
    padding: 5px 10px; border-radius: 10px; background: var(--well); transition: all .15s; }
.note-pin-toggle.on { background: var(--candy-soft); color: var(--candy-deep); }

.note-empty { padding: 56px 20px; text-align: center; }
.note-empty .e-icon { font-size: 32px; margin-bottom: 8px; }
.note-empty .e-title { font-size: 15px; font-weight: 800; margin-bottom: 4px; }
.note-empty .e-sub { font-size: 13px; line-height: 1.7; color: var(--ink-3); }

.load-more { display: flex; margin: 14px auto 0; }
</style>
