<script setup>
import { computed, onMounted } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useWsStore } from '@/system/stores/ws';
import { getToken, setToken, getState, api } from '@/system/api';
import ToastHost from '@/system/components/ToastHost.vue';
import ConfirmHost from '@/system/components/ConfirmHost.vue';
import Sidebar from '@/system/components/Sidebar.vue';

const ws = useWsStore();
const route = useRoute();
const router = useRouter();

// 登录/初始化页不带侧栏,其余页面统一左右布局
const showSidebar = computed(() => !route.meta?.public);

onMounted(async () => {
    // 先看系统是否已初始化(DB 里有没有密码)。未初始化 → 强制去设密码,
    // 并清掉可能残留的旧 token(JWT 无状态,清库后旧 token 仍能验签,不先查会直接放行)。
    let hasPassword = true;
    try { ({ hasPassword } = await getState()); } catch { /* 网络异常:保守走既有 token 逻辑 */ }
    if (!hasPassword) { setToken(''); router.replace('/setup'); return; }

    if (getToken()) {
        try { await api.get('/api'); ws.start(); return; } // token 有效 → 连
        catch { setToken(''); }                              // 失效 → 落到登录
    }
    router.replace('/guard');
});
</script>

<template>
    <div class="shell">
        <Sidebar v-if="showSidebar" />
        <div class="shell-main">
            <router-view v-slot="{ Component }">
                <keep-alive>
                    <component :is="Component" />
                </keep-alive>
            </router-view>
        </div>
    </div>

    <ToastHost />
    <ConfirmHost />
</template>

<style scoped>
.shell { flex: 1; min-height: 0; display: flex; }
.shell-main { flex: 1; min-width: 0; display: flex; flex-direction: column; }
</style>
