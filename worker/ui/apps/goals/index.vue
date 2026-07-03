<script setup>
// 目标列表(晴空软糖):标题 + 状态 pill + 一行说明,整卡点进详情;新建走弹窗。
import { onMounted, ref } from 'vue';
import { useRouter } from 'vue-router';
import { useGoalsStore } from './store';
import TopBar from '@/system/components/TopBar.vue';
import Icon from '@/system/components/Icon.vue';

const goals = useGoalsStore();
const router = useRouter();

const STATUS = {
    active: { label: '进行中', pill: 'pill-live' },
    paused: { label: '已暂停', pill: 'pill-halt' },
    done: { label: '已达成', pill: 'pill-ok' },
    abandoned: { label: '已放弃', pill: 'pill-halt' },
};
const statusOf = (s) => STATUS[s] || STATUS.active;

/* ── 新建弹窗 ─────────────────────────────────────── */
const creating = ref(false);
const form = ref({ title: '', prompt: '' });
function openNew() { form.value = { title: '', prompt: '' }; creating.value = true; }
async function create() {
    if (!form.value.title.trim()) return;
    await goals.save({ title: form.value.title.trim(), prompt: form.value.prompt.trim(), status: 'active' });
    creating.value = false;
}

onMounted(() => goals.load());
</script>

<template>
    <div class="app">
        <TopBar emoji="🎯" title="目标">
            <template #actions>
                <button class="btn btn-primary" @click="openNew"><Icon name="plus" style="width:15px;height:15px" />新建</button>
            </template>
        </TopBar>

        <main class="page">
            <div class="page-inner">
                <div v-if="!goals.items.length && !goals.loading" class="card">
                    <div class="empty">
                        <div class="empty-art"><Icon name="goals" style="width:34px;height:34px" /></div>
                        <div class="empty-title">还没有目标</div>
                        <div class="empty-sub">设一个方向,让它在对话或任务里持续替你往前推。</div>
                    </div>
                </div>

                <div class="list">
                    <div
                        v-for="item in goals.items" :key="item.id"
                        class="card hoverable goal-card" :class="{ paused: item.status === 'paused' || item.status === 'abandoned' }"
                        @click="router.push(`/goals/${item.id}`)"
                    >
                        <div class="row gap-2">
                            <span class="goal-title grow ellipsis">{{ item.title || '未命名目标' }}</span>
                            <span class="pill" :class="statusOf(item.status).pill"><i></i>{{ statusOf(item.status).label }}</span>
                            <span class="go"><Icon name="back" style="width:15px;height:15px" /></span>
                        </div>
                        <div v-if="item.prompt" class="goal-desc ellipsis">{{ item.prompt }}</div>
                    </div>
                </div>

                <div class="foot-note">目标不带定时——要固定节奏推进,给它配一条<router-link to="/schedules">日程</router-link>。</div>
            </div>
        </main>

        <!-- 新建目标 -->
        <Teleport to="body">
            <div v-if="creating" class="modal-mask" @click.self="creating = false">
                <div class="modal">
                    <div class="modal-title">新建目标</div>
                    <div class="field">
                        <label>标题</label>
                        <input class="input" v-model="form.title" placeholder="比如:把 one 发布上线" />
                    </div>
                    <div class="field mt-3">
                        <label>详细说明</label>
                        <textarea class="input" v-model="form.prompt" rows="4" placeholder="写清楚达成标准,比如:官网可下载、有 10 个真实用户。AI 会照着它主动拆解、推进任务。"></textarea>
                    </div>
                    <div class="modal-foot">
                        <button class="btn btn-plain" @click="creating = false">取消</button>
                        <button class="btn btn-primary" :disabled="!form.title.trim()" @click="create">创建</button>
                    </div>
                </div>
            </div>
        </Teleport>
    </div>
</template>

<style scoped>
.list { display: flex; flex-direction: column; gap: 12px; margin-top: 4px; }
.pill-live { background: var(--candy-soft); color: var(--candy-deep); }
.goal-card { padding: 17px 18px 15px; position: relative; }
.goal-title { font-size: 15px; font-weight: 700; }
.goal-desc { margin-top: 6px; font-size: 12.5px; line-height: 1.75; color: var(--ink2); }
.goal-card.paused .goal-title, .goal-card.paused .goal-desc { color: var(--ink-3); }
.go { transform: scaleX(-1); width: 15px; height: 15px; color: var(--ink-4); flex-shrink: 0; }
.foot-note { margin-top: 20px; text-align: center; font-size: 12px; color: var(--ink-3); line-height: 1.8; }
.foot-note a { color: var(--candy-deep); text-decoration: none; font-weight: 600; }
.foot-note a:hover { text-decoration: underline; }
</style>
