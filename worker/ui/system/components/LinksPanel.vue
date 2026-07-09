<script setup>
// 设备面板:顶栏闪电按钮(带在线数 badge)→ 设备列表弹层。
// 整卡可点进设备详情 /devices/<name>;底部虚线「添加设备」→ /devices/new。
import { ref } from 'vue';
import { useRouter } from 'vue-router';
import { useWsStore } from '@/system/stores/ws';
import Icon from './Icon.vue';

// 本机客户端桥(桌面 Tauri / 安卓 OneNative):存在即显示「本机设置」——不依赖设备是否在线,是配置错误时的逃生口
const hasNative = Boolean(window.__TAURI__ || window.OneNative);
function openNative() {
    if (window.OneNative?.openSettings) return window.OneNative.openSettings();
    if (window.__TAURI__) return window.__TAURI__.core.invoke('open_settings').catch(() => {});
}

const ws = useWsStore();
const router = useRouter();

const open = ref(false);
const btnRef = ref(null);
const popStyle = ref({});

// kind → 图标 / 副标
const KIND_ICON = { desktop: 'laptop', android: 'phone', browser: 'puzzle' };
const KIND_LABEL = { desktop: '桌面', android: '安卓', browser: '浏览器' };

function toggle() {
    if (!open.value && btnRef.value) {
        const r = btnRef.value.getBoundingClientRect();
        popStyle.value = { top: `${r.bottom + 10}px`, right: `${window.innerWidth - r.right}px` };
    }
    open.value = !open.value;
}

function go(path) { open.value = false; router.push(path); }
</script>

<template>
    <div class="relative shrink-0">
        <button ref="btnRef" class="icon-btn candy" title="连接的设备" @click.stop="toggle">
            <Icon name="boltFill" style="width:17px;height:17px" />
            <span v-if="ws.hands.length" class="badge">{{ ws.hands.length }}</span>
        </button>

        <Teleport to="body">
            <div v-if="open" class="pop-mask" @click="open = false"></div>
            <div v-if="open" class="pop" :style="popStyle">
                <div class="pop-title">设备 · {{ ws.hands.length }} 在线</div>

                <div v-if="!ws.hands.length" style="padding:4px 10px 12px;font-size:12.5px;line-height:1.7;color:var(--ink2)">
                    还没有设备连接。<br />打开桌面 / 手机的 One,填主域名 + 密码即可。
                </div>

                <template v-else>
                    <a
                        v-for="(h, i) in ws.hands" :key="i"
                        class="dev-card" style="display:block;cursor:pointer"
                        @click="go(`/devices/${encodeURIComponent(h.name || '设备')}`)"
                    >
                        <div class="dev-head">
                            <span class="dev-ico"><Icon :name="KIND_ICON[h.kind] || 'puzzle'" style="width:17px;height:17px" /></span>
                            <span class="grow">
                                <span class="dev-name">{{ h.name || '设备' }}</span>
                                <div class="dev-sub">{{ KIND_LABEL[h.kind] || h.kind }}</div>
                            </span>
                            <span class="dev-state on"></span>
                        </div>
                    </a>
                </template>

                <a v-if="hasNative" class="dev-add" style="cursor:pointer" @click="openNative()">
                    <Icon name="settings" style="width:14px;height:14px" />本机设置
                </a>
                <a class="dev-add" style="cursor:pointer" @click="go('/devices/new')">
                    <Icon name="plus" style="width:15px;height:15px" />添加设备
                </a>
            </div>
        </Teleport>
    </div>
</template>

<style scoped>
.dev-card {
    border-radius: 15px;
    background: var(--panel);
    box-shadow: var(--shadow-s);
    border: 1px solid var(--line-soft);
    overflow: hidden;
}
.dev-card + .dev-card { margin-top: 8px; }
a.dev-card {
    transition: transform .18s var(--spring), box-shadow .18s;
}
a.dev-card:hover {
    transform: translateY(-1px);
    box-shadow: var(--shadow-m);
}
a.dev-card .dev-head { padding: 10px 12px; }
.dev-head {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 10px 12px 8px;
}
.dev-ico {
    width: 32px;
    height: 32px;
    border-radius: 10px;
    display: grid;
    place-items: center;
    background: var(--well);
    color: var(--ink2);
}
.dev-name {
    flex: 1;
    min-width: 0;
    font-size: 13px;
    font-weight: 700;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
}
.dev-sub {
    font-size: 10.5px;
    color: var(--ink-3);
    font-weight: 500;
    margin-top: 1px;
}
.dev-state {
    width: 8px;
    height: 8px;
    border-radius: 99px;
    flex-shrink: 0;
}
.dev-state.on {
    background: var(--ok);
    box-shadow: 0 0 6px rgba(38,181,115,.7);
}
.dev-add {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
    margin-top: 8px;
    height: 40px;
    border: 1.5px dashed var(--line);
    border-radius: 15px;
    color: var(--ink-3);
    font-size: 12.5px;
    font-weight: 700;
    text-decoration: none;
    transition: all .15s;
}
.dev-add:hover {
    border-color: var(--candy);
    color: var(--candy-deep);
    background: var(--candy-soft);
}
</style>
