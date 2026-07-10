import { ref } from 'vue';
import { defineStore } from 'pinia';

const STORAGE_KEY = 'one-terminal-snippets';
const SEED_VERSION_KEY = 'one-terminal-snippets-seed-version';
const CURRENT_SEED_VERSION = 1;
export const MAX_SNIPPETS = 50;

const DEFAULT_SNIPPETS = [
    { name: 'claude', command: 'claude', autoSend: true },
    { name: 'claude --dangerously-skip-permissions', command: 'claude --dangerously-skip-permissions', autoSend: true },
    { name: 'codex', command: 'codex', autoSend: true },
    { name: 'codex --yolo', command: 'codex --yolo', autoSend: true },
];

function id(index = 0) {
    return `${Date.now().toString(36)}${index.toString(36)}${Math.random().toString(36).slice(2, 6)}`;
}

function normalize(items) {
    if (!Array.isArray(items)) return [];
    return items
        .filter((item) => item && typeof item.name === 'string' && typeof item.command === 'string')
        .map((item, index) => ({
            id: String(item.id || id(index)),
            name: item.name.trim().slice(0, 40),
            command: item.command.slice(0, 4096),
            autoSend: item.autoSend !== false,
        }))
        .filter((item) => item.name && item.command)
        .slice(0, MAX_SNIPPETS);
}

function load() {
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (raw !== null) return normalize(JSON.parse(raw));
        const seeded = DEFAULT_SNIPPETS.map((item, index) => ({ id: id(index), ...item }));
        localStorage.setItem(STORAGE_KEY, JSON.stringify(seeded));
        localStorage.setItem(SEED_VERSION_KEY, String(CURRENT_SEED_VERSION));
        return seeded;
    } catch { return []; }
}

export const useTerminalSnippetsStore = defineStore('terminal-snippets', () => {
    const snippets = ref(load());

    function persist() {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(snippets.value));
    }

    function add({ name, command, autoSend = true }) {
        if (snippets.value.length >= MAX_SNIPPETS) return false;
        snippets.value.push({ id: id(), name: name.trim(), command, autoSend });
        persist();
        return true;
    }

    function update(target, patch) {
        const index = snippets.value.findIndex((item) => item.id === target);
        if (index < 0) return;
        snippets.value[index] = { ...snippets.value[index], ...patch };
        persist();
    }

    function remove(target) {
        snippets.value = snippets.value.filter((item) => item.id !== target);
        persist();
    }

    return { snippets, add, update, remove };
});
