<script setup>
import { ref } from 'vue';
import Icon from '@/system/components/Icon.vue';
import { useTerminalStore } from '../store';

const terminal = useTerminalStore();
const emit = defineEmits(['new']);
const toolsOpen = ref(false);
</script>

<template>
    <div class="terminal-toolbar">
        <div class="terminal-tabs" role="tablist" aria-label="终端会话">
            <div v-for="tab in terminal.tabs" :key="tab.id" class="terminal-tab"
                :class="{ on: tab.id === terminal.activeId }" role="tab" :aria-selected="tab.id === terminal.activeId">
                <button class="terminal-tab-main" @click="terminal.activate(tab.id)">
                    <Icon name="terminal" />
                    <span class="terminal-tab-text">
                        <span class="terminal-tab-title">{{ tab.title || '终端' }}</span>
                        <span class="terminal-tab-cwd">{{ tab.cwd }}</span>
                    </span>
                </button>
                <button class="terminal-tab-close" title="关闭终端" @click.stop="terminal.close(tab.id)">
                    <Icon name="x" />
                </button>
            </div>
            <button class="terminal-tool-btn" title="新建终端" @click="emit('new')"><Icon name="plus" /></button>
        </div>

        <div class="terminal-tools">
            <button class="terminal-tool-btn" title="复制选中文字" @click="terminal.copySelection"><Icon name="copy" /></button>
            <button class="terminal-tool-btn" title="清空显示" @click="terminal.clear"><Icon name="eraser" /></button>
            <button class="terminal-tool-btn" title="终端设置" :class="{ on: toolsOpen }" @click="toolsOpen = !toolsOpen"><Icon name="settings" /></button>
        </div>

        <div v-if="toolsOpen" class="terminal-tool-menu">
            <div class="terminal-tool-row">
                <span>字号</span>
                <span class="terminal-stepper">
                    <button title="减小字号" @click="terminal.adjustFont(-1)"><Icon name="minus" /></button>
                    <b>{{ terminal.fontSize }}</b>
                    <button title="增大字号" @click="terminal.adjustFont(1)"><Icon name="plus" /></button>
                </span>
            </div>
            <button class="terminal-menu-action" @click="terminal.restart(); toolsOpen = false">
                <Icon name="refresh" />重启当前终端
            </button>
        </div>
    </div>
</template>

<style scoped>
.terminal-toolbar { position: relative; flex-shrink: 0; min-height: 48px; display: flex; align-items: center; gap: 8px; padding: 6px 10px; background: var(--glass); border-bottom: 1px solid var(--line-soft); }
.terminal-tabs { min-width: 0; flex: 1; display: flex; align-items: center; gap: 5px; overflow-x: auto; scrollbar-width: none; }
.terminal-tabs::-webkit-scrollbar { display: none; }
.terminal-tab { flex: 0 0 auto; width: 190px; height: 36px; padding: 0 6px 0 10px; display: flex; align-items: center; border-radius: 9px; color: var(--ink-3); border: 1px solid transparent; transition: background .15s, color .15s, border-color .15s; }
.terminal-tab:hover { background: var(--surface-hover); color: var(--ink2); }
.terminal-tab.on { background: var(--panel); color: var(--candy-deep); border-color: var(--surface-border); box-shadow: var(--shadow-s); }
.terminal-tab-main { min-width: 0; flex: 1; height: 100%; display: flex; align-items: center; gap: 8px; color: inherit; }
.terminal-tab-main > .o-icon { width: 15px; height: 15px; flex-shrink: 0; }
.terminal-tab-text { min-width: 0; flex: 1; display: flex; flex-direction: column; align-items: flex-start; line-height: 1.15; }
.terminal-tab-title, .terminal-tab-cwd { display: block; width: 100%; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; text-align: left; }
.terminal-tab-title { font-size: 11.5px; font-weight: 750; }
.terminal-tab-cwd { margin-top: 2px; font-size: 9px; color: var(--ink-4); }
.terminal-tab-close { width: 24px; height: 24px; display: grid; place-items: center; border-radius: 7px; color: var(--ink-4); opacity: 0; transition: opacity .15s, background .15s, color .15s; }
.terminal-tab:hover .terminal-tab-close, .terminal-tab.on .terminal-tab-close { opacity: 1; }
.terminal-tab-close:hover { color: var(--bad); background: var(--bad-soft); }
.terminal-tab-close .o-icon { width: 13px; height: 13px; }
.terminal-tools { flex-shrink: 0; display: flex; gap: 4px; }
.terminal-tool-btn { flex: 0 0 auto; width: 34px; height: 34px; display: grid; place-items: center; border-radius: 9px; color: var(--ink-3); transition: background .15s, color .15s; }
.terminal-tool-btn:hover, .terminal-tool-btn.on { background: var(--panel); color: var(--candy-deep); box-shadow: var(--shadow-s); }
.terminal-tool-btn .o-icon { width: 16px; height: 16px; }
.terminal-tool-menu { position: absolute; z-index: 70; right: 10px; top: 44px; width: 210px; padding: 8px; border-radius: 12px; background: var(--panel); border: 1px solid var(--surface-border); box-shadow: var(--shadow-l); }
.terminal-tool-row { height: 38px; padding: 0 8px; display: flex; align-items: center; justify-content: space-between; color: var(--ink2); font-size: 12px; font-weight: 650; }
.terminal-stepper { display: flex; align-items: center; gap: 4px; padding: 3px; border-radius: 9px; background: var(--well); }
.terminal-stepper button { width: 26px; height: 24px; display: grid; place-items: center; border-radius: 6px; color: var(--ink-3); }
.terminal-stepper button:hover { background: var(--panel); color: var(--candy-deep); }
.terminal-stepper .o-icon { width: 13px; height: 13px; }
.terminal-stepper b { width: 24px; text-align: center; font-size: 11px; }
.terminal-menu-action { width: 100%; height: 36px; padding: 0 8px; display: flex; align-items: center; gap: 8px; border-radius: 8px; color: var(--ink2); font-size: 12px; font-weight: 650; }
.terminal-menu-action:hover { background: var(--well); color: var(--ink); }
.terminal-menu-action .o-icon { width: 14px; height: 14px; }
@media (max-width: 640px) {
    .terminal-toolbar { padding: 5px 8px; }
    .terminal-tab { width: 150px; }
    .terminal-tools .terminal-tool-btn:not(:last-child) { display: none; }
    .terminal-tab-close { opacity: 1; }
}
</style>
