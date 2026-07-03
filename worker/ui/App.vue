<script setup>
import { onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { useWsStore } from '@/system/stores/ws';
import { getToken, setToken, getState, api } from '@/system/api';
import ToastHost from '@/system/components/ToastHost.vue';

const ws = useWsStore();
const router = useRouter();

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
    <router-view v-slot="{ Component }">
        <keep-alive>
            <component :is="Component" />
        </keep-alive>
    </router-view>

    <ToastHost />
</template>
