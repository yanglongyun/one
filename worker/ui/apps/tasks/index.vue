<script setup>
import { onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { useTasksStore } from './store';
import { statusOf, originOf } from './meta';
import { confirmDialog } from '@/system/lib/confirm';
import { fmtTime } from '@/system/lib/thread/format';
import TopBar from '@/system/components/TopBar.vue';
import Icon from '@/system/components/Icon.vue';

// 列表摘要:剥掉 markdown 记号,只留纯文本节选(完整渲染在详情页)
function stripMd(t) {
    return String(t || '')
        .replace(/```[\s\S]*?```/g, ' ')
        .replace(/[#*_>`~]|\|[-: ]+\|/g, '')
        .replace(/\|/g, ' · ')
        .replace(/\s+/g, ' ')
        .trim();
}

const tasks = useTasksStore();
const router = useRouter();

const TABS = [
    { value: '', label: '全部' },
    { value: 'running', label: '执行中' },
    { value: 'pending', label: '等待中' },
    { value: 'done', label: '已完成' },
    { value: 'failed', label: '失败' },
];

const countOf = (value) => tasks.counts[value || 'all'];
const pick = (value) => tasks.load(value);

async function remove(t, event) {
    event.stopPropagation();
    if (!(await confirmDialog({ title: '取消任务', message: `取消任务「${t.title || '未命名'}」?执行记录会保留。`, danger: true }))) return;
    await tasks.remove(t.id);
}

function open(t) { router.push(`/tasks/${t.id}`); }
function openOrigin(t, event) {
    event.stopPropagation();
    const o = originOf(t.origin);
    if (o.link && t.origin_id) router.push(o.link + t.origin_id);
}

onMounted(() => { tasks.bind(); tasks.load(); });
</script>

<template>
    <div class="app">
        <TopBar title="任务" />

        <main class="page">
            <div class="page-inner">
                <div class="filters">
                    <button
                        v-for="tab in TABS" :key="tab.value || 'all'"
                        class="filter" :class="{ on: tasks.statusFilter === tab.value }"
                        @click="pick(tab.value)"
                    >{{ tab.label }} <span v-if="countOf(tab.value) != null" class="count">{{ countOf(tab.value) }}</span></button>
                </div>

                <div v-if="!tasks.items.length && !tasks.loading" class="tasks-empty">
                    <div class="e-icon"><Icon name="bolt" style="width:34px;height:34px" /></div>
                    <div class="e-title">还没有任务</div>
                    <div class="e-sub">独立的事,让 AI 开一条线单独去办 —— 不占主对话,完成了看结果就好</div>
                </div>

                <div class="tasks-list">
                    <div v-for="t in tasks.items" :key="t.id" class="card hoverable task-card" @click="open(t)">
                        <span class="dot" :class="statusOf(t.status).dot"></span>
                        <span class="grow">
                            <span class="row gap-2">
                                <span class="task-title grow ellipsis">{{ t.title || '未命名任务' }}</span>
                                <span class="pill" :class="statusOf(t.status).pill"><i></i>{{ statusOf(t.status).label }}</span>
                            </span>
                            <div v-if="t.summary" class="task-sum">{{ stripMd(t.summary) }}</div>
                            <div v-else class="task-sum pending">{{ t.prompt }}</div>
                            <div class="meta task-meta">
                                <span class="origin-badge">
                                    <Icon :name="originOf(t.origin).icon" />
                                    <template v-if="originOf(t.origin).link && t.origin_id">
                                        {{ originOf(t.origin).label }} ·&nbsp;<a href="#" @click.prevent="openOrigin(t, $event)">{{ t.origin_title || '查看' }}</a>
                                    </template>
                                    <template v-else>{{ originOf(t.origin).label }}</template>
                                </span>
                                <span class="sep"></span>
                                <span>{{ fmtTime(t.created_at) }}<template v-if="t.finished_at"> → {{ fmtTime(t.finished_at) }}</template></span>
                            </div>
                        </span>
                        <button v-if="t.status === 'pending' || t.status === 'running'" class="task-del" title="取消任务" @click="remove(t, $event)"><Icon name="trash" /></button>
                    </div>
                </div>
                <button v-if="tasks.nextCursor" class="btn btn-plain load-more" :disabled="tasks.loading" @click="tasks.loadMore">{{ tasks.loading ? '加载中…' : '加载更多' }}</button>
            </div>
        </main>

    </div>
</template>

<style>
/* 任务列表页—— 页面级样式,组件类走全局 style.css */
.task-card { display: flex; gap: 12px; padding: 15px 16px 13px; }
.task-card .dot { margin-top: 6px; }
.task-title { font-size: 14px; font-weight: 700; }
.task-sum { margin-top: 5px; font-size: 12.5px; line-height: 1.7; color: var(--ink2);
    display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
.task-sum.pending { color: var(--ink-3); }
.task-meta { margin-top: 9px; }
.task-del { opacity: 0; width: 26px; height: 26px; border-radius: 8px; display: grid; place-items: center;
    color: var(--ink-3); transition: all .15s; flex-shrink: 0; margin-top: 2px; }
.task-del svg { width: 14px; height: 14px; }
.card:hover .task-del { opacity: 1; }
.task-del:hover { background: var(--bad-soft); color: var(--bad); }
.tasks-list { display: flex; flex-direction: column; gap: 10px; margin-top: 16px; }
.load-more { display: flex; margin: 14px auto 0; }
.origin-badge { display: inline-flex; align-items: center; gap: 4px; }
.origin-badge svg { width: 12px; height: 12px; }
.origin-badge a { color: var(--candy-deep); text-decoration: none; font-weight: 600; }
.origin-badge a:hover { text-decoration: underline; }
.tasks-empty { padding: 56px 20px; text-align: center; }
.tasks-empty .e-icon { display: inline-flex; color: var(--ink-4); margin-bottom: 8px; }
.tasks-empty .e-title { font-size: 15px; font-weight: 800; margin-bottom: 4px; }
.tasks-empty .e-sub { font-size: 13px; line-height: 1.7; color: var(--ink-3); }

@media (hover: none), (max-width: 640px) { .task-del { opacity: .55; } }
</style>
