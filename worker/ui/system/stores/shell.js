import { defineStore } from 'pinia';
import { ref } from 'vue';

// 全局壳:左侧栏在窄屏下的抽屉开关(桌面常驻,不走这个状态)
export const useShellStore = defineStore('shell', () => {
    const sidebarOpen = ref(false);
    const toggleSidebar = () => { sidebarOpen.value = !sidebarOpen.value; };
    const closeSidebar = () => { sidebarOpen.value = false; };
    return { sidebarOpen, toggleSidebar, closeSidebar };
});
