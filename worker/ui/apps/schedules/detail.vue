<script setup>
// 日程详情:日程卡 + 编辑弹窗 + 触发记录(按 origin 过滤任务)。
import { computed, onMounted, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useSchedulesStore } from './store';
import { api } from '@/system/api';
import TopBar from '@/system/components/TopBar.vue';
import Icon from '@/system/components/Icon.vue';
import { confirmDialog } from '@/system/lib/confirm';

const route = useRoute();
const router = useRouter();
const schedules = useSchedulesStore();

const id = computed(() => String(route.params.id));
const sched = computed(() => schedules.items.find((s) => String(s.id) === id.value) || null);
const idx = computed(() => Math.max(0, schedules.items.findIndex((s) => String(s.id) === id.value)));

// 图标砖:与列表页同一套轮换,保持视觉一致
const TILES = ['tile-tasks', 'tile-notes', 'tile-schedule', 'tile-chat', 'tile-memory'];
const ICONS = ['spark', 'doc', 'bolt', 'clock', 'battery'];

/* ── 时间 / cron 文案 ─────────────────────────────── */
const pad = (n) => String(n).padStart(2, '0');
const localTimezone = () => Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
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

const WD = ['日', '一', '二', '三', '四', '五', '六'];
function cronText(cron, timezone = '') {
    const p = String(cron || '').trim().split(/\s+/);
    if (p.length !== 5) return cron || '—';
    const [mi, ho, , , dow] = p;
    if (/^\*\/\d+$/.test(mi) && ho === '*') return `每 ${mi.slice(2)} 分钟`;
    if (mi === '0' && ho === '*') return '每小时';
    if (/^\d+$/.test(mi) && /^\d+$/.test(ho)) {
        const hm = `${pad(+ho)}:${pad(+mi)}`;
        const zone = timezone ? ` · ${timezone}` : '';
        if (dow === '*') return `每天 ${hm}${zone}`;
        if (/^[0-6]$/.test(dow)) return `每周${WD[+dow]} ${hm}${zone}`;
    }
    return cron;
}
function describe(s) {
    if (s.kind === 'once') return s.run_at ? `一次性 · ${fmtTime(s.run_at)}` : '一次性';
    return cronText(s.cron, s.timezone);
}

/* ── 触发记录:GET /api/tasks 按 origin 过滤 ─────── */
const runs = ref([]);
const runCursor = ref('');
const loadingRuns = ref(false);
async function loadRuns({ append = false } = {}) {
    if (loadingRuns.value) return;
    loadingRuns.value = true;
    try {
        const query = new URLSearchParams({ limit: '50', origin: 'schedule', origin_id: id.value });
        if (append && runCursor.value) query.set('cursor', runCursor.value);
        const res = await api.get(`/api/tasks?${query}`);
        if (append) {
            const known = new Set(runs.value.map((task) => task.id));
            runs.value.push(...(res.tasks || []).filter((task) => !known.has(task.id)));
        } else runs.value = res.tasks || [];
        runCursor.value = res.nextCursor || '';
    } catch {
        if (!append) runs.value = [];
    } finally { loadingRuns.value = false; }
}
const TASK_META = {
    pending: { label: '等待中', pill: 'pill-wait', dot: 'dot-wait' },
    running: { label: '执行中', pill: 'pill-run', dot: 'dot-run' },
    done: { label: '完成', pill: 'pill-ok', dot: 'dot-ok' },
    failed: { label: '失败', pill: 'pill-bad', dot: 'dot-bad' },
    aborted: { label: '已中止', pill: 'pill-halt', dot: 'dot-halt' },
    cancelled: { label: '已取消', pill: 'pill-halt', dot: 'dot-halt' },
};
const metaOf = (t) => TASK_META[t.status] || TASK_META.pending;
function taskTime(t) {
    const start = fmtTime(t.created_at);
    const end = Number(t.finished_at || t.ended_at || t.completed_at) || 0;
    return end ? `${start} → ${fmtHM(end)}` : (t.status === 'running' ? `${start} 开始` : start);
}

/* ── 编辑弹窗 ─────────────────────────────────────── */
const editing = ref(false);
const form = ref(null);
const CRON_PRESETS = [
    { label: '每天早上 7:30', cron: '30 7 * * *' },
    { label: '每天晚上 10 点', cron: '0 22 * * *' },
    { label: '每小时', cron: '0 * * * *' },
    { label: '每周一早 9 点', cron: '0 9 * * 1' },
];
function toLocalInput(ts) {
    const d = new Date(Number(ts));
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
function openEdit() {
    const s = sched.value; if (!s) return;
    form.value = {
        name: s.name, prompt: s.prompt,
        kind: s.kind === 'once' ? 'once' : 'cron',
        cron: s.cron || '30 7 * * *',
        timezone: s.timezone || localTimezone(),
        runAtLocal: s.run_at ? toLocalInput(s.run_at) : '',
    };
    editing.value = true;
}
async function save() {
    const f = form.value; const s = sched.value; if (!f || !s) return;
    const body = { id: s.id, name: f.name.trim() || '未命名日程', prompt: f.prompt, kind: f.kind, enabled: s.enabled };
    if (f.kind === 'once') {
        if (!f.runAtLocal) return;
        body.run_at = new Date(f.runAtLocal).getTime();
    }
    else { body.cron = f.cron.trim(); body.timezone = f.timezone || 'UTC'; }
    await schedules.save(body);
    editing.value = false;
}
async function del() {
    const s = sched.value; if (!s) return;
    if (!(await confirmDialog({ title: '删除日程', message: `删除日程「${s.name || '未命名'}」?`, confirmText: '删除', danger: true }))) return;
    await schedules.remove(s.id);
    router.push('/schedules');
}

onMounted(async () => {
    schedules.bind();
    if (!schedules.items.length) await schedules.load();
    loadRuns();
});
</script>

<template>
    <div class="app">
        <TopBar back="/schedules" :title="sched?.name || '日程详情'">
            <template #actions>
                <button v-if="sched" class="btn btn-plain" @click="openEdit"><Icon name="pencil" style="width:14px;height:14px" />编辑</button>
            </template>
        </TopBar>

        <main class="page">
            <div class="page-inner">
                <div v-if="!sched" class="card">
                    <div class="empty">
                        <div class="empty-art"><Icon name="schedule" style="width:34px;height:34px" /></div>
                        <div class="empty-title">日程不存在</div>
                        <div class="empty-sub">它可能已被删除。回到列表看看其它日程。</div>
                    </div>
                </div>

                <template v-else>
                    <!-- 日程卡 -->
                    <div class="card sched-overview">
                        <div class="row gap-3">
                            <span class="tile" :class="TILES[idx % TILES.length]" style="width:40px;height:40px;border-radius:13px;display:grid;place-items:center;flex-shrink:0">
                                <Icon :name="ICONS[idx % ICONS.length]" style="width:18px;height:18px;color:var(--on-accent)" />
                            </span>
                            <span class="grow row gap-2">
                                <span style="font-size:15px;font-weight:700">{{ sched.name || '未命名日程' }}</span>
                                <span class="chip accent">{{ describe(sched) }}</span>
                            </span>
                            <button class="toggle" :class="{ on: sched.enabled }" :aria-label="`启用${sched.name || '日程'}`" @click="schedules.toggle(sched)"></button>
                        </div>
                        <div class="sched-prompt">{{ sched.prompt }}</div>
                        <div class="sched-rows">
                            <div class="sched-row" style="border-top:0;margin-top:4px">
                                <span class="k">类型</span>
                                <span class="v">{{ sched.kind === 'once' ? describe(sched) : `循环 · ${cronText(sched.cron, sched.timezone)}` }}</span>
                            </div>
                        </div>
                    </div>

                    <!-- 触发记录 -->
                    <div class="timeline-label">触发记录</div>
                    <div class="list">
                        <div v-if="!runs.length" class="card" style="padding:16px 18px;font-size:12.5px;color:var(--ink-3)">还没有触发过 —— 到点后会在这里留下记录。</div>
                        <div v-for="t in runs" :key="t.id" class="card hoverable task-card" @click="router.push(`/tasks/${t.id}`)">
                            <span class="dot" :class="metaOf(t).dot"></span>
                            <span class="grow">
                                <div class="task-title">{{ t.title || '未命名任务' }}</div>
                                <div class="task-time">{{ taskTime(t) }}</div>
                            </span>
                            <span class="pill" :class="metaOf(t).pill"><i></i>{{ metaOf(t).label }}</span>
                            <span class="go"><Icon name="back" style="width:15px;height:15px" /></span>
                        </div>
                        <button v-if="runCursor" class="btn btn-plain load-more" :disabled="loadingRuns" @click="loadRuns({ append: true })">{{ loadingRuns ? '加载中…' : '加载更多' }}</button>
                    </div>
                </template>
            </div>
        </main>

        <!-- 编辑日程 -->
        <Teleport to="body">
            <div v-if="editing && form" class="modal-mask" @click.self="editing = false">
                <div class="modal">
                    <div class="modal-title">编辑日程</div>
                    <div class="field">
                        <label>名称</label>
                        <input class="input" v-model="form.name" placeholder="比如:晨报" />
                    </div>
                    <div class="field mt-3">
                        <label>到点要它做什么</label>
                        <textarea class="input" v-model="form.prompt" rows="3" placeholder="比如:抓取今日科技头条与天气,整理成晨报存进笔记。"></textarea>
                    </div>
                    <div class="field mt-3">
                        <label>类型</label>
                        <div class="seg">
                            <button class="seg-item" :class="{ on: form.kind === 'cron' }" @click="form.kind = 'cron'">循环</button>
                            <button class="seg-item" :class="{ on: form.kind === 'once' }" @click="form.kind = 'once'">一次性</button>
                        </div>
                    </div>
                    <div v-if="form.kind === 'cron'" class="field mt-3">
                        <label>触发规律</label>
                        <div class="rule-chips">
                            <button v-for="p in CRON_PRESETS" :key="p.cron" class="rule-chip" :class="{ on: form.cron.trim() === p.cron }" @click="form.cron = p.cron">{{ p.label }}</button>
                        </div>
                        <input class="input mono" style="margin-top:8px;font-size:12.5px" v-model="form.cron" placeholder="自定义 cron,如 30 7 * * *" />
                        <input class="input mono" style="margin-top:8px;font-size:12.5px" v-model="form.timezone" placeholder="时区,如 Asia/Shanghai" />
                        <div style="margin-top:6px;font-size:12px;color:var(--ink-3)">{{ cronText(form.cron, form.timezone) }}</div>
                    </div>
                    <div v-else class="field mt-3">
                        <label>执行时间</label>
                        <input class="input" type="datetime-local" v-model="form.runAtLocal" />
                    </div>
                    <div class="modal-foot">
                        <button class="btn btn-danger-soft" style="margin-right:auto" @click="del">删除</button>
                        <button class="btn btn-plain" @click="editing = false">取消</button>
                        <button class="btn btn-primary" :disabled="form.kind === 'once' && !form.runAtLocal" @click="save">保存</button>
                    </div>
                </div>
            </div>
        </Teleport>
    </div>
</template>

<style scoped>
/* 日程卡 */
.sched-overview { padding: 17px 18px 15px; }
.sched-prompt { margin-top: 10px; font-size: 13px; line-height: 1.75; color: var(--ink2);
    background: var(--well); border-radius: 13px; padding: 11px 14px; }
.sched-rows { margin-top: 12px; display: flex; flex-direction: column; }
.sched-row { display: flex; align-items: center; gap: 10px; padding: 9px 2px;
    border-top: 1px solid var(--line-soft); font-size: 13px; }
.sched-row .k { color: var(--ink-3); font-weight: 600; width: 88px; flex-shrink: 0; }
.sched-row .v { flex: 1; min-width: 0; font-weight: 600; display: flex; align-items: center; gap: 6px; }

/* 触发记录 */
.timeline-label { margin: 24px 2px 10px; font-size: 12px; font-weight: 800; color: var(--ink-3); letter-spacing: .05em; display: flex; align-items: center; gap: 8px; }
.timeline-label::after { content: ""; flex: 1; height: 1px; background: var(--line); }
.list { display: flex; flex-direction: column; gap: 10px; }
.task-card { display: flex; align-items: center; gap: 12px; padding: 13px 16px; }
.task-title { font-size: 13.5px; font-weight: 700; }
.task-time { font-size: 11.5px; color: var(--ink-3); font-weight: 500; margin-top: 3px; }
.go { width: 15px; height: 15px; color: var(--ink-4); transform: scaleX(-1); flex-shrink: 0; }
.load-more { align-self: center; margin-top: 2px; }
</style>
