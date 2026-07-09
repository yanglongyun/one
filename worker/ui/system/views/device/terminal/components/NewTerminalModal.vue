<script setup>
import { ref, watch } from 'vue';
import Icon from '@/system/components/Icon.vue';
import { useTerminalStore } from '../store';

const props = defineProps({ open: Boolean });
const emit = defineEmits(['close']);
const terminal = useTerminalStore();
const cwd = ref('');

watch(() => props.open, (open) => { if (open) cwd.value = ''; });

function create() {
    terminal.create(cwd.value);
    emit('close');
}
</script>

<template>
    <div v-if="open" class="modal-mask" @click.self="emit('close')">
        <section class="modal terminal-new-modal">
            <div class="terminal-modal-head">
                <div>
                    <h2>新建终端</h2>
                    <p>不填写时从桌面目录启动。</p>
                </div>
                <button class="icon-btn ghost" title="关闭" @click="emit('close')"><Icon name="x" /></button>
            </div>
            <div class="field">
                <label for="terminal-cwd">启动目录</label>
                <input id="terminal-cwd" v-model="cwd" class="input mono" placeholder="例如 /Users/name/Projects" spellcheck="false" @keydown.enter="create" />
            </div>
            <div class="modal-foot">
                <button class="btn btn-plain" @click="emit('close')">取消</button>
                <button class="btn btn-primary" @click="create"><Icon name="plus" />新建终端</button>
            </div>
        </section>
    </div>
</template>

<style scoped>
.terminal-new-modal { width: min(430px, 100%); }
.terminal-modal-head { display: flex; align-items: flex-start; justify-content: space-between; gap: 16px; margin-bottom: 20px; }
.terminal-modal-head h2 { margin: 0; font-size: 16px; font-weight: 800; }
.terminal-modal-head p { margin: 5px 0 0; color: var(--ink-3); font-size: 12px; }
.terminal-modal-head .icon-btn { margin-top: -6px; margin-right: -6px; }
.terminal-modal-head .o-icon { width: 16px; height: 16px; }
.btn .o-icon { width: 14px; height: 14px; }
</style>
