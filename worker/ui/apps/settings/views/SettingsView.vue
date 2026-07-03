<script setup>
import { computed, onMounted, reactive, ref, watch } from 'vue';
import { useModelStore } from '@/apps/settings/store';
import { useWsStore } from '@/system/stores/ws';
import { logout } from '@/system/api';
import SettingsHeader from '../components/SettingsHeader.vue';
import Icon from '@/system/components/Icon.vue';

const model = useModelStore();
const ws = useWsStore();

// —— 模型 / 视觉 / 压缩(显式保存) ——
const form = reactive({
    apiUrl: '', apiKey: '', model: '', authMode: 'bearer',
    visionEnabled: false,
    visionApiUrl: '', visionApiKey: '', visionModel: '', visionAuthMode: 'bearer',
    compressThreshold: '12000', recentRawMessages: '100', toolResultMaxChars: '12000', toolMaxRounds: '50',
});
const saved = ref(false);
const saving = ref(false);
const showKey = ref(false);
const showVisionKey = ref(false);

// 服务器只回掩码,不回明文 key
const keyMasked = computed(() => model.config.keyPreview || (model.config.hasKey ? '已设置' : '未设置'));
const visionKeyMasked = computed(() => model.config.visionKeyPreview || (model.config.hasVisionKey ? '已设置' : '未设置'));

const dirty = computed(() =>
    form.apiUrl !== (model.config.apiUrl || '') ||
    form.model !== (model.config.model || '') ||
    form.apiKey.trim().length > 0 ||
    form.authMode !== (model.config.authMode || 'bearer') ||
    form.visionEnabled !== Boolean(model.config.visionEnabled) ||
    form.visionApiUrl !== (model.config.visionApiUrl || '') ||
    form.visionModel !== (model.config.visionModel || '') ||
    form.visionApiKey.trim().length > 0 ||
    form.visionAuthMode !== (model.config.visionAuthMode || 'bearer') ||
    String(form.compressThreshold) !== String(model.config.compressThreshold ?? 12000) ||
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
    form.visionEnabled = Boolean(c.visionEnabled);
    form.visionApiUrl = c.visionApiUrl || '';
    form.visionModel = c.visionModel || '';
    form.visionApiKey = '';
    form.visionAuthMode = c.visionAuthMode || 'bearer';
    form.compressThreshold = String(c.compressThreshold ?? 12000);
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
        visionEnabled: form.visionEnabled ? '1' : '',
        visionApiUrl: String(form.visionApiUrl).trim(),
        visionModel: String(form.visionModel).trim(),
        visionAuthMode: form.visionAuthMode,
        compressThreshold: String(Number(form.compressThreshold) || 12000),
        recentRawMessages: String(Number(form.recentRawMessages) || 100),
        toolResultMaxChars: String(Number(form.toolResultMaxChars) || 12000),
        toolMaxRounds: String(Number(form.toolMaxRounds) || 50),
    };
    if (form.apiKey.trim()) patch.apiKey = form.apiKey.trim();
    if (form.visionApiKey.trim()) patch.visionApiKey = form.visionApiKey.trim();
    await model.save(patch);
    syncFromServer();
    saving.value = false;
    saved.value = true;
    setTimeout(() => { saved.value = false; }, 1800);
}
function reset() { syncFromServer(); }

onMounted(load);
watch(() => ws.connected, (v) => { if (v) load(); });
</script>

<template>
    <div class="app">
        <SettingsHeader />
        <main class="page">
            <div class="page-inner">

                <!-- ① 主模型 -->
                <div class="card sec">
                    <div class="sec-head">
                        <span class="grow">
                            <span class="sec-title">主模型</span>
                            <div class="sec-desc">驱动 one 大脑的模型,没配好之前它什么都做不了。</div>
                        </span>
                        <span v-if="model.config.hasKey && model.config.model" class="pill pill-ok"><Icon name="check" style="width:11px;height:11px" />已配置</span>
                    </div>
                    <div class="srow">
                        <span class="grow">
                            <span class="s-label">接口地址</span>
                            <div class="s-sub">兼容 OpenAI / Anthropic 接口的 base URL</div>
                        </span>
                        <span class="s-ctrl"><input v-model="form.apiUrl" class="input mono" :disabled="!ws.connected" placeholder="https://api.openai.com/v1" spellcheck="false" autocapitalize="off" /></span>
                    </div>
                    <div class="srow">
                        <span class="grow">
                            <span class="s-label">密钥</span>
                            <div class="s-sub">只存在你自己的 Cloudflare 上,留空＝不改</div>
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
                            <div class="s-sub">对话、任务、日程共用这一个模型</div>
                        </span>
                        <span class="s-ctrl"><input v-model="form.model" class="input mono" :disabled="!ws.connected" placeholder="gpt-4o" spellcheck="false" autocapitalize="off" /></span>
                    </div>
                    <div class="srow">
                        <span class="grow">
                            <span class="s-label">认证方式</span>
                            <div class="s-sub">密钥以哪种方式随请求发送</div>
                        </span>
                        <span class="s-ctrl">
                            <span class="seg">
                                <button class="seg-item" :class="{ on: form.authMode === 'bearer' }" :disabled="!ws.connected" @click="form.authMode = 'bearer'">Bearer</button>
                                <button class="seg-item" :class="{ on: form.authMode === 'x-api-key' }" :disabled="!ws.connected" @click="form.authMode = 'x-api-key'">x-api-key</button>
                            </span>
                        </span>
                    </div>
                </div>

                <!-- ② 视觉能力 -->
                <div class="card sec">
                    <div class="sec-head">
                        <span class="grow">
                            <span class="sec-title">视觉能力</span>
                            <div class="sec-desc">one 要看屏幕(截屏理解)时用什么模型。</div>
                        </span>
                    </div>
                    <div class="srow">
                        <span class="grow">
                            <span class="s-label">视觉模型</span>
                            <div class="s-sub">截屏理解、屏幕操控都会走它</div>
                        </span>
                        <span class="s-ctrl">
                            <span class="seg">
                                <button class="seg-item" :class="{ on: form.visionEnabled }" :disabled="!ws.connected" @click="form.visionEnabled = true">复用主模型</button>
                                <button class="seg-item" :class="{ on: !form.visionEnabled }" :disabled="!ws.connected" @click="form.visionEnabled = false">单独配置</button>
                            </span>
                        </span>
                    </div>
                    <div v-if="form.visionEnabled" class="vision-hint">主模型支持图像时可直接复用,不用再配一遍。</div>
                    <div v-else class="vision-form">
                        <div class="field">
                            <label>接口地址</label>
                            <input v-model="form.visionApiUrl" class="input mono" :disabled="!ws.connected" placeholder="https://…/v1/chat/completions" spellcheck="false" autocapitalize="off" />
                        </div>
                        <div class="field">
                            <label>密钥 <span style="font-weight:500;color:var(--ink-4)">留空＝不改</span></label>
                            <span class="key-wrap" style="width:100%">
                                <input v-model="form.visionApiKey" class="input mono" :type="showVisionKey ? 'text' : 'password'" :disabled="!ws.connected" :placeholder="visionKeyMasked" autocomplete="off" spellcheck="false" />
                                <button class="eye-btn" :class="{ on: showVisionKey }" title="显示 / 隐藏密钥" @click="showVisionKey = !showVisionKey"><Icon name="eye" style="width:15px;height:15px" /></button>
                            </span>
                        </div>
                        <div class="field">
                            <label>模型名</label>
                            <input v-model="form.visionModel" class="input mono" :disabled="!ws.connected" placeholder="比如 claude-haiku-4-5 / gpt-4o" spellcheck="false" autocapitalize="off" />
                        </div>
                        <div class="field">
                            <label>认证方式</label>
                            <span class="seg" style="align-self:flex-start">
                                <button class="seg-item" :class="{ on: form.visionAuthMode === 'bearer' }" :disabled="!ws.connected" @click="form.visionAuthMode = 'bearer'">Bearer</button>
                                <button class="seg-item" :class="{ on: form.visionAuthMode === 'x-api-key' }" :disabled="!ws.connected" @click="form.visionAuthMode = 'x-api-key'">x-api-key</button>
                            </span>
                        </div>
                    </div>
                </div>

                <!-- ③ 对话压缩 -->
                <div class="card sec">
                    <div class="sec-head">
                        <span class="grow">
                            <span class="sec-title">对话压缩</span>
                            <div class="sec-desc">对话太长时自动瘦身,省 token 也防跑偏。</div>
                        </span>
                    </div>
                    <div class="srow">
                        <span class="grow">
                            <span class="s-label">上下文达到多少开始摘要</span>
                            <div class="s-sub">更早的内容会被自动整理成摘要</div>
                        </span>
                        <span class="s-ctrl">
                            <input v-model="form.compressThreshold" class="input mono narrow" type="number" step="1000" :disabled="!ws.connected" placeholder="12000" />
                            <span class="unit">tokens</span>
                        </span>
                    </div>
                    <div class="srow">
                        <span class="grow">
                            <span class="s-label">保留最近原文消息数</span>
                            <div class="s-sub">摘要之外保留最近多少条原始消息</div>
                        </span>
                        <span class="s-ctrl">
                            <input v-model="form.recentRawMessages" class="input mono narrow" type="number" min="1" max="1000" step="10" :disabled="!ws.connected" placeholder="100" />
                            <span class="unit">条</span>
                        </span>
                    </div>
                    <div class="srow">
                        <span class="grow">
                            <span class="s-label">工具结果截断长度</span>
                            <div class="s-sub">超长的工具返回只保留开头这么多</div>
                        </span>
                        <span class="s-ctrl">
                            <input v-model="form.toolResultMaxChars" class="input mono narrow" type="number" step="500" :disabled="!ws.connected" placeholder="12000" />
                            <span class="unit">字符</span>
                        </span>
                    </div>
                    <div class="srow">
                        <span class="grow">
                            <span class="s-label">工具循环上限</span>
                            <div class="s-sub">一次回复最多连续调用多少轮工具</div>
                        </span>
                        <span class="s-ctrl">
                            <input v-model="form.toolMaxRounds" class="input mono narrow" type="number" min="1" max="500" step="1" :disabled="!ws.connected" placeholder="50" />
                            <span class="unit">轮</span>
                        </span>
                    </div>
                </div>

                <!-- 模型 / 视觉 / 压缩 的保存 -->
                <div class="save-row">
                    <button class="btn btn-primary" :disabled="!ws.connected || !dirty || saving" @click="save">{{ saved ? '已保存 ✓' : (saving ? '保存中…' : '保存') }}</button>
                    <button class="btn btn-plain" :disabled="!dirty || saving" @click="reset">重置</button>
                    <span v-if="!ws.connected" class="unit">连接断开,暂时只读</span>
                </div>

                <!-- ④ 账户 -->
                <div class="card sec">
                    <div class="sec-head">
                        <span class="grow">
                            <span class="sec-title">账户</span>
                            <div class="sec-desc">一人一账户,数据全部在你自己的 Cloudflare 上。</div>
                        </span>
                    </div>
                    <div class="srow">
                        <span class="grow">
                            <span class="s-label">访问口令</span>
                            <div class="s-sub">唯一的登录凭证,在线修改即将支持</div>
                        </span>
                        <span class="s-ctrl"><button class="btn btn-plain" disabled>修改口令</button></span>
                    </div>
                    <div class="srow">
                        <span class="grow">
                            <span class="s-label">登录状态</span>
                            <div class="s-sub">退出后需要重新输入访问口令</div>
                        </span>
                        <span class="s-ctrl"><button class="btn btn-danger-soft" @click="logout">退出登录</button></span>
                    </div>
                </div>

            </div>
        </main>
    </div>
</template>

<style>
/* 设置页(晴空软糖)—— 分区卡 + 设置行 */
.sec { margin-top: 14px; padding: 16px 20px 6px; }
.sec:first-child { margin-top: 0; }
.sec-head { display: flex; align-items: flex-start; gap: 12px; padding-bottom: 12px; }
.sec-title { font-size: 13px; font-weight: 800; }
.sec-desc { margin-top: 3px; font-size: 12px; color: var(--ink-3); line-height: 1.6; }

/* 设置行:左 label + 说明,右控件 */
.srow { display: flex; align-items: center; gap: 14px; padding: 13px 0; border-top: 1px solid var(--line-soft); }
.srow:last-child { padding-bottom: 16px; }
.s-label { font-size: 13px; font-weight: 700; }
.s-sub { margin-top: 3px; font-size: 11.5px; color: var(--ink-3); line-height: 1.6; }
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

/* 视觉能力:单独配置展开表单 */
.vision-hint { padding: 0 0 14px; font-size: 12px; color: var(--ink-3); }
.vision-form { display: flex; flex-direction: column; gap: 12px; padding: 2px 0 16px; }
.vision-form .input { font-size: 12.5px; }

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
