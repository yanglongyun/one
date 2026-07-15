<script setup>
// 目标详情(晴空软糖):目标卡(状态四态 seg)+ 编辑弹窗 + 推进记录(按 origin 过滤任务)。
import { computed, onMounted, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useGoalsStore } from './store';
import { api } from '@/system/api';
import TopBar from '@/system/components/TopBar.vue';
import Icon from '@/system/components/Icon.vue';

const route = useRoute();
const router = useRouter();
const goals = useGoalsStore();

const id = computed(() => String(route.params.id));
const goal = computed(() => goals.items.find((g) => String(g.id) === id.value) || null);

const STATES = [
    { value: 'active', label: '进行中', pill: 'pill-live' },
    { value: 'paused', label: '已暂停', pill: 'pill-halt' },
    { value: 'done', label: '已达成', pill: 'pill-ok' },
    { value: 'abandoned', label: '已放弃', pill: 'pill-halt' },
];
const statusOf = (s) => STATES.find((x) => x.value === s) || STATES[0];

async function setStatus(status) {
    const g = goal.value;
    if (!g || g.status === status) return;
    await goals.save({ id: g.id, title: g.title, prompt: g.prompt, status });
}

/* ── 推进记录:GET /api/tasks 按 origin 过滤 ─────── */
const runs = ref([]);
const runCursors = ref({ goal: '', goal_review: '' });
const loadingRuns = ref(false);

async function loadRunPage(origin, cursor = '') {
    const query = new URLSearchParams({ origin, origin_id: id.value, limit: '50' });
    if (cursor) query.set('cursor', cursor);
    return api.get(`/api/tasks?${query}`);
}

function mergeRuns(pages, reset) {
    const previous = reset ? [] : runs.value;
    const byId = new Map(previous.map((task) => [task.id, task]));
    for (const page of pages) for (const task of page.tasks || []) byId.set(task.id, task);
    runs.value = [...byId.values()].sort((a, b) => b.created_at - a.created_at || String(b.id).localeCompare(String(a.id)));
}

async function loadRuns() {
    loadingRuns.value = true;
    try {
        const [work, reviews] = await Promise.all([
            loadRunPage('goal'),
            loadRunPage('goal_review'),
        ]);
        mergeRuns([work, reviews], true);
        runCursors.value = { goal: work.nextCursor || '', goal_review: reviews.nextCursor || '' };
    } catch {
        runs.value = [];
        runCursors.value = { goal: '', goal_review: '' };
    } finally { loadingRuns.value = false; }
}

async function loadMoreRuns() {
    if (loadingRuns.value) return;
    const entries = Object.entries(runCursors.value).filter(([, cursor]) => cursor);
    if (!entries.length) return;
    loadingRuns.value = true;
    try {
        const pages = await Promise.all(entries.map(([origin, cursor]) => loadRunPage(origin, cursor)));
        mergeRuns(pages, false);
        const cursors = { ...runCursors.value };
        entries.forEach(([origin], index) => { cursors[origin] = pages[index].nextCursor || ''; });
        runCursors.value = cursors;
    } finally { loadingRuns.value = false; }
}
const hasMoreRuns = computed(() => Object.values(runCursors.value).some(Boolean));
const TASK_META = {
    pending: { label: '等待中', pill: 'pill-wait', dot: 'dot-wait' },
    running: { label: '执行中', pill: 'pill-run', dot: 'dot-run' },
    done: { label: '完成', pill: 'pill-ok', dot: 'dot-ok' },
    failed: { label: '失败', pill: 'pill-bad', dot: 'dot-bad' },
    aborted: { label: '已中止', pill: 'pill-halt', dot: 'dot-halt' },
    cancelled: { label: '已取消', pill: 'pill-halt', dot: 'dot-halt' },
};
const metaOf = (t) => TASK_META[t.status] || TASK_META.pending;

const pad = (n) => String(n).padStart(2, '0');
function fmtTime(ts) {
    const t = Number(ts) || 0; if (!t) return '';
    const d = new Date(t); const now = new Date();
    const hm = `${pad(d.getHours())}:${pad(d.getMinutes())}`;
    const sameDay = (a, b) => a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
    if (sameDay(d, now)) return `今天 ${hm}`;
    const yest = new Date(now); yest.setDate(now.getDate() - 1);
    if (sameDay(d, yest)) return `昨天 ${hm}`;
    return `${d.getMonth() + 1}月${d.getDate()}日 ${hm}`;
}
const fmtHM = (ts) => { const d = new Date(Number(ts)); return `${pad(d.getHours())}:${pad(d.getMinutes())}`; };
function taskTime(t) {
    const start = fmtTime(t.created_at);
    const end = Number(t.finished_at || t.ended_at || t.completed_at) || 0;
    return end ? `${start} → ${fmtHM(end)}` : (t.status === 'running' ? `${start} 开始` : start);
}

/* ── 编辑弹窗 ─────────────────────────────────────── */
const editing = ref(false);
const form = ref({ title: '', prompt: '' });
function openEdit() {
    const g = goal.value; if (!g) return;
    form.value = { title: g.title || '', prompt: g.prompt || '' };
    editing.value = true;
}
// 下次推进时间的人话
function fmtNext(ts) {
    if (!ts) return '';
    const diff = ts - Date.now();
    if (diff <= 60000) return '马上';
    const min = Math.round(diff / 60000);
    if (min < 60) return `${min} 分钟后`;
    const h = Math.round(min / 60);
    if (h < 24) return `${h} 小时后`;
    return `${Math.round(h / 24)} 天后`;
}

// 立即推进:把 next_run_at 排到现在,由 DO alarm 立刻接手。
async function advanceNow() {
    if (!goal.value) return;
    await goals.save({ id: goal.value.id, next_run_at: Date.now() });
    await goals.load();
    loadRuns();
}

async function save() {
    const g = goal.value;
    if (!g || !form.value.title.trim()) return;
    await goals.save({ id: g.id, title: form.value.title.trim(), prompt: form.value.prompt.trim(), status: g.status });
    editing.value = false;
}
async function del() {
    const g = goal.value; if (!g) return;
    if (!confirm(`删除目标「${g.title}」?`)) return;
    await goals.remove(g.id);
    router.push('/goals');
}

onMounted(async () => {
    goals.bind();
    if (!goals.items.length) await goals.load();
    loadRuns();
});
</script>

<template>
    <div class="app">
        <TopBar back="/goals" :title="goal?.title || '目标详情'">
            <template #actions>
                <button v-if="goal" class="btn btn-plain" @click="openEdit"><Icon name="pencil" style="width:14px;height:14px" />编辑</button>
            </template>
        </TopBar>

        <main class="page">
            <div class="page-inner">
                <div v-if="!goal" class="card">
                    <div class="empty">
                        <div class="empty-art"><Icon name="goals" style="width:34px;height:34px" /></div>
                        <div class="empty-title">目标不存在</div>
                        <div class="empty-sub">它可能已被删除。回到列表看看其它目标。</div>
                    </div>
                </div>

                <template v-else>
                    <!-- 目标卡 -->
                    <div class="card goal-overview">
                        <div class="row gap-2">
                            <span class="grow" style="font-size:15px;font-weight:700">{{ goal.title || '未命名目标' }}</span>
                            <span class="pill" :class="statusOf(goal.status).pill"><i></i>{{ statusOf(goal.status).label }}</span>
                        </div>
                        <div v-if="goal.prompt" class="goal-desc">{{ goal.prompt }}</div>
                        <div class="state-row">
                            <span class="k">状态</span>
                            <div class="seg">
                                <button v-for="s in STATES" :key="s.value" class="seg-item" :class="{ on: (goal.status || 'active') === s.value }" @click="setStatus(s.value)">{{ s.label }}</button>
                            </div>
                        </div>
                    </div>

                    <!-- 推进循环:下次时间 + 最新自评 -->
                    <div v-if="goal.status === 'active' || goal.last_report" class="card goal-overview" style="margin-top:12px">
                        <div class="row gap-2">
                            <span class="grow" style="font-size:13.5px;font-weight:700">推进循环</span>
                            <span v-if="goal.status === 'active' && goal.next_run_at" class="chip accent">下次推进 · {{ fmtNext(goal.next_run_at) }}</span>
                            <span v-else-if="goal.status === 'active'" class="chip">推进中或待安排</span>
                            <button v-if="goal.status === 'active'" class="btn btn-plain" style="height:30px;padding:0 12px;font-size:12px" @click="advanceNow">立即推进</button>
                        </div>
                        <div v-if="goal.last_report" class="goal-desc" style="margin-top:10px">{{ goal.last_report }}</div>
                        <div v-else class="goal-desc" style="margin-top:10px;color:var(--ink-3)">还没有推进记录 —— 到点后 one 会自动走一步,并在这里留下评估。</div>
                    </div>

                    <!-- 推进记录 -->
                    <div class="timeline-label">推进记录</div>
                    <div class="list">
                        <div v-if="!runs.length" class="card" style="padding:16px 18px;font-size:12.5px;color:var(--ink-3)">还没有推进记录 —— AI 围绕这个目标开的任务会出现在这里。</div>
                        <div v-for="t in runs" :key="t.id" class="card hoverable task-card" @click="router.push(`/tasks/${t.id}`)">
                            <span class="dot" :class="metaOf(t).dot"></span>
                            <span class="grow">
                                <div class="task-title">{{ t.title || '未命名任务' }}</div>
                                <div class="task-time">{{ taskTime(t) }}</div>
                            </span>
                            <span class="pill" :class="metaOf(t).pill"><i></i>{{ metaOf(t).label }}</span>
                            <span class="go"><Icon name="back" style="width:15px;height:15px" /></span>
                        </div>
                        <button v-if="hasMoreRuns" class="btn btn-plain load-more" :disabled="loadingRuns" @click="loadMoreRuns">{{ loadingRuns ? '加载中…' : '加载更多' }}</button>
                    </div>
                </template>
            </div>
        </main>

        <!-- 编辑目标 -->
        <Teleport to="body">
            <div v-if="editing" class="modal-mask" @click.self="editing = false">
                <div class="modal">
                    <div class="modal-title">编辑目标</div>
                    <div class="field">
                        <label>标题</label>
                        <input class="input" v-model="form.title" placeholder="比如:把 one 发布上线" />
                    </div>
                    <div class="field mt-3">
                        <label>详细说明</label>
                        <textarea class="input" v-model="form.prompt" rows="4" placeholder="写清楚达成标准。AI 会照着它主动拆解、推进任务。"></textarea>
                    </div>
                    <div class="modal-foot">
                        <button class="btn btn-danger-soft" style="margin-right:auto" @click="del">删除</button>
                        <button class="btn btn-plain" @click="editing = false">取消</button>
                        <button class="btn btn-primary" :disabled="!form.title.trim()" @click="save">保存</button>
                    </div>
                </div>
            </div>
        </Teleport>
    </div>
</template>

<style scoped>
.pill-live { background: var(--candy-soft); color: var(--candy-deep); }
/* 目标卡 */
.goal-overview { padding: 17px 18px 16px; }
.goal-desc { margin-top: 10px; font-size: 13px; line-height: 1.8; color: var(--ink2);
    background: var(--well); border-radius: 13px; padding: 11px 14px; }
/* 状态切换 */
.state-row { margin-top: 14px; display: flex; align-items: center; gap: 10px; }
.state-row .k { font-size: 12px; font-weight: 700; color: var(--ink-3); flex-shrink: 0; }

/* 推进记录 */
.timeline-label { margin: 24px 2px 10px; font-size: 12px; font-weight: 800; color: var(--ink-3); letter-spacing: .05em; display: flex; align-items: center; gap: 8px; }
.timeline-label::after { content: ""; flex: 1; height: 1px; background: var(--line); }
.list { display: flex; flex-direction: column; gap: 10px; }
.task-card { display: flex; align-items: center; gap: 12px; padding: 13px 16px; }
.task-title { font-size: 13.5px; font-weight: 700; }
.task-time { font-size: 11.5px; color: var(--ink-3); font-weight: 500; margin-top: 3px; }
.go { width: 15px; height: 15px; color: var(--ink-4); transform: scaleX(-1); flex-shrink: 0; }
.load-more { align-self: center; margin-top: 2px; }
</style>
