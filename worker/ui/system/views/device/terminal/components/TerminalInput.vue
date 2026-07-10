<script setup>
import { nextTick, ref } from 'vue';
import Icon from '@/system/components/Icon.vue';
import { NAV_KEYS, CTRL_KEYS, useTerminalStore } from '../store';
import { useTerminalSnippetsStore } from '../snippets';
import SnippetModal from './SnippetModal.vue';

const terminal = useTerminalStore();
const snippets = useTerminalSnippetsStore();
const input = ref(null);
const panelTab = ref('keys');
const modalOpen = ref(false);
const editing = ref(null);

function openAdd() {
    editing.value = null;
    modalOpen.value = true;
}

function openEdit(item) {
    editing.value = item;
    modalOpen.value = true;
}

function runSnippet(item) {
    if (item.autoSend !== false) terminal.sendRaw(`${item.command}\r`);
    else {
        terminal.input = item.command;
        nextTick(() => input.value?.focus());
    }
}
</script>

<template>
    <div class="terminal-input-area">
        <div v-show="terminal.keyPanelOpen" class="terminal-key-panel">
            <div class="terminal-panel-tabs">
                <button :class="{ on: panelTab === 'keys' }" @click="panelTab = 'keys'">按键</button>
                <button :class="{ on: panelTab === 'commands' }" @click="panelTab = 'commands'">
                    命令 <span v-if="snippets.snippets.length">{{ snippets.snippets.length }}</span>
                </button>
            </div>
            <template v-if="panelTab === 'keys'">
                <div class="terminal-key-group">
                    <button v-for="key in NAV_KEYS" :key="key.label" @click="terminal.sendRaw(key.value)">{{ key.label }}</button>
                </div>
                <span class="terminal-key-sep"></span>
                <div class="terminal-key-group">
                    <button v-for="key in CTRL_KEYS" :key="key.label" @click="terminal.sendRaw(key.value)">{{ key.label }}</button>
                </div>
            </template>
            <div v-else class="terminal-snippet-panel">
                <div v-if="!snippets.snippets.length" class="terminal-snippet-empty">还没有常用命令，可把下方输入框内容保存进来。</div>
                <div v-else class="terminal-snippet-list">
                    <div v-for="item in snippets.snippets" :key="item.id" class="terminal-snippet-item">
                        <button class="terminal-snippet-run" :title="item.command" @click="runSnippet(item)">{{ item.name }}</button>
                        <button class="terminal-snippet-edit" title="编辑常用命令" @click="openEdit(item)">•••</button>
                    </div>
                </div>
                <button class="terminal-snippet-add" @click="openAdd"><Icon name="plus" />新增常用命令</button>
            </div>
        </div>
        <div class="terminal-input-row safe-bottom">
            <button class="terminal-key-toggle" :class="{ on: terminal.keyPanelOpen }" title="按键与常用命令"
                @click="terminal.keyPanelOpen = !terminal.keyPanelOpen">
                <Icon name="keyboard" />
            </button>
            <input ref="input" v-model="terminal.input" placeholder="输入命令，回车发送"
                autocomplete="off" autocapitalize="off" autocorrect="off" spellcheck="false"
                @keydown.enter="terminal.sendCommand" @keydown.up.prevent="terminal.historyUp" @keydown.down.prevent="terminal.historyDown" />
            <button class="terminal-send" :disabled="!terminal.input" title="发送命令" @click="terminal.sendCommand"><Icon name="send" /></button>
        </div>
        <SnippetModal :open="modalOpen" :editing-id="editing?.id || ''" :initial-name="editing?.name || ''"
            :initial-command="editing?.command || terminal.input" :initial-auto-send="editing ? editing.autoSend !== false : true"
            @close="modalOpen = false" @saved="panelTab = 'commands'" />
    </div>
</template>

<style scoped>
.terminal-input-area { flex-shrink: 0; background: var(--glass-strong); border-top: 1px solid var(--line-soft); }
.terminal-key-panel { display: flex; flex-direction: column; align-items: stretch; gap: 6px; padding: 7px 10px 2px; }
.terminal-panel-tabs { display: flex; align-items: center; gap: 4px; margin: -2px 0 1px; border-bottom: 1px solid var(--line-soft); }
.terminal-panel-tabs button { position: relative; min-width: 58px; height: 30px; padding: 0 8px; border: 0; border-radius: 0; background: transparent; color: var(--ink-4); font-family: var(--sans); font-size: 11.5px; }
.terminal-panel-tabs button:hover, .terminal-panel-tabs button.on { color: var(--candy-deep); }
.terminal-panel-tabs button.on::after { content: ''; position: absolute; left: 8px; right: 8px; bottom: -1px; height: 2px; border-radius: 2px; background: var(--candy); }
.terminal-panel-tabs button span { margin-left: 3px; padding: 1px 5px; border-radius: 8px; background: var(--well); color: var(--ink-3); font-size: 9px; }
.terminal-key-group { display: flex; flex-wrap: wrap; align-items: center; gap: 5px; }
.terminal-key-group button { flex: 0 0 auto; min-width: 42px; height: 29px; padding: 0 9px; border-radius: 8px; background: var(--well); border: 1px solid var(--line-soft); color: var(--ink2); font-family: var(--mono); font-size: 11px; font-weight: 650; }
.terminal-key-group button:hover { color: var(--candy-deep); border-color: var(--candy-ring); }
.terminal-key-sep { width: 100%; height: 1px; background: var(--line); }
.terminal-snippet-panel { display: flex; flex-direction: column; gap: 6px; }
.terminal-snippet-empty { padding: 7px 3px; color: var(--ink-4); font-size: 11.5px; }
.terminal-snippet-list { display: flex; flex-wrap: wrap; gap: 5px; }
.terminal-snippet-item { display: flex; min-width: 0; height: 31px; border: 1px solid var(--candy-ring); border-radius: 8px; overflow: hidden; background: var(--candy-soft); }
.terminal-snippet-run { max-width: 230px; padding: 0 9px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; color: var(--candy-deep); font-family: var(--mono); font-size: 10.5px; font-weight: 700; }
.terminal-snippet-run:hover { background: var(--candy-ring); }
.terminal-snippet-edit { width: 28px; border-left: 1px solid var(--candy-ring); color: var(--ink-3); font-size: 10px; letter-spacing: -1px; }
.terminal-snippet-edit:hover { color: var(--candy-deep); background: var(--panel); }
.terminal-snippet-add { align-self: flex-start; height: 29px; padding: 0 9px; display: flex; align-items: center; gap: 5px; border: 1px dashed var(--line-hi); border-radius: 8px; color: var(--ink-3); font-size: 11px; }
.terminal-snippet-add:hover { color: var(--candy-deep); border-color: var(--candy); }
.terminal-snippet-add .o-icon { width: 12px; height: 12px; }
.terminal-input-row { min-height: 52px; display: flex; align-items: center; gap: 7px; padding: 7px 10px; }
.terminal-input-row input { min-width: 0; flex: 1; height: 37px; padding: 0 12px; border: 1px solid var(--line); border-radius: 10px; outline: 0; background: var(--well); color: var(--ink); font-family: var(--mono); font-size: 13px; }
.terminal-input-row input:focus { border-color: var(--candy); box-shadow: 0 0 0 3px var(--candy-ring); }
.terminal-input-row input::placeholder { color: var(--ink-4); }
.terminal-key-toggle, .terminal-send { flex: 0 0 auto; width: 37px; height: 37px; display: grid; place-items: center; border-radius: 10px; }
.terminal-key-toggle { color: var(--ink-3); background: var(--well); }
.terminal-key-toggle:hover, .terminal-key-toggle.on { color: var(--candy-deep); }
.terminal-key-toggle .o-icon, .terminal-send .o-icon { width: 17px; height: 17px; }
.terminal-send { color: var(--on-accent); background: linear-gradient(160deg, var(--accent-start), var(--candy-deep)); box-shadow: var(--gloss), 0 4px 10px -3px rgba(43,134,228,.5); }
.terminal-send:disabled { opacity: .4; box-shadow: none; }
</style>
