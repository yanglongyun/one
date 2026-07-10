<script setup>
import { ref, watch } from 'vue';
import Icon from '@/system/components/Icon.vue';
import { useToastStore } from '@/system/stores/toast';
import { MAX_SNIPPETS, useTerminalSnippetsStore } from '../snippets';

const props = defineProps({
    open: Boolean,
    editingId: { type: String, default: '' },
    initialName: { type: String, default: '' },
    initialCommand: { type: String, default: '' },
    initialAutoSend: { type: Boolean, default: true },
});
const emit = defineEmits(['close', 'saved']);
const snippets = useTerminalSnippetsStore();
const toast = useToastStore();
const name = ref('');
const command = ref('');
const autoSend = ref(true);

watch(() => props.open, (open) => {
    if (!open) return;
    name.value = props.initialName;
    command.value = props.initialCommand;
    autoSend.value = props.initialAutoSend;
});

function save() {
    const nextName = name.value.trim();
    const nextCommand = command.value;
    if (!nextName || !nextCommand) return;
    if (props.editingId) {
        snippets.update(props.editingId, { name: nextName, command: nextCommand, autoSend: autoSend.value });
        toast.show('常用命令已保存');
    } else if (!snippets.add({ name: nextName, command: nextCommand, autoSend: autoSend.value })) {
        toast.show(`最多保存 ${MAX_SNIPPETS} 条常用命令`);
        return;
    } else {
        toast.show('常用命令已添加');
    }
    emit('saved');
    emit('close');
}

function remove() {
    if (!props.editingId) return;
    snippets.remove(props.editingId);
    toast.show('常用命令已删除');
    emit('close');
}
</script>

<template>
    <div v-if="open" class="modal-mask" @click.self="emit('close')">
        <section class="modal terminal-snippet-modal">
            <div class="terminal-modal-head">
                <div>
                    <h2>{{ editingId ? '编辑常用命令' : '新增常用命令' }}</h2>
                    <p>保存后可从终端底部的“命令”面板一键运行。</p>
                </div>
                <button class="icon-btn ghost" title="关闭" @click="emit('close')"><Icon name="x" /></button>
            </div>
            <div class="field">
                <label for="snippet-name">名称</label>
                <input id="snippet-name" v-model="name" class="input mono" maxlength="40" placeholder="例如 Codex Yolo" />
            </div>
            <div class="field" style="margin-top:12px">
                <label for="snippet-command">命令内容</label>
                <textarea id="snippet-command" v-model="command" class="input mono snippet-command" maxlength="4096"
                    placeholder="例如 codex --yolo" spellcheck="false" autocapitalize="off" autocorrect="off"></textarea>
            </div>
            <label class="snippet-autosend">
                <input v-model="autoSend" type="checkbox" />
                <span>点击后直接发送并回车；关闭时仅填入底部输入框</span>
            </label>
            <div class="modal-foot">
                <button v-if="editingId" class="btn snippet-delete" @click="remove">删除</button>
                <span class="grow"></span>
                <button class="btn btn-plain" @click="emit('close')">取消</button>
                <button class="btn btn-primary" :disabled="!name.trim() || !command" @click="save">保存</button>
            </div>
        </section>
    </div>
</template>

<style scoped>
.terminal-snippet-modal { width: min(460px, 100%); }
.terminal-modal-head { display: flex; align-items: flex-start; justify-content: space-between; gap: 16px; margin-bottom: 20px; }
.terminal-modal-head h2 { margin: 0; font-size: 16px; font-weight: 800; }
.terminal-modal-head p { margin: 5px 0 0; color: var(--ink-3); font-size: 12px; }
.terminal-modal-head .icon-btn { margin-top: -6px; margin-right: -6px; }
.terminal-modal-head .o-icon { width: 16px; height: 16px; }
.snippet-command { height: 82px; padding-top: 10px; padding-bottom: 10px; resize: vertical; line-height: 1.45; }
.snippet-autosend { margin-top: 14px; display: flex; align-items: flex-start; gap: 9px; color: var(--ink-3); font-size: 12px; cursor: pointer; }
.snippet-autosend input { margin-top: 1px; accent-color: var(--candy); }
.snippet-delete { color: var(--bad); background: var(--bad-soft); }
</style>
