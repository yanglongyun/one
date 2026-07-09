<script setup>
// 状态 · 晴空软糖皮肤(demo device-status.html)。
// 数据逻辑不变:status.request / status.result 轮询(5s),字段 cpu/mem/disk/host/network。
// sparkline 历史用最近 N 次采样在前端积累。
import { computed, onMounted, onUnmounted, ref, watch } from 'vue';
import { useRoute } from 'vue-router';
import { useWsStore } from '@/system/stores/ws';
import TopBar from '@/system/components/TopBar.vue';
import Icon from '@/system/components/Icon.vue';

const ws = useWsStore();
const route = useRoute();
const dev = computed(() => route.params.dev);          // 这台设备的 id(/devices/:dev/status)
const self = computed(() => ws.hands.find((h) => h.name === dev.value) || null);

const snap = ref(null);
const pending = new Map();
let seq = 0;
let timer = null;

const online = computed(() => Boolean(self.value)); // 这台设备在线才算
const d = computed(() => snap.value);

// ── CPU 走势:最近 N 次采样在前端积累 ──
const MAX_HIST = 30;
const cpuHist = ref([]);

function request() {
    if (!ws.connected || !online.value) return;
    const reqId = `h${Date.now()}_${seq++}`;
    pending.set(reqId, 1);
    ws.sendMsg({ type: 'status.request', to: dev.value, data: { reqId } }); // 定向投给这台
}

function fmtBytes(n) {
    if (!Number.isFinite(Number(n)) || n <= 0) return '—';
    const u = ['B', 'KB', 'MB', 'GB', 'TB'];
    let v = Number(n), i = 0;
    while (v >= 1024 && i < u.length - 1) { v /= 1024; i++; }
    return `${v.toFixed(v >= 100 ? 0 : v >= 10 ? 1 : 1)} ${u[i]}`;
}
function fmtUptime(s) {
    const t = Number(s) || 0;
    const dd = Math.floor(t / 86400), h = Math.floor((t % 86400) / 3600), m = Math.floor((t % 3600) / 60);
    const p = [];
    if (dd) p.push(`${dd} 天`);
    if (h) p.push(`${h} 小时`);
    if (m || (!dd && !h)) p.push(`${m} 分`);
    return p.join(' ');
}
const pct = (n) => Math.round((Number(n) || 0) * 10) / 10;

// 折线点(viewBox 0 0 200 48;不足两点时画一条平线)
const cpuPoints = computed(() => {
    let hist = cpuHist.value;
    if (hist.length < 2) hist = [hist[0] ?? 0, hist[0] ?? 0];
    const n = hist.length;
    return hist.map((v, i) => {
        const x = (i / (n - 1)) * 200;
        const y = 45 - (Math.min(100, Math.max(0, v)) / 100) * 42;
        return `${x.toFixed(1)},${y.toFixed(1)}`;
    }).join(' ');
});
const cpuArea = computed(() => `${cpuPoints.value} 200,48 0,48`);

onMounted(() => {
    ws.onMessage('status.result', (msg) => {
        const m = msg.data || {};
        if (m.reqId && pending.has(m.reqId)) {
            pending.delete(m.reqId);
            if (m.ok) {
                snap.value = m;
                cpuHist.value = [...cpuHist.value, pct(m.cpu?.usagePercent)].slice(-MAX_HIST);
            }
        }
    });
    request();
    timer = setInterval(request, 5000);
});
onUnmounted(() => clearInterval(timer));

// 切换设备(/devices/:dev 变了)→ 清空旧快照、重新拉
watch(dev, () => { snap.value = null; cpuHist.value = []; request(); });
</script>

<template>
    <div class="app">
        <TopBar :back="'/devices/' + encodeURIComponent(dev)" title="状态" :subtitle="dev">
            <template #actions>
                <span v-if="online" class="pill pill-ok"><i></i>实时</span>
            </template>
        </TopBar>

        <main class="page">
            <div class="page-inner">
                <div v-if="!online" class="empty">
                    <div class="empty-art"><Icon name="gauge" style="width:34px;height:34px" /></div>
                    <div class="empty-title">设备不在线</div>
                    <div class="empty-sub">「{{ dev }}」上线后就能看到它的实时状态。打开这台设备上的 One,连到本账户即可。</div>
                </div>

                <div v-else-if="!d" class="empty">
                    <div class="empty-art"><Icon name="gauge" style="width:34px;height:34px" /></div>
                    <div class="empty-title">读取本机状态…</div>
                </div>

                <template v-else>
                    <div class="stats">
                        <!-- CPU -->
                        <div class="card stat">
                            <span class="s-label"><Icon name="gauge" style="width:13px;height:13px" />CPU</span>
                            <div class="s-num mono">{{ pct(d.cpu?.usagePercent) }}<span class="unit">%</span></div>
                            <div class="s-sub ellipsis" :title="d.cpu?.model">{{ d.cpu?.count || '—' }} 核 · {{ d.cpu?.model || '—' }}</div>
                            <svg class="spark" viewBox="0 0 200 48" preserveAspectRatio="none">
                                <defs>
                                    <linearGradient id="cpu-fill" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="0" style="stop-color:var(--candy);stop-opacity:.22"/>
                                        <stop offset="1" style="stop-color:var(--candy);stop-opacity:0"/>
                                    </linearGradient>
                                </defs>
                                <polygon fill="url(#cpu-fill)" stroke="none" :points="cpuArea"/>
                                <polyline fill="none" stroke="var(--candy)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" vector-effect="non-scaling-stroke" :points="cpuPoints"/>
                            </svg>
                        </div>

                        <!-- 内存 -->
                        <div class="card stat">
                            <span class="s-label">
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="6" y="6" width="12" height="12" rx="2.5"/><rect x="10" y="10" width="4" height="4" rx="1"/><path d="M9 3.5V6M15 3.5V6M9 18v2.5M15 18v2.5M3.5 9H6M3.5 15H6M18 9h2.5M18 15h2.5"/></svg>
                                内存
                            </span>
                            <div class="s-num"><span class="mono">{{ fmtBytes(d.mem?.used) }}</span> <span class="of mono">/ {{ fmtBytes(d.mem?.total) }}</span></div>
                            <div class="bar bar-mem"><i :style="{ width: `${Math.min(100, pct(d.mem?.percent))}%` }"></i></div>
                            <div class="s-sub">空闲 <span class="mono">{{ fmtBytes(d.mem?.free) }}</span> · 已用 <span class="mono">{{ pct(d.mem?.percent) }}%</span></div>
                        </div>

                        <!-- 磁盘 -->
                        <div class="card stat">
                            <span class="s-label">
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="3.5" y="7.5" width="17" height="9.5" rx="3"/><path d="M7 12.2h5"/><circle cx="16.6" cy="12.2" r="1" fill="currentColor" stroke="none"/></svg>
                                磁盘<em v-if="d.disk?.mount" class="s-em">{{ d.disk.mount }}</em>
                            </span>
                            <template v-if="d.disk">
                                <div class="s-num"><span class="mono">{{ fmtBytes(d.disk.used) }}</span> <span class="of mono">/ {{ fmtBytes(d.disk.total) }}</span></div>
                                <div class="bar bar-disk"><i :style="{ width: `${Math.min(100, pct(d.disk.percent))}%` }"></i></div>
                                <div class="s-sub">可用 <span class="mono">{{ fmtBytes(d.disk.free) }}</span></div>
                            </template>
                            <div v-else class="s-sub" style="margin-top:10px">暂无磁盘信息</div>
                        </div>

                        <!-- 网络 -->
                        <div class="card stat">
                            <span class="s-label"><Icon name="wifi" style="width:13px;height:13px" />网络</span>
                            <template v-if="d.network?.length">
                                <div v-for="(ifc, i) in d.network" :key="ifc.name + ifc.address"
                                    class="net-row" :style="i === 0 ? 'margin-top:10px' : ''">
                                    <span class="net-arrow" :class="i % 2 ? 'up' : 'down'">
                                        <Icon name="wifi" style="width:13px;height:13px" />
                                    </span>
                                    <span class="net-name">{{ ifc.name }}</span>
                                    <span class="net-addr mono ellipsis">{{ ifc.address }}</span>
                                </div>
                            </template>
                            <div v-else class="s-sub" style="margin-top:10px">暂无网络接口</div>
                        </div>
                    </div>

                    <!-- 主机名 / 运行时长 / 系统 -->
                    <div class="card strip">
                        <div class="cell">
                            <span class="cell-ico"><Icon name="laptop" style="width:17px;height:17px" /></span>
                            <span class="grow">
                                <div class="cell-label">主机名</div>
                                <div class="cell-val ellipsis">{{ d.host?.hostname || '—' }}<span class="dim">{{ d.host?.arch }}</span></div>
                            </span>
                        </div>
                        <div class="cell">
                            <span class="cell-ico"><Icon name="clock" style="width:17px;height:17px" /></span>
                            <span class="grow">
                                <div class="cell-label">运行时长</div>
                                <div class="cell-val mono">{{ fmtUptime(d.host?.uptime) }}</div>
                            </span>
                        </div>
                        <div class="cell">
                            <span class="cell-ico"><Icon name="gauge" style="width:17px;height:17px" /></span>
                            <span class="grow">
                                <div class="cell-label">系统</div>
                                <div class="cell-val ellipsis">{{ d.host?.platform || '—' }} <span class="mono">{{ d.host?.release }}</span></div>
                            </span>
                        </div>
                    </div>
                </template>
            </div>
        </main>
    </div>
</template>

<style scoped>
/* 2×2 统计卡 */
.stats { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
.stat { padding: 16px 18px 15px; display: flex; flex-direction: column; min-width: 0; }
.s-label {
    display: flex; align-items: center; gap: 6px;
    font-size: 11px; font-weight: 800; letter-spacing: .05em;
    color: var(--ink-3);
}
.s-label svg { width: 13px; height: 13px; }
.s-em { font-size: 10.5px; font-weight: 600; font-style: normal; color: var(--ink-4); margin-left: 2px; }
.s-num { margin-top: 9px; font-size: 28px; font-weight: 800; line-height: 1.1; letter-spacing: -.01em; }
.s-num .unit { font-size: 15px; font-weight: 700; color: var(--ink-3); margin-left: 2px; }
.s-num .of { font-size: 14px; font-weight: 700; color: var(--ink-3); }
.s-sub { margin-top: 6px; font-size: 11.5px; font-weight: 500; color: var(--ink-3); }
.spark { width: 100%; height: 44px; margin-top: 10px; }
.bar { height: 10px; border-radius: 99px; background: var(--well); overflow: hidden; margin-top: 12px; }
.bar i { display: block; height: 100%; border-radius: 99px; box-shadow: var(--gloss); transition: width .5s var(--ease); }
.bar-mem i { background: linear-gradient(90deg, #9d8bfa, #7761ef); }
.bar-disk i { background: linear-gradient(90deg, var(--accent-start), var(--candy-deep)); }

/* 网络卡:接口行 */
.net-row { display: flex; align-items: center; gap: 8px; min-width: 0; }
.net-row + .net-row { margin-top: 8px; }
.net-arrow { width: 22px; height: 22px; border-radius: 8px; display: grid; place-items: center; flex-shrink: 0; }
.net-arrow.down { background: var(--ok-soft); color: var(--ok); }
.net-arrow.up { background: var(--run-soft); color: var(--run); }
.net-name { font-size: 12px; font-weight: 700; white-space: nowrap; flex-shrink: 0; }
.net-addr { flex: 1; min-width: 0; text-align: right; font-size: 12px; color: var(--ink2); }

/* 底部横条 */
.strip { margin-top: 12px; display: grid; grid-template-columns: 1fr 1fr 1fr; padding: 0; }
.strip .cell { display: flex; align-items: center; gap: 12px; padding: 15px 18px; min-width: 0; }
.strip .cell + .cell { border-left: 1px solid var(--line-soft); }
.cell-ico {
    width: 34px; height: 34px; border-radius: 11px; flex-shrink: 0;
    display: grid; place-items: center;
    background: var(--well); color: var(--ink2);
}
.cell-label { font-size: 11px; font-weight: 800; letter-spacing: .05em; color: var(--ink-3); }
.cell-val { margin-top: 3px; font-size: 15px; font-weight: 800; white-space: nowrap; }
.cell-val .dim { font-size: 11.5px; font-weight: 600; color: var(--ink-3); margin-left: 5px; }

@media (max-width: 640px) {
    .stats { grid-template-columns: 1fr; }
    .strip { grid-template-columns: 1fr; }
    .strip .cell + .cell { border-left: 0; border-top: 1px solid var(--line-soft); }
}
</style>
