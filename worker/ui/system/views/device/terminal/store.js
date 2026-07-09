import { computed, nextTick, ref } from 'vue';
import { defineStore } from 'pinia';
import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import { WebLinksAddon } from '@xterm/addon-web-links';
import { useWsStore } from '@/system/stores/ws';
import { useToastStore } from '@/system/stores/toast';

const FONT_KEY = 'one-terminal-font-size';
const HISTORY_KEY = 'one-terminal-history';
const HISTORY_LIMIT = 60;
const FIT_DELAYS = [0, 50, 160];

const TERMINAL_THEMES = {
    sky: {
        background: '#f7fbff', foreground: '#22354e', cursor: '#2b86e4', cursorAccent: '#f7fbff',
        selectionBackground: '#cfe6fb', black: '#22354e', red: '#d4564e', green: '#169060', yellow: '#cf7d0a',
        blue: '#2b86e4', magenta: '#c2418f', cyan: '#188f99', white: '#8ba1bb', brightBlack: '#54688a',
        brightRed: '#ee5d68', brightGreen: '#26b573', brightYellow: '#e0a930', brightBlue: '#3b9bf5',
        brightMagenta: '#df65a7', brightCyan: '#24aab4', brightWhite: '#22354e',
    },
    night: {
        background: '#1f2342', foreground: '#edefff', cursor: '#aab4ff', cursorAccent: '#1f2342',
        selectionBackground: '#3a4078', black: '#2b305c', red: '#ff8c84', green: '#4ce0a3', yellow: '#e8c268',
        blue: '#8e9bff', magenta: '#c799e6', cyan: '#7fd6d6', white: '#c3c9ec', brightBlack: '#9aa3d4',
        brightRed: '#ffa39c', brightGreen: '#73ecb8', brightYellow: '#f0d68a', brightBlue: '#aab4ff',
        brightMagenta: '#dab0ee', brightCyan: '#9fe0e0', brightWhite: '#edefff',
    },
};

const instances = new Map();
const fitAddons = new Map();
const containers = new Map();
const pendingOutput = new Map();
let handlersBound = false;
let themeBound = false;

function terminalTheme() {
    return document.documentElement.dataset.theme === 'night' ? TERMINAL_THEMES.night : TERMINAL_THEMES.sky;
}

function decodeBase64(value) {
    const binary = atob(value || '');
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    return bytes;
}

function loadHistory() {
    try {
        const value = JSON.parse(localStorage.getItem(HISTORY_KEY) || '[]');
        return Array.isArray(value) ? value.filter((item) => typeof item === 'string').slice(-HISTORY_LIMIT) : [];
    } catch { return []; }
}

export const NAV_KEYS = [
    { label: 'Tab', value: '\t' }, { label: 'Esc', value: '\x1b' },
    { label: '↑', value: '\x1b[A' }, { label: '↓', value: '\x1b[B' },
    { label: '←', value: '\x1b[D' }, { label: '→', value: '\x1b[C' },
    { label: 'PgUp', value: '\x1b[5~' }, { label: 'PgDn', value: '\x1b[6~' },
    { label: 'Home', value: '\x1bOH' }, { label: 'End', value: '\x1bOF' },
];

export const CTRL_KEYS = [
    { label: '^C', value: '\x03' }, { label: '^D', value: '\x04' },
    { label: '^L', value: '\x0c' }, { label: '^R', value: '\x12' },
    { label: '^W', value: '\x17' }, { label: '^U', value: '\x15' },
    { label: '^A', value: '\x01' }, { label: '^E', value: '\x05' },
];

export const useTerminalStore = defineStore('device-terminal', () => {
    const ws = useWsStore();
    const toast = useToastStore();
    const deviceName = ref('');
    const tabs = ref([]);
    const activeId = ref('');
    const input = ref('');
    const keyPanelOpen = ref(false);
    const fontSize = ref(Math.min(24, Math.max(10, Number(localStorage.getItem(FONT_KEY)) || 14)));
    const history = ref(loadHistory());
    let historyIndex = history.value.length;
    let historyDraft = '';

    const active = computed(() => tabs.value.find((tab) => tab.id === activeId.value) || null);

    function matches(msg) {
        return !msg.from || msg.from === deviceName.value;
    }

    function send(type, data = {}) {
        if (!ws.connected || !deviceName.value) return false;
        return ws.sendMsg({ type, to: deviceName.value, data });
    }

    function disposeInstance(id) {
        try { instances.get(id)?.dispose(); } catch {}
        instances.delete(id);
        fitAddons.delete(id);
        containers.delete(id);
        pendingOutput.delete(id);
    }

    function reset() {
        for (const id of instances.keys()) disposeInstance(id);
        tabs.value = [];
        activeId.value = '';
    }

    function ensureInstance(id) {
        if (!id) return null;
        if (instances.has(id)) return instances.get(id);
        const terminal = new Terminal({
            cursorBlink: true,
            cursorStyle: 'bar',
            convertEol: false,
            fontFamily: 'ui-monospace, "SFMono-Regular", Menlo, Monaco, Consolas, monospace',
            fontSize: fontSize.value,
            lineHeight: 1.2,
            scrollback: 10000,
            theme: terminalTheme(),
        });
        const fit = new FitAddon();
        terminal.loadAddon(fit);
        try { terminal.loadAddon(new WebLinksAddon()); } catch {}
        terminal.onData((value) => send('terminal.input', { terminalId: id, input: value }));
        instances.set(id, terminal);
        fitAddons.set(id, fit);

        const container = containers.get(id);
        if (container) terminal.open(container);
        const queued = pendingOutput.get(id) || [];
        pendingOutput.delete(id);
        for (const bytes of queued) terminal.write(bytes);
        return terminal;
    }

    function setTabs(items) {
        const next = Array.isArray(items) ? items.filter((item) => item?.id) : [];
        const ids = new Set(next.map((item) => item.id));
        for (const id of instances.keys()) if (!ids.has(id)) disposeInstance(id);
        tabs.value = next;
        for (const item of next) ensureInstance(item.id);
        if (!ids.has(activeId.value)) activeId.value = next[0]?.id || '';
        scheduleFit();
    }

    function bindHandlers() {
        if (handlersBound) return;
        handlersBound = true;
        ws.onMessage('terminal.list', (msg) => {
            if (!matches(msg)) return;
            setTabs(msg.data?.terminals || []);
        });
        ws.onMessage('terminal.created', (msg) => {
            if (!matches(msg)) return;
            const item = msg.data?.terminal;
            if (!item?.id) return;
            tabs.value = [...tabs.value.filter((tab) => tab.id !== item.id), item];
            ensureInstance(item.id);
            activeId.value = item.id;
            scheduleFit();
        });
        ws.onMessage('terminal.output', (msg) => {
            if (!matches(msg)) return;
            const id = msg.data?.terminalId;
            if (!id || !msg.data?.data) return;
            let bytes;
            try { bytes = decodeBase64(msg.data.data); } catch { return; }
            const terminal = instances.get(id);
            if (terminal) terminal.write(bytes);
            else pendingOutput.set(id, [...(pendingOutput.get(id) || []), bytes]);
        });
        ws.onMessage('terminal.closed', (msg) => {
            if (!matches(msg)) return;
            const id = msg.data?.terminalId;
            if (!id) return;
            disposeInstance(id);
            tabs.value = tabs.value.filter((tab) => tab.id !== id);
            if (activeId.value === id) activeId.value = tabs.value[0]?.id || '';
            if (msg.data?.reason && msg.data.reason !== '已关闭' && msg.data.reason !== '正在重启') toast.show(msg.data.reason);
            scheduleFit();
        });
        ws.onMessage('terminal.error', (msg) => {
            if (matches(msg) && msg.data?.error) toast.show(msg.data.error, 2600);
        });
        if (!themeBound) {
            themeBound = true;
            window.addEventListener('one-theme', () => {
                const theme = terminalTheme();
                for (const terminal of instances.values()) terminal.options.theme = theme;
            });
        }
    }

    function initialize(target) {
        const next = String(target || '');
        if (deviceName.value && deviceName.value !== next) reset();
        deviceName.value = next;
        bindHandlers();
        requestList();
    }

    function requestList() { send('terminal.list'); }
    function create(cwd = '') { send('terminal.create', { cwd: String(cwd || '').trim() || undefined }); }
    function close(id = activeId.value) { if (id) send('terminal.close', { terminalId: id }); }
    function restart(id = activeId.value) { if (id) send('terminal.restart', { terminalId: id }); }

    function activate(id) {
        if (!tabs.value.some((tab) => tab.id === id)) return;
        activeId.value = id;
        scheduleFit();
        nextTick(() => instances.get(id)?.focus());
    }

    function mount(id, element) {
        if (!id || !element) return;
        containers.set(id, element);
        const terminal = ensureInstance(id);
        if (terminal && !terminal.element) terminal.open(element);
        if (id === activeId.value) scheduleFit();
    }

    function fit(id = activeId.value) {
        if (!id || id !== activeId.value) return;
        const container = containers.get(id);
        if (!container?.isConnected || container.clientWidth < 120 || container.clientHeight < 60) return;
        try {
            fitAddons.get(id)?.fit();
            const terminal = instances.get(id);
            if (terminal?.cols >= 20 && terminal?.rows >= 4) {
                send('terminal.resize', { terminalId: id, cols: terminal.cols, rows: terminal.rows });
            }
        } catch {}
    }

    function scheduleFit() {
        const id = activeId.value;
        for (const delay of FIT_DELAYS) setTimeout(() => fit(id), delay);
    }

    function sendRaw(value) {
        const id = activeId.value;
        if (id && value) send('terminal.input', { terminalId: id, input: value });
    }

    function sendCommand() {
        const command = input.value;
        if (!command || !activeId.value) return;
        sendRaw(`${command}\r`);
        const next = [...history.value.filter((item) => item !== command), command].slice(-HISTORY_LIMIT);
        history.value = next;
        localStorage.setItem(HISTORY_KEY, JSON.stringify(next));
        historyIndex = next.length;
        historyDraft = '';
        input.value = '';
    }

    function historyUp() {
        if (!history.value.length) return;
        if (historyIndex === history.value.length) historyDraft = input.value;
        historyIndex = Math.max(0, historyIndex - 1);
        input.value = history.value[historyIndex] || '';
    }

    function historyDown() {
        if (!history.value.length) return;
        historyIndex = Math.min(history.value.length, historyIndex + 1);
        input.value = historyIndex === history.value.length ? historyDraft : history.value[historyIndex] || '';
    }

    function adjustFont(delta) {
        fontSize.value = Math.min(24, Math.max(10, fontSize.value + delta));
        localStorage.setItem(FONT_KEY, String(fontSize.value));
        for (const terminal of instances.values()) terminal.options.fontSize = fontSize.value;
        scheduleFit();
    }

    async function copySelection() {
        const text = instances.get(activeId.value)?.getSelection() || '';
        if (!text) { toast.show('请先选择终端文字'); return; }
        try { await navigator.clipboard.writeText(text); toast.show('已复制'); }
        catch { toast.show('复制失败'); }
    }

    function clear() { instances.get(activeId.value)?.clear(); }

    return {
        deviceName, tabs, activeId, active, input, keyPanelOpen, fontSize,
        initialize, requestList, create, close, restart, activate, mount, fit, scheduleFit,
        sendRaw, sendCommand, historyUp, historyDown, adjustFont, copySelection, clear,
    };
});
