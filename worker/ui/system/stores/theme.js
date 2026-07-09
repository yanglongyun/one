import { defineStore } from 'pinia';
import { ref } from 'vue';

const KEY = 'one-theme';
const THEMES = ['sky', 'night'];
const DEFAULT = 'sky';

export const THEME_LABELS = { sky: '晴空', night: '谧夜' };

function load() {
    try {
        const value = localStorage.getItem(KEY);
        return THEMES.includes(value) ? value : DEFAULT;
    } catch {
        return DEFAULT;
    }
}

function apply(theme) {
    const root = document.documentElement;
    if (theme === 'night') root.dataset.theme = 'night';
    else delete root.dataset.theme;
    root.style.colorScheme = theme === 'night' ? 'dark' : 'light';
}

export const useThemeStore = defineStore('theme', () => {
    const theme = ref(load());
    apply(theme.value);

    function setTheme(value) {
        if (!THEMES.includes(value)) return;
        theme.value = value;
        try { localStorage.setItem(KEY, value); } catch {}
        apply(value);
    }

    return { theme, themes: THEMES, labels: THEME_LABELS, setTheme };
});
