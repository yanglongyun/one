<script setup>
// 创建应用引导页(demo app-create.html 的 Vue 移植)。
import TopBar from '@/system/components/TopBar.vue';
import Icon from '@/system/components/Icon.vue';

const DEMOS = [
    { icon: 'doc', glow: 'rgba(23,168,159,.45)', bg: 'linear-gradient(150deg,#3fc8c0,#17a89f)', name: '记账本', sub: '随口说一笔支出,月底自动汇总分类' },
    { icon: 'spark', glow: 'rgba(243,138,29,.45)', bg: 'linear-gradient(150deg,#ffb648,#f38a1d)', name: '健身打卡', sub: '练完说一声,进度和恢复情况它来盯' },
    { icon: 'star', glow: 'rgba(235,90,155,.45)', bg: 'linear-gradient(150deg,#f68cc0,#eb5a9b)', name: '书摘收藏', sub: '读到好句子发给它,按书和主题归档' },
];

const HOW = [
    ['在对话里告诉 one ', '你想管理什么', ',比如「帮我做一个记账本」。'],
    ['它会建好', '数据表和界面', ',新应用出现在九宫格里。'],
    ['之后随时在对话里让它', '记录、查询、汇总', ',或者进应用里自己看。'],
];
</script>

<template>
    <div class="app">
        <TopBar back title="创建应用" />

        <main class="page">
            <div class="page-inner">
                <div class="hero">
                    <div class="hero-tile"><Icon name="plus" style="width:30px;height:30px" /></div>
                    <div class="hero-title">组装一个你自己的板块</div>
                    <div class="hero-sub">对话、任务、笔记不够用的时候,用一句话描述你想管理的东西,one 帮你生成一个专属应用:自己的数据表、自己的界面、AI 直接读写。</div>
                </div>

                <div class="demo-label">比如</div>
                <div class="demo-grid">
                    <div v-for="d in DEMOS" :key="d.name" class="card demo">
                        <span class="d-tile" :style="{ '--tile-glow': d.glow, background: d.bg }">
                            <Icon :name="d.icon" style="width:18px;height:18px;color:#fff" />
                        </span>
                        <div class="d-name">{{ d.name }}</div>
                        <div class="d-sub">{{ d.sub }}</div>
                    </div>
                </div>

                <div class="demo-label">怎么做</div>
                <div class="card how">
                    <div v-for="(h, i) in HOW" :key="i" class="how-row">
                        <span class="how-no">{{ i + 1 }}</span>
                        <span class="how-text">{{ h[0] }}<b>{{ h[1] }}</b>{{ h[2] }}</span>
                    </div>
                </div>

                <div class="cta">
                    <router-link class="btn btn-primary" to="/chat" style="text-decoration:none">去对话里说一句</router-link>
                </div>
            </div>
        </main>
    </div>
</template>

<style scoped>
.hero { text-align: center; padding: 34px 20px 26px; }
.hero-tile { width: 72px; height: 72px; border-radius: 24px; margin: 0 auto 16px;
    display: grid; place-items: center;
    border: 2px dashed var(--line); color: var(--ink-4);
    background: rgba(255,255,255,.7); }
.hero-tile :deep(svg) { width: 30px; height: 30px; }
.hero-title { font-size: 18px; font-weight: 800; }
.hero-sub { margin: 8px auto 0; max-width: 400px; font-size: 13px; line-height: 1.8; color: var(--ink2); }

.demo-label { margin: 22px 2px 10px; font-size: 12px; font-weight: 800; color: var(--ink-3); letter-spacing: .05em;
    display: flex; align-items: center; gap: 8px; }
.demo-label::after { content: ""; flex: 1; height: 1px; background: var(--line); }
.demo-grid { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 10px; }
.demo { padding: 15px 16px; }
.demo .d-tile { width: 38px; height: 38px; border-radius: 12px; display: grid; place-items: center; color: #fff;
    box-shadow: var(--gloss), 0 4px 10px -3px var(--tile-glow, rgba(48,88,140,.35)); }
.demo .d-tile :deep(svg) { width: 18px; height: 18px; }
.demo .d-name { margin-top: 10px; font-size: 13.5px; font-weight: 700; }
.demo .d-sub { margin-top: 4px; font-size: 11.5px; line-height: 1.65; color: var(--ink-3); }

.how { margin-top: 14px; padding: 16px 18px; }
.how-row { display: flex; gap: 11px; padding: 9px 0; align-items: flex-start; }
.how-no { flex-shrink: 0; width: 22px; height: 22px; border-radius: 99px; margin-top: 1px;
    display: grid; place-items: center;
    background: var(--candy-soft); color: var(--candy-deep);
    font-size: 11.5px; font-weight: 800; }
.how-text { font-size: 13px; line-height: 1.7; color: var(--ink2); }
.how-text b { color: var(--ink); font-weight: 700; }

.cta { margin-top: 20px; display: flex; justify-content: center; }
@media (max-width: 640px) { .demo-grid { grid-template-columns: 1fr; } }
</style>
