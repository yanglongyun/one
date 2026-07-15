<script setup>
import { computed, onMounted, reactive, ref } from 'vue';
import { useMemoriesStore } from './store';
import TopBar from '@/system/components/TopBar.vue';
import Icon from '@/system/components/Icon.vue';

const memories = useMemoriesStore();
const search = ref('');
const showModal = ref(false);
const editingId = ref(null);
const form = reactive({ title: '', description: '', body: '', visibility: 'stored' });

const VIS = {
    must: { label: '必读', pill: 'pill-must' },
    star: { label: '星标', pill: 'pill-star' },
    stored: { label: '已存', pill: 'pill-plain' },
};
const visOf = (v) => VIS[v] || VIS.stored;

const TABS = [
    { value: '', label: '全部' },
    { value: 'must', label: '必读' },
    { value: 'star', label: '星标' },
    { value: 'stored', label: '已存' },
];

// 胶囊(走 store 的服务端过滤)+ 搜索(本地)联合过滤
const shown = computed(() => {
    const q = search.value.trim().toLowerCase();
    if (!q) return memories.items;
    return memories.items.filter((m) =>
        `${m.title || ''}\n${m.description || ''}\n${m.body || ''}`.toLowerCase().includes(q));
});

const isEditing = computed(() => Boolean(editingId.value));
const canSave = computed(() => form.title.trim().length > 0);

function openCreate() {
    editingId.value = null;
    form.title = ''; form.description = ''; form.body = ''; form.visibility = 'stored';
    showModal.value = true;
}
function openEdit(item) {
    editingId.value = item.id;
    form.title = item.title || '';
    form.description = item.description || '';
    form.body = item.body || '';
    form.visibility = item.visibility || 'stored';
    showModal.value = true;
}
async function save() {
    if (!canSave.value) return;
    await memories.save({
        id: editingId.value,
        title: form.title.trim(),
        description: form.description.trim(),
        body: form.body.trim(),
        visibility: form.visibility,
    });
    showModal.value = false;
}
async function del(item) {
    if (!confirm(`删除记忆「${item.title}」?`)) return;
    await memories.remove(item.id);
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

onMounted(() => { memories.bind(); memories.load(); });
</script>

<template>
    <div class="app">
        <TopBar emoji="🧠" title="记忆">
            <template #actions>
                <button class="btn btn-primary" @click="openCreate">
                    <Icon name="plus" style="width:15px;height:15px" />新建
                </button>
            </template>
        </TopBar>

        <main class="page">
            <div class="page-inner">
                <div class="tools-row">
                    <label class="search-box">
                        <span class="sb-icon"><Icon name="search" /></span>
                        <input v-model="search" type="text" placeholder="搜记忆…" />
                    </label>
                </div>

                <div class="filters" style="margin-top:12px">
                    <button
                        v-for="tab in TABS" :key="tab.value || 'all'"
                        class="filter" :class="{ on: memories.filter === tab.value }"
                        @click="memories.load(tab.value)"
                    >{{ tab.label }}</button>
                </div>

                <div v-if="!shown.length && !memories.loading" class="mem-empty">
                    <div class="e-icon"><Icon name="memory" style="width:34px;height:34px" /></div>
                    <div class="e-title">还没有记忆</div>
                    <div class="e-sub">让 AI 记住关于你的事 —— 偏好、约定、环境,聊天时它都会带着</div>
                </div>

                <div class="glist" style="margin-top:16px">
                    <div v-for="item in shown" :key="item.id" class="card hoverable mem-card" @click="openEdit(item)">
                        <div class="row gap-2">
                            <span class="mem-title grow ellipsis">{{ item.title }}</span>
                            <span class="pill" :class="visOf(item.visibility).pill"><i></i>{{ visOf(item.visibility).label }}</span>
                            <span class="mem-acts">
                                <button class="mem-act" title="编辑" @click.stop="openEdit(item)"><Icon name="pencil" style="width:14px;height:14px" /></button>
                                <button class="mem-act danger" title="删除" @click.stop="del(item)"><Icon name="trash" style="width:14px;height:14px" /></button>
                            </span>
                        </div>
                        <div v-if="item.description" class="mem-desc">{{ item.description }}</div>
                        <div v-if="item.body" class="mem-body">{{ item.body }}</div>
                        <div class="meta mt-2"><span>{{ fmtTime(item.updated_at || item.created_at) }} 更新</span></div>
                    </div>
                </div>
                <button v-if="memories.nextCursor" class="btn btn-plain load-more" :disabled="memories.loading" @click="memories.loadMore">{{ memories.loading ? '加载中…' : '加载更多' }}</button>
            </div>
        </main>

        <!-- 新建 / 编辑记忆 -->
        <Teleport to="body">
            <div v-if="showModal" class="modal-mask" @click.self="showModal = false">
                <div class="modal">
                    <div class="modal-title">{{ isEditing ? '编辑记忆' : '新建记忆' }}</div>
                    <div class="field">
                        <label>标题</label>
                        <input v-model="form.title" class="input" placeholder="比如:饮食禁忌" />
                    </div>
                    <div class="field mt-3">
                        <label>简短描述 <span style="font-weight:500;color:var(--ink-4)">一句话说明这条记忆是干嘛的</span></label>
                        <input v-model="form.description" class="input" placeholder="比如:点餐下单时要记住的" />
                    </div>
                    <div class="field mt-3">
                        <label>正文</label>
                        <textarea v-model="form.body" class="input" rows="4" placeholder="写下要 AI 记住的内容…"></textarea>
                    </div>
                    <div class="field mt-3">
                        <label>可见性</label>
                        <div class="seg">
                            <button class="seg-item" :class="{ on: form.visibility === 'must' }" @click="form.visibility = 'must'">必读</button>
                            <button class="seg-item" :class="{ on: form.visibility === 'star' }" @click="form.visibility = 'star'">星标</button>
                            <button class="seg-item" :class="{ on: form.visibility === 'stored' }" @click="form.visibility = 'stored'">已存</button>
                        </div>
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
/* 记忆页(晴空软糖)—— 页面级样式,组件类走全局 style.css */
.tools-row { display: flex; align-items: center; gap: 10px; }
.search-box {
    flex: 1; display: flex; align-items: center; gap: 8px;
    height: 36px; padding: 0 13px;
    background: var(--panel); border-radius: 12px; box-shadow: var(--shadow-s);
    transition: box-shadow .15s;
}
.search-box:focus-within { box-shadow: var(--shadow-s), 0 0 0 3px var(--candy-ring); }
.search-box .sb-icon { color: var(--ink-4); flex-shrink: 0; width: 15px; height: 15px; }
.search-box input { flex: 1; min-width: 0; border: 0; outline: 0; background: transparent; font-size: 13px; }
.search-box input::placeholder { color: var(--ink-4); }

.glist { display: flex; flex-direction: column; gap: 10px; }
.load-more { display: flex; margin: 14px auto 0; }

.mem-card { padding: 14px 16px 12px; }
.mem-title { font-size: 14px; font-weight: 700; }
.mem-desc { margin-top: 4px; font-size: 12px; font-weight: 500; color: var(--ink-3); }
.mem-body { margin-top: 6px; font-size: 12.5px; line-height: 1.7; color: var(--ink2);
    display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
.mem-acts { display: flex; gap: 4px; flex-shrink: 0; opacity: 0; transition: opacity .15s; }
.card:hover .mem-acts { opacity: 1; }
.mem-act { width: 26px; height: 26px; border-radius: 8px; display: grid; place-items: center;
    color: var(--ink-3); transition: all .15s; }
.mem-act:hover { background: var(--candy-soft); color: var(--candy-deep); }
.mem-act.danger:hover { background: var(--bad-soft); color: var(--bad); }

/* 可见性糖 */
.pill-must  { background: var(--bad-soft);  color: var(--bad); }
.pill-star  { background: var(--run-soft);  color: var(--run-ink); }
.pill-plain { background: var(--wait-soft); color: var(--wait); }

.mem-empty { padding: 56px 20px; text-align: center; }
.mem-empty .e-icon { display: inline-flex; color: var(--ink-4); margin-bottom: 8px; }
.mem-empty .e-title { font-size: 15px; font-weight: 800; margin-bottom: 4px; }
.mem-empty .e-sub { font-size: 13px; line-height: 1.7; color: var(--ink-3); }

@media (max-width: 640px) {
    .tools-row { flex-wrap: wrap; }
    .search-box { flex-basis: 100%; }
}
@media (hover: none), (max-width: 640px) { .mem-acts { opacity: .55; } }
</style>
