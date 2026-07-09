<script setup>
// 内联 SVG 图标库(晴空软糖 · 圆头线条)。用法:<Icon name="chat" />
// 尺寸随容器:外层 span 100%,由父元素决定大小(如 .icon-btn svg / .tile svg 已有规则)。
import { computed } from 'vue';

const props = defineProps({ name: { type: String, required: true } });

const S = (d, extra = '') =>
    `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" ${extra}>${d}</svg>`;

const ICONS = {
    chat: S('<path d="M21 11.5a8.4 8.4 0 0 1-8.5 8.3 8.9 8.9 0 0 1-3.2-.6L4 20.5l1.4-4A8 8 0 0 1 4 11.5 8.4 8.4 0 0 1 12.5 3.2 8.4 8.4 0 0 1 21 11.5z"/>'),
    tasks: S('<path d="M13 2.5 4.5 13.5H11l-1 8 8.5-11H12z"/>'),
    schedule: S('<circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/>'),
    goals: S('<circle cx="12" cy="12" r="8.5"/><circle cx="12" cy="12" r="4.5"/><circle cx="12" cy="12" r="1" fill="currentColor" stroke="none"/>'),
    memory: S('<path d="M12 3.8c-4 0-6.8 2.7-6.8 6.2 0 2 .9 3.6 2.3 4.7l-.6 3.6 3.3-1.6c.6.1 1.2.2 1.8.2 4 0 6.8-2.7 6.8-6.4S16 3.8 12 3.8z"/><path d="M9.5 10h5M9.5 13h3"/>'),
    notes: S('<path d="M6 3.5h9.5L20 8v12.5H6z"/><path d="M15 3.5V8.5H20M9.5 13h5M9.5 16.5h3.5"/>'),
    settings: S('<circle cx="12" cy="12" r="3.2"/><path d="M19 12a7 7 0 0 0-.1-1.2l2-1.5-2-3.4-2.3 1a7 7 0 0 0-2-1.2L14.2 3h-4l-.4 2.7a7 7 0 0 0-2 1.2l-2.3-1-2 3.4 2 1.5a7 7 0 0 0 0 2.4l-2 1.5 2 3.4 2.3-1a7 7 0 0 0 2 1.2l.4 2.7h4l.4-2.7a7 7 0 0 0 2-1.2l2.3 1 2-3.4-2-1.5c.1-.4.1-.8.1-1.2z"/>'),
    timeline: S('<path d="M6 4.5v15"/><circle cx="6" cy="7.5" r="1.6" fill="currentColor" stroke="none"/><circle cx="6" cy="13" r="1.6" fill="currentColor" stroke="none"/><path d="M10.5 7.5H19M10.5 13h5.5M10.5 18h7"/><circle cx="6" cy="18" r="1.6" fill="currentColor" stroke="none"/>'),
    bolt: S('<path d="M13 2.5 4.5 13.5H11l-1 8 8.5-11H12z"/>'),
    boltFill: '<svg viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"><path d="M12.8 3 5.6 13.2h4.9l-1.2 7.8 7.1-10.2h-4.9z"/></svg>',
    grid: '<svg viewBox="0 0 24 24" fill="currentColor"><circle cx="6" cy="6" r="2"/><circle cx="12" cy="6" r="2"/><circle cx="18" cy="6" r="2"/><circle cx="6" cy="12" r="2"/><circle cx="12" cy="12" r="2"/><circle cx="18" cy="12" r="2"/><circle cx="6" cy="18" r="2"/><circle cx="12" cy="18" r="2"/><circle cx="18" cy="18" r="2"/></svg>',
    laptop: S('<rect x="4" y="5" width="16" height="11" rx="2"/><path d="M2.5 19.5h19"/>'),
    phone: S('<rect x="7.5" y="3" width="9" height="18" rx="2.5"/><path d="M11 17.8h2"/>'),
    puzzle: S('<path d="M10 4.5a1.8 1.8 0 1 1 3.6 0H17a1.5 1.5 0 0 1 1.5 1.5v3.2a1.8 1.8 0 1 0 0 3.6V16a1.5 1.5 0 0 1-1.5 1.5h-3.2a1.8 1.8 0 1 0-3.6 0H7A1.5 1.5 0 0 1 5.5 16v-3.4a1.8 1.8 0 1 1 0-3.6V6A1.5 1.5 0 0 1 7 4.5z"/>'),
    folder: S('<path d="M3.5 6.5a2 2 0 0 1 2-2h4l2 2.5H18.5a2 2 0 0 1 2 2v8.5a2 2 0 0 1-2 2h-13a2 2 0 0 1-2-2z"/>'),
    gauge: S('<path d="M4 13.5a8 8 0 1 1 16 0"/><path d="M12 13.5 15.5 10"/><path d="M4.5 18h15"/>'),
    menu: S('<path d="M4.5 7h15M4.5 12h15M4.5 17h9"/>'),
    back: S('<polyline points="14.5 6 8.5 12 14.5 18"/>'),
    plus: S('<path d="M12 5.5v13M5.5 12h13"/>'),
    send: S('<path d="M12 19V6M6 11.5 12 5.5l6 6"/>', 'stroke-width="2.2"'),
    clip: S('<path d="M20 11.5 12.2 19.3a5 5 0 0 1-7-7l8-8a3.4 3.4 0 0 1 4.8 4.8L10.4 16.7a1.8 1.8 0 0 1-2.6-2.6l7.3-7.2"/>'),
    spark: S('<path d="M12 3.5 13.8 9l5.7 1.8-5.7 1.8L12 18.4l-1.8-5.8L4.5 10.8 10.2 9z"/>'),
    search: S('<circle cx="11" cy="11" r="6.5"/><path d="m20 20-4.4-4.4"/>'),
    trash: S('<path d="M5 7h14M9.5 7V4.5h5V7M7 7l.8 13h8.4L17 7M10 11v5M14 11v5"/>'),
    pencil: S('<path d="m14.5 5.5 4 4L8 20l-4.6 1L4.5 16.4z"/><path d="m12.5 7.5 4 4"/>'),
    pin: S('<path d="M9 4.5h6l-.8 6 3.3 3.5H6.5L9.8 10.5z"/><path d="M12 14v6"/>'),
    check: S('<polyline points="5.5 12.5 10 17 18.5 7.5"/>', 'stroke-width="2.2"'),
    clock: S('<circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/>'),
    hand: S('<path d="M8 12.5V6.8a1.4 1.4 0 0 1 2.8 0V11m0-5.5a1.4 1.4 0 0 1 2.8 0V11m0-4a1.4 1.4 0 0 1 2.8 0v7.2c0 3.6-2.2 6-5.6 6-2.8 0-4.2-1.4-5.6-4L4 12.6a1.5 1.5 0 0 1 2.5-1.6L8 13"/>'),
    robot: S('<rect x="5" y="8" width="14" height="10.5" rx="3"/><path d="M12 8V4.5M9 13h.01M15 13h.01"/><circle cx="12" cy="3.8" r="1"/>'),
    link: S('<path d="M9.5 14.5 14.5 9.5M8 11l-2.4 2.4a3.6 3.6 0 0 0 5 5.1L13 16M11 8l2.4-2.4a3.6 3.6 0 0 1 5.1 5L16 13"/>'),
    eye: S('<path d="M2.5 12S6 5.8 12 5.8 21.5 12 21.5 12 18 18.2 12 18.2 2.5 12 2.5 12z"/><circle cx="12" cy="12" r="2.8"/>'),
    terminal: S('<rect x="3.5" y="4.5" width="17" height="15" rx="2.5"/><path d="m7.5 9 2.5 2.5L7.5 14M12.5 14h4"/>'),
    x: S('<path d="m7 7 10 10M17 7 7 17"/>'),
    copy: S('<rect x="8" y="8" width="11" height="11" rx="2"/><path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2"/>'),
    eraser: S('<path d="m16.5 4.5 3 3a2 2 0 0 1 0 2.8L11 18.8a2 2 0 0 1-2.8 0l-3-3a2 2 0 0 1 0-2.8l8.5-8.5a2 2 0 0 1 2.8 0z"/><path d="m9 9 6 6M11 19h9"/>'),
    minus: S('<path d="M5.5 12h13"/>'),
    refresh: S('<path d="M19 7V3.8l-2.2 2.1A8 8 0 1 0 20 12"/>'),
    keyboard: S('<rect x="3" y="6" width="18" height="12" rx="2.5"/><path d="M7 10h.01M10.5 10h.01M14 10h.01M17.5 10h.01M7 13.5h.01M10.5 13.5h7"/>'),
    sun: S('<circle cx="12" cy="12" r="3.5"/><path d="M12 2.5v2M12 19.5v2M2.5 12h2M19.5 12h2M5.3 5.3l1.4 1.4M17.3 17.3l1.4 1.4M18.7 5.3l-1.4 1.4M6.7 17.3l-1.4 1.4"/>'),
    moon: S('<path d="M20 15.2A8.4 8.4 0 0 1 8.8 4a8.5 8.5 0 1 0 11.2 11.2z"/>'),
    star: S('<path d="m12 4 2.4 5 5.6.7-4.1 3.8 1 5.5-4.9-2.7L7.1 19l1-5.5L4 9.7 9.6 9z"/>'),
    doc: S('<path d="M6 3.5h9.5L20 8v12.5H6z"/><path d="M15 3.5V8.5H20"/>'),
    battery: S('<rect x="3" y="8" width="15" height="8.5" rx="2"/><path d="M21 11v2.5"/><rect x="5" y="10" width="7" height="4.5" rx="1" fill="currentColor" stroke="none"/>'),
    wifi: S('<path d="M4 9.5a12 12 0 0 1 16 0M7 13a8 8 0 0 1 10 0M9.8 16.2a4 4 0 0 1 4.4 0"/><circle cx="12" cy="19" r="1" fill="currentColor" stroke="none"/>'),
    stopSq: '<svg viewBox="0 0 24 24" fill="currentColor"><rect x="7" y="7" width="10" height="10" rx="2.5"/></svg>',
};

const html = computed(() => ICONS[props.name] || '');
</script>

<template>
    <span class="o-icon" aria-hidden="true" v-html="html"></span>
</template>

<style scoped>
/* 默认跟随文字大小(1em);容器可用内联 style 或外部 .o-icon 规则覆盖 */
.o-icon { display: inline-block; width: 1em; height: 1em; flex-shrink: 0; }
.o-icon :deep(svg) { width: 100%; height: 100%; display: block; }
</style>
