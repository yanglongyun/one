<script setup>
// 添加设备(demo device-add.html 的 Vue 移植)。服务地址显示当前 origin,复制按钮真复制。
import { onMounted, ref } from 'vue';
import { api } from '@/system/api';
import TopBar from '@/system/components/TopBar.vue';
import Icon from '@/system/components/Icon.vue';

const origin = window.location.origin;

const platforms = ref([
    { platform: 'macos', icon: 'laptop', name: '桌面(macOS)', sub: '终端、屏幕操控、文件、状态', btn: '下载 .dmg' },
    { platform: 'windows', icon: 'laptop', name: '桌面(Windows)', sub: '终端、屏幕操控、文件、状态', btn: '下载 .exe' },
    { platform: 'android', icon: 'phone', name: '安卓', sub: '语义读屏、点击、输入、状态', btn: '下载 .apk' },
    { platform: 'browser', icon: 'puzzle', name: '浏览器', sub: '操控网页、抓取内容', btn: '下载扩展' },
]);

onMounted(async () => {
    try {
        const manifest = await api.get('/api/downloads');
        const releases = new Map((manifest.releases || []).map((release) => [release.platform, release]));
        platforms.value = platforms.value.map((platform) => ({ ...platform, ...releases.get(platform.platform) }));
    } catch {
        platforms.value = platforms.value.map((platform) => ({ ...platform, available: false }));
    }
});

const copied = ref(false);
async function copyOrigin() {
    try {
        await navigator.clipboard.writeText(origin);
    } catch {
        // 剪贴板 API 不可用时兜底
        const ta = document.createElement('textarea');
        ta.value = origin; document.body.appendChild(ta);
        ta.select(); document.execCommand('copy'); ta.remove();
    }
    copied.value = true;
    setTimeout(() => { copied.value = false; }, 1200);
}
</script>

<template>
    <div class="app">
        <TopBar back title="添加设备" />

        <main class="page">
            <div class="page-inner">
                <div class="step">
                    <span class="step-no">1</span>
                    <div class="card step-card">
                        <div class="step-title">在要连接的设备上安装 one</div>
                        <div v-for="p in platforms" :key="p.platform" class="plat">
                            <span class="plat-ico"><Icon :name="p.icon" style="width:17px;height:17px" /></span>
                            <span class="grow">
                                <div class="plat-name">{{ p.name }}</div>
                                <div class="plat-sub">{{ p.sub }}</div>
                            </span>
                            <a v-if="p.available" class="btn btn-plain" :href="p.url" download>{{ p.btn }}</a>
                            <span v-else class="not-ready">即将提供</span>
                        </div>
                    </div>
                </div>

                <div class="step">
                    <span class="step-no">2</span>
                    <div class="card step-card">
                        <div class="step-title">打开后填入连接信息</div>
                        <div class="conn">
                            <span class="k">服务地址</span>
                            <span class="v">{{ origin }}</span>
                            <button class="copy-btn" @click="copyOrigin">{{ copied ? '已复制' : '复制' }}</button>
                        </div>
                    </div>
                </div>

                <div class="step">
                    <span class="step-no">3</span>
                    <div class="card step-card">
                        <div class="step-title">完成</div>
                        <div class="step-sub">连接成功后,这台设备会出现在右上角的设备列表里,one 就可以指挥它干活了。</div>
                    </div>
                </div>
            </div>
        </main>
    </div>
</template>

<style scoped>
.step { display: flex; gap: 14px; }
.step + .step { margin-top: 12px; }
.step-no {
    flex-shrink: 0;
    width: 30px; height: 30px; border-radius: 99px;
    display: grid; place-items: center;
    background: var(--candy);
    color: var(--on-accent); font-size: 13px; font-weight: 800;
    margin-top: 16px;
}
.step-card { flex: 1; min-width: 0; padding: 16px 18px; }
.step-title { font-size: 14px; font-weight: 700; }
.step-sub { margin-top: 4px; font-size: 12.5px; line-height: 1.7; color: var(--ink2); }

.plat { display: flex; align-items: center; gap: 11px; padding: 11px 2px; border-top: 1px solid var(--line-soft); }
.plat:first-of-type { border-top: 0; margin-top: 4px; }
.plat-ico { width: 34px; height: 34px; border-radius: 11px; display: grid; place-items: center;
    background: var(--well); color: var(--ink2); flex-shrink: 0; }
.plat-name { font-size: 13px; font-weight: 700; }
.plat-sub { font-size: 11.5px; color: var(--ink-3); font-weight: 500; margin-top: 1px; }
.plat .btn { margin-left: auto; height: 30px; padding: 0 13px; font-size: 12px; }
.not-ready { margin-left: auto; color: var(--ink-4); font-size: 12px; font-weight: 700; }

.conn { display: flex; align-items: center; gap: 8px; margin-top: 9px;
    background: var(--code); border-radius: 12px; padding: 10px 13px; }
.conn .k { font-size: 11px; font-weight: 700; color: var(--ink-3); width: 60px; flex-shrink: 0; }
.conn .v { flex: 1; min-width: 0; font-family: var(--mono); font-size: 12px; color: var(--ink2);
    white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.copy-btn { flex-shrink: 0; font-size: 11.5px; font-weight: 700; color: var(--candy-deep);
    padding: 4px 10px; border-radius: 8px; transition: background .15s; }
.copy-btn:hover { background: var(--candy-soft); }
</style>
