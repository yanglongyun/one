<script setup>
import { ref } from 'vue';
import { useRouter } from 'vue-router';
import { login } from '@/system/api';
import { useWsStore } from '@/system/stores/ws';

const router = useRouter();
const ws = useWsStore();
const password = ref('');
const error = ref('');
const busy = ref(false);

// 注:桌面/安卓壳带来的 #auth=<密码> 自动登录在 main.js 里更早处理(赶在路由抹掉 hash 之前),
// 所以这里只管手动输入这条路径。
async function onSubmit() {
    if (busy.value) return;
    busy.value = true;
    error.value = '';
    try {
        await login(password.value);
        ws.start();
        router.replace('/chat');
    } catch (e) {
        error.value = e.message || '登录失败';
    } finally {
        busy.value = false;
    }
}
</script>

<template>
    <div class="gate">
        <form class="gate-box" @submit.prevent="onSubmit">
            <div class="card gate-card">
                <div class="gate-brand">1</div>
                <div class="gate-title">one</div>
                <div class="gate-sub">云端常驻的个人 AI</div>
                <input
                    v-model="password"
                    class="input gate-input"
                    type="password"
                    autocomplete="current-password"
                    placeholder="访问口令"
                    autofocus
                />
                <div v-if="error" class="gate-error">{{ error }}</div>
                <button type="submit" class="btn btn-primary gate-btn" :disabled="busy">
                    {{ busy ? '登录中…' : '进入' }}
                </button>
            </div>
            <div class="gate-foot">一人一账户 · 数据全部在你自己的 Cloudflare 上</div>
        </form>
    </div>
</template>

<style>
/* 登录门(晴空软糖)—— 居中糖果卡。Setup 页共用这套 .gate-* 类 */
.gate { min-height: 100dvh; display: grid; place-items: center; padding: 20px; }
.gate-box { animation: gate-rise .55s var(--spring) both; }
@keyframes gate-rise {
    from { opacity: 0; transform: translateY(16px) scale(.97); }
    to   { opacity: 1; transform: translateY(0) scale(1); }
}
.gate-card {
    width: 360px; max-width: 100%;
    padding: 34px 30px 28px;
    text-align: center;
}
.gate-brand {
    width: 56px; height: 56px; border-radius: 18px;
    margin: 0 auto 14px;
    display: grid; place-items: center;
    background: linear-gradient(150deg, #62b4fa, var(--candy-deep));
    color: #fff; font-weight: 800; font-size: 26px;
    box-shadow: var(--gloss), 0 8px 20px -4px rgba(43, 134, 228, .5);
}
.gate-title { font-size: 20px; font-weight: 800; letter-spacing: .01em; }
.gate-sub { margin-top: 4px; font-size: 13px; color: var(--ink-3); font-weight: 500; }
.gate-input {
    margin-top: 22px;
    width: 100%;
    height: 46px; border-radius: 14px;
    padding: 0 15px;
    font-size: 14px;
    text-align: center;
}
.gate-input + .gate-input { margin-top: 10px; }
.gate-error {
    margin-top: 12px;
    padding: 9px 12px;
    border-radius: 12px;
    background: var(--bad-soft); color: var(--bad);
    font-size: 12.5px; font-weight: 600;
}
.gate-btn {
    margin-top: 12px;
    width: 100%; height: 44px; border-radius: 14px;
    justify-content: center;
    font-size: 14px;
}
.gate-foot { margin-top: 16px; text-align: center; font-size: 12px; color: var(--ink-3); font-weight: 500; }
</style>
