import { createApp } from 'vue';
import { createPinia } from 'pinia';
import App from './App.vue';
import { router } from './router';
import { login, getToken } from '@/system/api';
import './style.css';

// 挂载前应用主题，避免谧夜首屏先闪成亮色。
try {
    if (localStorage.getItem('one-theme') === 'night') {
        document.documentElement.dataset.theme = 'night';
        document.documentElement.style.colorScheme = 'dark';
    } else {
        document.documentElement.style.colorScheme = 'light';
    }
} catch {}

// 桌面 / 安卓原生壳跳进来会带 #auth=<访问密码>。必须赶在 vue-router 之前把它兑换成 token ——
// 否则路由重定向(/ → /chat → /guard)会先抹掉 hash,GuardView 再读就读不到,
// 表现为「桌面填过密码、进网页还要再输一次口令」。这里读一次、立刻清掉、静默登录。
async function consumeAuthHash() {
    const m = location.hash.match(/(?:^|[#&])auth=([^&]*)/);
    if (!m) return;
    history.replaceState(null, '', location.pathname + location.search); // 密码不留在地址栏/历史
    if (getToken()) return;                                              // 已登录就不必再换
    try { await login(decodeURIComponent(m[1])); } catch { /* 口令错/未初始化 → 照常落登录门 */ }
}

consumeAuthHash().finally(() => {
    createApp(App).use(createPinia()).use(router).mount('#app');
});
