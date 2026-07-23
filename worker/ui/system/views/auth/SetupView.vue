<script setup>
import { ref } from 'vue';
import { useRouter } from 'vue-router';
import { setup } from '@/system/api';
import { useWsStore } from '@/system/stores/ws';

const router = useRouter();
const ws = useWsStore();
const password = ref('');
const confirm = ref('');
const error = ref('');
const busy = ref(false);

async function onSubmit() {
    if (busy.value) return;
    error.value = '';
    if (!password.value.trim()) { error.value = '请设置一个密码'; return; }
    if (password.value !== confirm.value) { error.value = '两次输入不一致'; return; }
    busy.value = true;
    try {
        await setup(password.value);
        ws.start();
        router.replace('/chat');
    } catch (e) {
        error.value = e.message || '设置失败';
    } finally {
        busy.value = false;
    }
}
</script>

<template>
    <!-- 复用 GuardView 定义的 .gate-* 视觉(居中卡片) -->
    <div class="gate">
        <form class="gate-box" @submit.prevent="onSubmit">
            <div class="card gate-card">
                <div class="gate-brand">1</div>
                <div class="gate-title">one</div>
                <div class="gate-sub">首次使用 · 先设一个访问口令</div>
                <input
                    v-model="password"
                    class="input gate-input"
                    type="password"
                    autocomplete="new-password"
                    placeholder="设置口令"
                    autofocus
                />
                <input
                    v-model="confirm"
                    class="input gate-input"
                    type="password"
                    autocomplete="new-password"
                    placeholder="再输一遍"
                />
                <div v-if="error" class="gate-error">{{ error }}</div>
                <button type="submit" class="btn btn-primary gate-btn" :disabled="busy">
                    {{ busy ? '设置中…' : '创建并进入' }}
                </button>
            </div>
            <div class="gate-foot">一人一账户 · 数据全部在你自己的 Cloudflare 上</div>
        </form>
    </div>
</template>

<style>
/* 与 GuardView 同一套 .gate-* 视觉;路由懒加载,两页各带一份同名规则保证独立可用 */
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
    background: var(--candy);
    color: var(--on-accent); font-weight: 800; font-size: 26px;
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
