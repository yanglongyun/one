<script setup>
import { computed, onMounted, reactive, ref, watch } from 'vue';
import { useThemeStore } from '@/system/stores/theme';
import { useModelStore } from '@/apps/settings/store';
import { useWsStore } from '@/system/stores/ws';
import { api, logout } from '@/system/api';
import SettingsHeader from '../components/SettingsHeader.vue';
import Icon from '@/system/components/Icon.vue';

const theme = useThemeStore();
const model = useModelStore();
const ws = useWsStore();

// —— 模型 / 压缩(显式保存) ——
const form = reactive({
    apiUrl: '', apiKey: '', model: '', authMode: 'bearer',
    thinkingEnabled: false, reasoningEffort: '', maxOutputTokens: '',
    compressThreshold: '64000', recentRawMessages: '100', toolResultMaxChars: '12000', toolMaxRounds: '50',
});
const saved = ref(false);
const saving = ref(false);
const showKey = ref(false);
const testingModel = ref(false);
const testResult = ref('');

// —— 顶部分页 tab ——
const tab = ref('model'); // model | advanced | account | appearance

// —— 在线修改访问口令 ——
const pwOpen = ref(false);
const pw = reactive({ current: '', next: '', confirm: '' });
const pwBusy = ref(false);
const pwMsg = ref('');
const pwErr = ref('');
function togglePw() {
    pwOpen.value = !pwOpen.value;
    pwMsg.value = ''; pwErr.value = '';
    if (!pwOpen.value) { pw.current = ''; pw.next = ''; pw.confirm = ''; }
}
async function changePassword() {
    if (pwBusy.value) return;
    pwErr.value = ''; pwMsg.value = '';
    if (pw.next.trim().length < 6) { pwErr.value = '新口令至少 6 位'; return; }
    if (pw.next !== pw.confirm) { pwErr.value = '两次新口令不一致'; return; }
    pwBusy.value = true;
    try {
        const r = await api.post('/api/identity/change-password', { current: pw.current, next: pw.next });
        if (r.ok) {
            pwMsg.value = '口令已更新 · 各设备请改用新口令重连';
            pw.current = ''; pw.next = ''; pw.confirm = '';
            setTimeout(() => { pwOpen.value = false; pwMsg.value = ''; }, 1600);
        } else {
            pwErr.value = r.error || '修改失败';
        }
    } catch (e) {
        pwErr.value = e.message || '修改失败';
    } finally {
        pwBusy.value = false;
    }
}

// 服务器只回掩码,不回明文 key
const keyMasked = computed(() => model.config.keyPreview || (model.config.hasKey ? '已设置' : '未设置'));

const dirty = computed(() =>
    form.apiUrl !== (model.config.apiUrl || '') ||
    form.model !== (model.config.model || '') ||
    form.apiKey.trim().length > 0 ||
    form.authMode !== (model.config.authMode || 'bearer') ||
    form.thinkingEnabled !== Boolean(model.config.thinkingEnabled) ||
    form.reasoningEffort !== (model.config.reasoningEffort || '') ||
    String(form.maxOutputTokens) !== String(model.config.maxOutputTokens || '') ||
    String(form.compressThreshold) !== String(model.config.compressThreshold ?? 64000) ||
    String(form.recentRawMessages) !== String(model.config.recentRawMessages ?? 100) ||
    String(form.toolResultMaxChars) !== String(model.config.toolResultMaxChars ?? 12000) ||
    String(form.toolMaxRounds) !== String(model.config.toolMaxRounds ?? 50)
);

function syncFromServer() {
    const c = model.config;
    form.apiUrl = c.apiUrl || '';
    form.model = c.model || '';
    form.apiKey = ''; // 不回填明文,留空＝不改
    form.authMode = c.authMode || 'bearer';
    form.thinkingEnabled = Boolean(c.thinkingEnabled);
    form.reasoningEffort = c.reasoningEffort || '';
    form.maxOutputTokens = String(c.maxOutputTokens || '');
    form.compressThreshold = String(c.compressThreshold ?? 64000);
    form.recentRawMessages = String(c.recentRawMessages ?? 100);
    form.toolResultMaxChars = String(c.toolResultMaxChars ?? 12000);
    form.toolMaxRounds = String(c.toolMaxRounds ?? 50);
}

async function load() {
    await model.load();
    syncFromServer();
}
async function save() {
    if (!ws.connected || saving.value || !dirty.value) return;
    saving.value = true;
    const patch = {
        apiUrl: String(form.apiUrl).trim(),
        model: String(form.model).trim(),
        authMode: form.authMode,
        thinkingEnabled: form.thinkingEnabled ? '1' : '',
        reasoningEffort: form.reasoningEffort,
        maxOutputTokens: String(form.maxOutputTokens || '').trim(),
        compressThreshold: String(Number(form.compressThreshold) || 64000),
        recentRawMessages: String(Number(form.recentRawMessages) || 100),
        toolResultMaxChars: String(Number(form.toolResultMaxChars) || 12000),
        toolMaxRounds: String(Number(form.toolMaxRounds) || 50),
    };
    if (form.apiKey.trim()) patch.apiKey = form.apiKey.trim();
    try {
        await model.save(patch);
        syncFromServer();
        saved.value = true;
        setTimeout(() => { saved.value = false; }, 1800);
    } finally {
        saving.value = false;
    }
}
function reset() { syncFromServer(); }

function useAgentDefaults() {
    form.compressThreshold = '64000';
    form.recentRawMessages = '100';
    form.toolResultMaxChars = '12000';
    form.toolMaxRounds = '50';
}

async function testConnection() {
    if (testingModel.value) return;
    testingModel.value = true;
    testResult.value = '';
    try {
        const result = await api.post('/api/settings/test', {
            apiUrl: form.apiUrl,
            apiKey: form.apiKey,
            model: form.model,
            authMode: form.authMode,
        });
        testResult.value = result.ok ? '连接成功' : (result.error || '连接失败');
    } catch (error) {
        testResult.value = error.message || '连接失败';
    } finally {
        testingModel.value = false;
    }
}

async function clearKey() {
    await model.save({ clearApiKey: true });
    syncFromServer();
    testResult.value = '密钥已清除';
}

onMounted(load);
watch(() => ws.connected, (v) => { if (v) load(); });
</script>

<template>
    <div class="app">
        <SettingsHeader />
        <main class="page">
            <div class="page-inner">

                <div class="tabs">
                    <button class="tab" :class="{ on: tab === 'model' }" @click="tab = 'model'">模型</button>
                    <button class="tab" :class="{ on: tab === 'advanced' }" @click="tab = 'advanced'">高级</button>
                    <button class="tab" :class="{ on: tab === 'account' }" @click="tab = 'account'">账户</button>
                    <button class="tab" :class="{ on: tab === 'appearance' }" @click="tab = 'appearance'">外观</button>
                </div>

                <!-- 外观页:主题只保存在当前浏览器和设备 -->
                <div v-show="tab === 'appearance'">
                    <div class="card sec">
                        <div class="sec-head">
                            <span class="grow">
                                <span class="sec-title">主题</span>
                            </span>
                        </div>
                        <div class="srow">
                            <span class="grow">
                                <span class="s-label">界面主题</span>
                            </span>
                            <span class="s-ctrl">
                                <span class="seg theme-seg" aria-label="界面主题">
                                    <button class="seg-item" :class="{ on: theme.theme === 'sky' }" @click="theme.setTheme('sky')">
                                        <Icon name="sun" />晴空
                                    </button>
                                    <button class="seg-item" :class="{ on: theme.theme === 'night' }" @click="theme.setTheme('night')">
                                        <Icon name="moon" />谧夜
                                    </button>
                                </span>
                            </span>
                        </div>
                    </div>
                </div>

                <!-- 模型页 -->
                <div v-show="tab === 'model'">

                <!-- ① 主模型 -->
                <div class="card sec">
                    <div class="sec-head">
                        <span class="grow">
                            <span class="sec-title">主模型</span>
                        </span>
                    </div>
                    <div class="srow">
                        <span class="grow">
                            <span class="s-label">接口地址</span>
                        </span>
                        <span class="s-ctrl"><input v-model="form.apiUrl" class="input mono" :disabled="!ws.connected" placeholder="https://api.openai.com/v1/chat/completions" spellcheck="false" autocapitalize="off" /></span>
                    </div>
                    <div class="srow">
                        <span class="grow">
                            <span class="s-label">密钥</span>
                        </span>
                        <span class="s-ctrl">
                            <span class="key-wrap">
                                <input v-model="form.apiKey" class="input mono" :type="showKey ? 'text' : 'password'" :disabled="!ws.connected" :placeholder="keyMasked" autocomplete="off" spellcheck="false" />
                                <button class="eye-btn" :class="{ on: showKey }" title="显示 / 隐藏密钥" @click="showKey = !showKey"><Icon name="eye" style="width:15px;height:15px" /></button>
                            </span>
                        </span>
                    </div>
                    <div class="srow">
                        <span class="grow">
                            <span class="s-label">模型名</span>
                        </span>
                        <span class="s-ctrl"><input v-model="form.model" class="input mono" :disabled="!ws.connected" placeholder="gpt-4o" spellcheck="false" autocapitalize="off" /></span>
                    </div>
                    <div class="srow">
                        <span class="grow">
                            <span class="s-label">认证方式</span>
                        </span>
                        <span class="s-ctrl">
                            <span class="seg">
                                <button class="seg-item" :class="{ on: form.authMode === 'bearer' }" :disabled="!ws.connected" @click="form.authMode = 'bearer'">Bearer</button>
                                <button class="seg-item" :class="{ on: form.authMode === 'x-api-key' }" :disabled="!ws.connected" @click="form.authMode = 'x-api-key'">x-api-key</button>
                            </span>
                        </span>
                    </div>
                    <div class="srow">
                        <span class="grow">
                            <span class="s-label">连接检查</span>
                        </span>
                        <span class="s-ctrl test-actions">
                            <span v-if="testResult" class="test-result">{{ testResult }}</span>
                            <button v-if="model.config.hasKey" class="btn btn-danger-soft" :disabled="testingModel" @click="clearKey">清除密钥</button>
                            <button class="btn btn-plain" :disabled="testingModel || !form.apiUrl.trim() || !form.model.trim()" @click="testConnection">{{ testingModel ? '测试中…' : '测试连接' }}</button>
                        </span>
                    </div>
                </div>

                </div><!-- /模型页 -->

                <!-- 高级页:对话压缩 -->
                <div v-show="tab === 'advanced'">

                <div class="card sec">
                    <div class="sec-head">
                        <span class="grow">
                            <span class="sec-title">模型能力</span>
                        </span>
                    </div>
                    <div class="srow">
                        <span class="grow"><span class="s-label">深度思考</span></span>
                        <button class="toggle" :class="{ on: form.thinkingEnabled }" :disabled="!ws.connected" @click="form.thinkingEnabled = !form.thinkingEnabled"></button>
                    </div>
                    <div class="srow">
                        <span class="grow"><span class="s-label">思考强度</span></span>
                        <span class="s-ctrl">
                            <select v-model="form.reasoningEffort" class="input" :disabled="!ws.connected">
                                <option value="">自动</option>
                                <option value="low">低</option>
                                <option value="medium">中</option>
                                <option value="high">高</option>
                                <option value="max">最大</option>
                            </select>
                        </span>
                    </div>
                    <div class="srow">
                        <span class="grow"><span class="s-label">最大输出</span></span>
                        <span class="s-ctrl">
                            <input v-model="form.maxOutputTokens" class="input mono narrow" type="number" min="1" max="384000" step="1000" :disabled="!ws.connected" placeholder="模型默认" />
                            <span class="unit">tokens</span>
                        </span>
                    </div>
                </div>

                <!-- ③ 对话压缩 -->
                <div class="card sec">
                    <div class="sec-head">
                        <span class="grow">
                            <span class="sec-title">对话压缩</span>
                        </span>
                        <button class="btn btn-plain" @click="useAgentDefaults">恢复推荐值</button>
                    </div>
                    <div class="srow">
                        <span class="grow">
                            <span class="s-label">上下文达到多少开始摘要</span>
                        </span>
                        <span class="s-ctrl">
                            <input v-model="form.compressThreshold" class="input mono narrow" type="number" min="1000" step="1000" :disabled="!ws.connected" placeholder="64000" />
                            <span class="unit">tokens</span>
                        </span>
                    </div>
                    <div class="srow">
                        <span class="grow">
                            <span class="s-label">保留最近原文消息数</span>
                        </span>
                        <span class="s-ctrl">
                            <input v-model="form.recentRawMessages" class="input mono narrow" type="number" min="1" max="1000" step="10" :disabled="!ws.connected" placeholder="100" />
                            <span class="unit">条</span>
                        </span>
                    </div>
                    <div class="srow">
                        <span class="grow">
                            <span class="s-label">工具结果截断长度</span>
                        </span>
                        <span class="s-ctrl">
                            <input v-model="form.toolResultMaxChars" class="input mono narrow" type="number" step="500" :disabled="!ws.connected" placeholder="12000" />
                            <span class="unit">字符</span>
                        </span>
                    </div>
                    <div class="srow">
                        <span class="grow">
                            <span class="s-label">工具循环上限</span>
                        </span>
                        <span class="s-ctrl">
                            <input v-model="form.toolMaxRounds" class="input mono narrow" type="number" min="1" max="500" step="1" :disabled="!ws.connected" placeholder="50" />
                            <span class="unit">轮</span>
                        </span>
                    </div>
                </div>

                </div><!-- /高级页 -->

                <!-- 保存(模型 / 高级 页共用,账户页隐藏)-->
                <div v-show="tab === 'model' || tab === 'advanced'" class="save-row">
                    <button class="btn btn-primary" :disabled="!ws.connected || !dirty || saving" @click="save">{{ saved ? '已保存 ✓' : (saving ? '保存中…' : '保存') }}</button>
                    <button class="btn btn-plain" :disabled="!dirty || saving" @click="reset">重置</button>
                    <span v-if="!ws.connected" class="unit">连接断开,暂时只读</span>
                </div>

                <!-- 账户页 -->
                <div v-show="tab === 'account'">

                <!-- ④ 账户 -->
                <div class="card sec">
                    <div class="sec-head">
                        <span class="grow">
                            <span class="sec-title">账户</span>
                        </span>
                    </div>
                    <div class="srow">
                        <span class="grow">
                            <span class="s-label">访问口令</span>
                        </span>
                        <span class="s-ctrl"><button class="btn btn-plain" @click="togglePw">{{ pwOpen ? '收起' : '修改口令' }}</button></span>
                    </div>
                    <div v-show="pwOpen" class="pw-form">
                        <input v-model="pw.current" class="input" type="password" placeholder="当前口令" autocomplete="current-password" />
                        <input v-model="pw.next" class="input" type="password" placeholder="新口令(至少 6 位)" autocomplete="new-password" />
                        <input v-model="pw.confirm" class="input" type="password" placeholder="再输一遍新口令" autocomplete="new-password" @keyup.enter="changePassword" />
                        <div v-if="pwErr" class="pw-msg err">{{ pwErr }}</div>
                        <div v-else-if="pwMsg" class="pw-msg ok">{{ pwMsg }}</div>
                        <div class="pw-actions">
                            <button class="btn btn-primary" :disabled="pwBusy" @click="changePassword">{{ pwBusy ? '提交中…' : '确认修改' }}</button>
                            <button class="btn btn-plain" :disabled="pwBusy" @click="togglePw">取消</button>
                        </div>
                    </div>
                    <div class="srow">
                        <span class="grow">
                            <span class="s-label">登录状态</span>
                        </span>
                        <span class="s-ctrl"><button class="btn btn-danger-soft" @click="logout">退出登录</button></span>
                    </div>
                </div>
                </div><!-- /账户页 -->

            </div>
        </main>
    </div>
</template>

<style>
/* 设置页—— 分区卡 + 设置行 */
.sec { margin-top: 14px; padding: 16px 20px 6px; }
.sec:first-child { margin-top: 0; }
.sec-head { display: flex; align-items: flex-start; gap: 12px; padding-bottom: 12px; }
.sec-title { font-size: 13px; font-weight: 800; }

/* 顶部分页 tab（分段）*/
.tabs { display: flex; gap: 4px; padding: 4px; background: var(--well); border-radius: 14px; margin-bottom: 14px; }
.tab { flex: 1; padding: 9px 12px; border: 0; background: transparent; border-radius: 10px; font: inherit; font-size: 13px; font-weight: 700; color: var(--ink-3); cursor: pointer; transition: color .15s, background .15s, box-shadow .15s; }
.tab.on { background: var(--panel); color: var(--ink); box-shadow: var(--shadow-s); }
.tab:not(.on):hover { color: var(--ink2); }

/* 在线修改访问口令 */
.pw-form { display: flex; flex-direction: column; gap: 10px; padding: 2px 0 16px; }
.pw-form .input { width: 100%; padding: 9px 12px; font-size: 13px; }
.pw-msg { font-size: 12px; font-weight: 600; }
.pw-msg.err { color: var(--bad); }
.pw-msg.ok { color: var(--ok); }
.pw-actions { display: flex; gap: 10px; margin-top: 2px; }

/* 设置行:左 label + 说明,右控件 */
.srow { display: flex; align-items: center; gap: 14px; padding: 13px 0; border-top: 1px solid var(--line-soft); }
.srow:last-child { padding-bottom: 16px; }
.s-label { font-size: 13px; font-weight: 700; }
.s-ctrl { flex-shrink: 0; display: flex; align-items: center; gap: 8px; }
.s-ctrl .input { width: 250px; padding: 8px 12px; font-size: 12.5px; }
.s-ctrl .input.mono { font-size: 12px; }
.s-ctrl .input.narrow { width: 110px; text-align: right; }
.unit { font-size: 12px; color: var(--ink-3); font-weight: 600; }

/* 密钥输入 + 眼睛 */
.key-wrap { position: relative; width: 250px; display: inline-block; }
.key-wrap .input { width: 100%; padding-right: 38px; }
.eye-btn { position: absolute; right: 5px; top: 50%; transform: translateY(-50%);
    width: 28px; height: 28px; border-radius: 9px; display: grid; place-items: center;
    color: var(--ink-4); transition: all .15s; }
.eye-btn:hover { background: var(--well); color: var(--candy-deep); }
.eye-btn.on { color: var(--candy-deep); }

.test-actions { display: flex; align-items: center; justify-content: flex-end; gap: 8px; flex-wrap: wrap; }
.test-result { font-size: 11.5px; color: var(--ink-3); font-weight: 700; }

.theme-seg .seg-item { gap: 6px; min-width: 86px; justify-content: center; }
.theme-seg .o-icon { width: 15px; height: 15px; }

/* 保存行 */
.save-row { display: flex; align-items: center; gap: 10px; margin-top: 14px; padding: 0 4px; }

/* 移动端:设置行上下堆叠,控件占满整行 */
@media (max-width: 640px) {
    .sec { padding: 15px 16px 4px; }
    .srow { flex-direction: column; align-items: stretch; gap: 9px; }
    .srow > .grow { width: 100%; }
    .s-ctrl { width: 100%; flex-shrink: 1; }
    .s-ctrl .input, .key-wrap { width: 100%; }
    .s-ctrl .input.narrow { width: 120px; margin-right: auto; text-align: left; }
    .s-ctrl:has(.toggle), .s-ctrl:has(.seg) { width: auto; align-self: flex-start; }
}
</style>
