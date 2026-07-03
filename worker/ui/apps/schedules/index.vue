<script setup>
// 日程列表(晴空软糖):糖果图标砖 + 规律 chip + 前瞻的「下次」+ 启停 toggle,整卡点进详情。
import { onMounted, ref } from 'vue';
import { useRouter } from 'vue-router';
import { useSchedulesStore } from './store';
import TopBar from '@/system/components/TopBar.vue';
import Icon from '@/system/components/Icon.vue';

const schedules = useSchedulesStore();
const router = useRouter();

// 图标砖:按 index 轮换配色 / 图标
const TILES = ['tile-tasks', 'tile-notes', 'tile-schedule', 'tile-chat', 'tile-memory'];
const ICONS = ['spark', 'doc', 'bolt', 'clock', 'battery'];
const tileOf = (i) => TILES[i % TILES.length];
const iconOf = (i) => ICONS[i % ICONS.length];

/* ── 时间 / cron 文案 ─────────────────────────────── */
const pad = (n) => String(n).padStart(2, '0');
function fmtTime(ts) {
    const t = Number(ts) || 0; if (!t) return '';
    const d = new Date(t);
    return `${d.getMonth() + 1}月${d.getDate()}日 ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

const WD = ['日', '一', '二', '三', '四', '五', '六'];
function utcToLocalHM(h, m) { const d = new Date(); d.setUTCHours(h, m, 0, 0); return `${pad(d.getHours())}:${pad(d.getMinutes())}`; }
function cronText(cron) {
    const p = String(cron || '').trim().split(/\s+/);
    if (p.length !== 5) return cron || '—';
    const [mi, ho, , , dow] = p;
    if (/^\*\/\d+$/.test(mi) && ho === '*') return `每 ${mi.slice(2)} 分钟`;
    if (mi === '0' && ho === '*') return '每小时';
    if (/^\d+$/.test(mi) && /^\d+$/.test(ho)) {
        const hm = utcToLocalHM(+ho, +mi);
        if (dow === '*') return `每天 ${hm}`;
        if (/^[0-6]$/.test(dow)) return `每周${WD[+dow]} ${hm}`;
    }
    return cron;
}
function describe(s) {
    if (s.kind === 'once') return s.run_at ? `一次性 · ${fmtTime(s.run_at)}` : '一次性';
    return cronText(s.cron);
}

// 「下次」文案(前瞻措辞):能从 cron 推就写「下次 …」,推不了就展示规律本身。
function nextText(s) {
    if (!s.enabled) return '已停用';
    if (s.kind === 'once') return s.run_at ? `${fmtTime(s.run_at)} 触发一次` : '未设置时间';
    const p = String(s.cron || '').trim().split(/\s+/);
    if (p.length === 5) {
        const [mi, ho, dom, , dow] = p;
        if (mi === '0' && ho === '*') return '下次 整点';
        if (/^\d+$/.test(mi) && /^\d+$/.test(ho) && dom === '*') {
            const next = new Date(); next.setUTCHours(+ho, +mi, 0, 0);
            if (dow === '*') {
                if (next.getTime() <= Date.now()) next.setDate(next.getDate() + 1);
                const day = next.getDate() === new Date().getDate() ? '今天' : '明天';
                return `下次 ${day} ${pad(next.getHours())}:${pad(next.getMinutes())}`;
            }
            if (/^[0-6]$/.test(dow)) {
                while (next.getUTCDay() !== +dow || next.getTime() <= Date.now()) next.setDate(next.getDate() + 1);
                return `下次 周${WD[next.getDay()]} ${pad(next.getHours())}:${pad(next.getMinutes())}`;
            }
        }
    }
    return cronText(s.cron);
}

/* ── 新建弹窗 ─────────────────────────────────────── */
const creating = ref(false);
const form = ref(emptyForm());
function emptyForm() {
    return { name: '', prompt: '', kind: 'cron', cron: '30 23 * * *', runAtLocal: '' };
}
const CRON_PRESETS = [
    { label: '每天早上 7:30', cron: '30 23 * * *' },
    { label: '每天晚上 10 点', cron: '0 14 * * *' },
    { label: '每小时', cron: '0 * * * *' },
    { label: '每周一早 9 点', cron: '0 1 * * 1' },
];
function openNew() { form.value = emptyForm(); creating.value = true; }

async function save() {
    const f = form.value;
    const body = { name: f.name.trim() || '未命名日程', prompt: f.prompt, kind: f.kind, enabled: true };
    if (f.kind === 'once') {
        if (!f.runAtLocal) return;
        body.run_at = new Date(f.runAtLocal).getTime();
    }
    else body.cron = f.cron.trim();
    await schedules.save(body);
    creating.value = false;
}

onMounted(schedules.load);
</script>

<template>
    <div class="app">
        <TopBar emoji="⏰" title="日程">
            <template #actions>
                <button class="btn btn-primary" @click="openNew"><Icon name="plus" style="width:15px;height:15px" />新建</button>
            </template>
        </TopBar>

        <main class="page">
            <div class="page-inner">
                <div v-if="!schedules.items.length && !schedules.loading" class="card">
                    <div class="empty">
                        <div class="empty-art"><Icon name="schedule" style="width:34px;height:34px" /></div>
                        <div class="empty-title">还没有日程</div>
                        <div class="empty-sub">到点自动开一个任务去办 —— 比如每天早上生成晨报。</div>
                    </div>
                </div>

                <div class="list">
                    <div
                        v-for="(s, i) in schedules.items" :key="s.id"
                        class="card hoverable sched-card" :class="{ off: !s.enabled }"
                        @click="router.push(`/schedules/${s.id}`)"
                    >
                        <div class="row gap-3">
                            <span class="tile sched-ico" :class="tileOf(i)" style="display:grid;place-items:center">
                                <Icon :name="iconOf(i)" style="width:18px;height:18px;color:#fff" />
                            </span>
                            <span class="grow">
                                <span class="row gap-2">
                                    <span class="sched-name">{{ s.name || '未命名日程' }}</span>
                                    <span class="chip accent">{{ describe(s) }}</span>
                                </span>
                                <div class="sched-cmd">{{ s.prompt }}</div>
                                <div class="sched-next">
                                    <Icon v-if="s.enabled" name="clock" style="width:12px;height:12px" />
                                    {{ nextText(s) }}
                                </div>
                            </span>
                            <button class="toggle" :class="{ on: s.enabled }" :aria-label="`启用${s.name || '日程'}`" @click.stop="schedules.toggle(s)"></button>
                            <span class="go"><Icon name="back" style="width:15px;height:15px" /></span>
                        </div>
                    </div>
                </div>
            </div>
        </main>

        <!-- 新建日程 -->
        <Teleport to="body">
            <div v-if="creating" class="modal-mask" @click.self="creating = false">
                <div class="modal">
                    <div class="modal-title">新建日程</div>
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
                        <input class="input mono" style="margin-top:8px;font-size:12.5px" v-model="form.cron" placeholder="自定义 cron(UTC),如 30 23 * * *" />
                        <div style="margin-top:6px;font-size:12px;color:var(--ink-3)">{{ cronText(form.cron) }}</div>
                    </div>
                    <div v-else class="field mt-3">
                        <label>执行时间</label>
                        <input class="input" type="datetime-local" v-model="form.runAtLocal" />
                    </div>
                    <div class="modal-foot">
                        <button class="btn btn-plain" @click="creating = false">取消</button>
                        <button class="btn btn-primary" :disabled="form.kind === 'once' && !form.runAtLocal" @click="save">保存</button>
                    </div>
                </div>
            </div>
        </Teleport>
    </div>
</template>

<style scoped>
.list { display: flex; flex-direction: column; gap: 10px; margin-top: 16px; }
.sched-card { padding: 16px 18px 15px; }
.sched-card.off .sched-name, .sched-card.off .sched-cmd { color: var(--ink-3); }
.sched-name { font-size: 14px; font-weight: 700; }
.sched-cmd { margin-top: 5px; font-size: 12.5px; line-height: 1.7; color: var(--ink2);
    white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.sched-ico { width: 40px; height: 40px; border-radius: 13px; flex-shrink: 0; }
.sched-card.off .sched-ico { filter: grayscale(1); opacity: .55; }
.sched-next { margin-top: 8px; font-size: 11.5px; font-weight: 500; color: var(--ink-3); display: flex; align-items: center; gap: 5px; }
.go { transform: scaleX(-1); width: 15px; height: 15px; color: var(--ink-4); flex-shrink: 0; }
</style>

<style>
/* 弹窗内:快捷规律糖(Teleport 到 body,不能 scoped) */
.rule-chips { display: flex; flex-wrap: wrap; gap: 7px; }
.rule-chip {
    height: 28px; padding: 0 12px; border-radius: 99px;
    background: var(--well); color: var(--ink2);
    font-size: 12px; font-weight: 600;
    transition: all .15s var(--ease);
}
.rule-chip:hover { color: var(--ink); }
.rule-chip.on { background: var(--candy-soft); color: var(--candy-deep); font-weight: 700; box-shadow: 0 0 0 1.5px var(--candy-ring) inset; }
</style>
