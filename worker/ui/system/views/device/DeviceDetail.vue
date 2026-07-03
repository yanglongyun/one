<script setup>
// 设备详情(demo device-detail.html 的 Vue 移植)。
// 设备信息从 ws.hands 按路由 :name 匹配;找不到则显示离线态。
import { computed } from 'vue';
import { useRoute } from 'vue-router';
import TopBar from '@/system/components/TopBar.vue';
import Icon from '@/system/components/Icon.vue';
import { useWsStore } from '@/system/stores/ws';

const route = useRoute();
const ws = useWsStore();

const KIND_ICON = { desktop: 'laptop', android: 'phone', browser: 'puzzle' };
const KIND_LABEL = { desktop: '桌面', android: '安卓', browser: '浏览器' };
const CAP_META = {
    shell: { icon: 'bolt', label: '终端' },
    files: { icon: 'folder', label: '文件' },
    status: { icon: 'gauge', label: '状态' },
    screen: { icon: 'hand', label: '屏幕操控' },
    vision: { icon: 'eye', label: '截屏理解' },
};

const name = computed(() => decodeURIComponent(String(route.params.name || '')));
const hand = computed(() => ws.hands.find((h) => (h.name || '设备') === name.value) || null);
const online = computed(() => !!hand.value);
const kindIcon = computed(() => KIND_ICON[hand.value?.kind] || 'laptop');
const kindLabel = computed(() => (hand.value ? (KIND_LABEL[hand.value.kind] || hand.value.kind) : '未知设备'));
const caps = computed(() => (hand.value?.caps || []).map((c) => CAP_META[c] || { icon: 'link', label: c }));
// 功能入口按设备实际能力显示(桌面才有 files/status,安卓/插件没有)
const hasFiles = computed(() => (hand.value?.caps || []).includes('files'));
const hasStatus = computed(() => (hand.value?.caps || []).includes('status'));

// 本机识别:页面跑在客户端壳里(Tauri/OneNative 桥存在)且查看的正是这台设备 → 显示本机设置入口
import { ref, onMounted } from 'vue';
const selfName = ref('');
onMounted(async () => {
    try {
        if (window.OneNative?.deviceName) selfName.value = String(window.OneNative.deviceName() || '');
        else if (window.__TAURI__) selfName.value = String((await window.__TAURI__.core.invoke('app_state'))?.name || '');
    } catch { /* 非壳环境 */ }
});
const isSelf = computed(() => selfName.value && selfName.value === name.value);
function openNative() {
    if (window.OneNative?.openSettings) return window.OneNative.openSettings();
    if (window.__TAURI__) return window.__TAURI__.core.invoke('open_settings').catch(() => {});
}
</script>

<template>
    <div class="app">
        <TopBar back title="设备" />

        <main class="page">
            <div class="page-inner">
                <!-- 设备卡 -->
                <div class="card dev-overview" :style="online ? '' : 'opacity:.75'">
                    <div class="row gap-3">
                        <span class="dev-big"><Icon :name="kindIcon" style="width:26px;height:26px" /></span>
                        <span class="grow">
                            <div class="name-row">
                                <span class="dev-title ellipsis">{{ name || '设备' }}</span>
                            </div>
                            <div class="meta" style="margin-top:2px">
                                <span>{{ kindLabel }}</span><span class="sep"></span>
                                <span v-if="online" style="color:#169060;font-weight:600">在线</span>
                                <span v-else style="color:var(--ink-3);font-weight:600">离线</span>
                            </div>
                        </span>
                    </div>
                    <div class="dev-rows">
                        <div class="dev-row">
                            <span class="k">能力</span>
                            <span class="v">
                                <template v-if="caps.length">
                                    <span v-for="c in caps" :key="c.label" class="cap">
                                        <Icon :name="c.icon" style="width:12px;height:12px" />{{ c.label }}
                                    </span>
                                </template>
                                <span v-else class="muted" style="font-weight:500">{{ online ? '未上报' : '设备不在线,无法查看' }}</span>
                            </span>
                        </div>
                        <div class="dev-row">
                            <span class="k">连接</span>
                            <span class="v">{{ online ? '当前在线' : '当前离线,连上后自动恢复' }}</span>
                        </div>
                    </div>
                </div>

                <!-- 本机:客户端自己的设置(连接/保活/权限) -->
                <div v-if="isSelf" class="card dev-overview" style="margin-top:14px;padding:14px 18px">
                    <div class="row gap-3">
                        <span class="grow">
                            <span style="font-size:13.5px;font-weight:700">本机客户端</span>
                            <div class="meta" style="margin-top:3px"><span>你正在这台设备上使用 one · 服务地址、设备名、保活与权限</span></div>
                        </span>
                        <button class="btn btn-plain" @click="openNative">打开本机设置</button>
                    </div>
                </div>

                <!-- 电脑能力入口(按能力显示) -->
                <div v-if="hasFiles || hasStatus" class="entry-grid">
                    <router-link v-if="hasFiles" class="card hoverable entry" :to="`/devices/${encodeURIComponent(name)}/files`">
                        <span class="e-ico" style="--tile-glow:rgba(243,138,29,.45);background:linear-gradient(150deg,#ffb648,#f38a1d)">
                            <Icon name="folder" style="width:18px;height:18px;color:#fff" />
                        </span>
                        <span>
                            <div class="e-title">文件</div>
                            <div class="e-sub">只读浏览这台设备的文件</div>
                        </span>
                        <span class="go"><Icon name="back" style="width:15px;height:15px" /></span>
                    </router-link>
                    <router-link v-if="hasStatus" class="card hoverable entry" :to="`/devices/${encodeURIComponent(name)}/status`">
                        <span class="e-ico" style="--tile-glow:rgba(47,136,232,.45);background:linear-gradient(150deg,#61b3fa,#2f88e8)">
                            <Icon name="gauge" style="width:18px;height:18px;color:#fff" />
                        </span>
                        <span>
                            <div class="e-title">状态</div>
                            <div class="e-sub">CPU · 内存 · 磁盘 · 网络</div>
                        </span>
                        <span class="go"><Icon name="back" style="width:15px;height:15px" /></span>
                    </router-link>
                </div>
            </div>
        </main>
    </div>
</template>

<style scoped>
.dev-overview { padding: 18px; }
.dev-big {
    width: 52px; height: 52px; border-radius: 17px; flex-shrink: 0;
    display: grid; place-items: center;
    background: var(--well); color: var(--ink2);
}
.name-row { display: flex; align-items: center; gap: 8px; }
.dev-title { font-size: 16px; font-weight: 700; color: var(--ink); }
.dev-rows { margin-top: 14px; display: flex; flex-direction: column; }
.dev-row { display: flex; align-items: center; gap: 10px; padding: 10px 2px;
    border-top: 1px solid var(--line-soft); font-size: 13px; }
.dev-row .k { color: var(--ink-3); font-weight: 600; width: 64px; flex-shrink: 0; }
.dev-row .v { flex: 1; min-width: 0; font-weight: 600; display: flex; align-items: center; gap: 6px; flex-wrap: wrap; }
.cap { display: inline-flex; align-items: center; gap: 4px; height: 24px; padding: 0 10px;
    border-radius: 99px; background: var(--well); color: var(--ink2);
    font-size: 11.5px; font-weight: 600; }

.entry-grid { margin-top: 14px; display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
.entry { display: flex; align-items: center; gap: 12px; padding: 14px 16px; text-decoration: none; color: inherit; }
.entry .e-ico { width: 38px; height: 38px; border-radius: 12px; display: grid; place-items: center; color: #fff; flex-shrink: 0;
    box-shadow: var(--gloss), 0 4px 10px -3px var(--tile-glow, rgba(48,88,140,.35)); }
.entry .e-title { font-size: 13.5px; font-weight: 700; }
.entry .e-sub { font-size: 11.5px; color: var(--ink-3); font-weight: 500; margin-top: 2px; }
.entry .go { margin-left: auto; width: 15px; height: 15px; color: var(--ink-4); transform: scaleX(-1); flex-shrink: 0; }
@media (max-width: 640px) { .entry-grid { grid-template-columns: 1fr; } }
</style>
