<script setup>
import { ref } from 'vue';
import Icon from '@/system/components/Icon.vue';
import { NAV_KEYS, CTRL_KEYS, useTerminalStore } from '../store';

const terminal = useTerminalStore();
const input = ref(null);
</script>

<template>
    <div class="terminal-input-area">
        <div v-show="terminal.keyPanelOpen" class="terminal-key-panel">
            <button v-for="key in NAV_KEYS" :key="key.label" @click="terminal.sendRaw(key.value)">{{ key.label }}</button>
            <span class="terminal-key-sep"></span>
            <button v-for="key in CTRL_KEYS" :key="key.label" @click="terminal.sendRaw(key.value)">{{ key.label }}</button>
        </div>
        <div class="terminal-input-row safe-bottom">
            <button class="terminal-key-toggle" :class="{ on: terminal.keyPanelOpen }" title="控制键"
                @click="terminal.keyPanelOpen = !terminal.keyPanelOpen">
                <Icon name="keyboard" />
            </button>
            <input ref="input" v-model="terminal.input" placeholder="输入命令，回车发送"
                autocomplete="off" autocapitalize="off" autocorrect="off" spellcheck="false"
                @keydown.enter="terminal.sendCommand" @keydown.up.prevent="terminal.historyUp" @keydown.down.prevent="terminal.historyDown" />
            <button class="terminal-send" :disabled="!terminal.input" title="发送命令" @click="terminal.sendCommand"><Icon name="send" /></button>
        </div>
    </div>
</template>

<style scoped>
.terminal-input-area { flex-shrink: 0; background: var(--glass-strong); border-top: 1px solid var(--line-soft); }
.terminal-key-panel { display: flex; align-items: center; gap: 5px; padding: 7px 10px 2px; overflow-x: auto; scrollbar-width: none; }
.terminal-key-panel::-webkit-scrollbar { display: none; }
.terminal-key-panel button { flex: 0 0 auto; min-width: 42px; height: 29px; padding: 0 9px; border-radius: 8px; background: var(--well); border: 1px solid var(--line-soft); color: var(--ink2); font-family: var(--mono); font-size: 11px; font-weight: 650; }
.terminal-key-panel button:hover { color: var(--candy-deep); border-color: var(--candy-ring); }
.terminal-key-sep { flex: 0 0 auto; width: 1px; height: 20px; margin: 0 3px; background: var(--line); }
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
@media (min-width: 900px) { .terminal-input-area { display: none; } }
</style>
