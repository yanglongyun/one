<script setup>
// 工具行:面包屑(可点回上级)+ 目录内搜索。逻辑走 files store。
import { computed } from 'vue';
import { useFilesStore } from '@/system/views/device/files/store';
import Icon from '@/system/components/Icon.vue';

const files = useFilesStore();
const hereName = computed(() => files.breadcrumbs[files.breadcrumbs.length - 1]?.label || '');
</script>

<template>
    <div class="toolrow">
        <div class="crumbs">
            <template v-for="(crumb, i) in files.breadcrumbs" :key="i + crumb.path">
                <button class="crumb" :class="{ here: i === files.breadcrumbs.length - 1 }"
                    @click="files.navigate(crumb.path)">
                    {{ crumb.label }}
                </button>
                <span v-if="i < files.breadcrumbs.length - 1 && crumb.label !== '/'" class="crumb-sep">/</span>
            </template>
        </div>
        <label class="searchbox">
            <Icon name="search" style="width:15px;height:15px;flex-shrink:0" />
            <input v-model="files.filterText" type="text"
                :placeholder="hereName && hereName !== '/' ? `在 ${hereName} 里搜…` : '搜索…'"
                autocomplete="off" autocapitalize="off" autocorrect="off" spellcheck="false">
        </label>
    </div>
</template>

<style scoped>
.toolrow { display: flex; align-items: center; gap: 12px; margin-bottom: 14px; }
.crumbs { flex: 1; min-width: 0; display: flex; align-items: center; gap: 2px; font-size: 13px; overflow: hidden; white-space: nowrap; }
.crumb {
    color: var(--ink-3); font-weight: 600;
    padding: 4px 7px; border-radius: 8px;
    transition: background .15s, color .15s;
}
.crumb:hover { background: var(--panel); color: var(--candy-deep); box-shadow: var(--shadow-s); }
.crumb.here { color: var(--ink); font-weight: 800; }
.crumb-sep { color: var(--ink-4); font-weight: 500; padding: 0 1px; user-select: none; }
.searchbox {
    flex-shrink: 0;
    display: flex; align-items: center; gap: 7px;
    width: 220px; height: 34px; padding: 0 11px;
    background: var(--panel); border-radius: 12px;
    box-shadow: var(--shadow-s);
    color: var(--ink-3);
    transition: box-shadow .18s var(--ease);
}
.searchbox:focus-within { box-shadow: var(--shadow-m), 0 0 0 3px var(--candy-ring); }
.searchbox input { flex: 1; min-width: 0; border: 0; outline: 0; background: transparent; font-size: 12.5px; }
.searchbox input::placeholder { color: var(--ink-4); }

@media (max-width: 640px) {
    .toolrow { flex-wrap: wrap; }
    .searchbox { width: 100%; }
}
</style>
