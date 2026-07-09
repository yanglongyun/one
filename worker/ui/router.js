import { createRouter, createWebHistory } from 'vue-router';
import { getToken } from '@/system/api';

// 应用全部平铺在 apps/<app>。设备能力页挂在 system/views/device,不算独立 app。
const routes = [
    { path: '/', redirect: '/chat' },
    { path: '/guard', name: 'guard', meta: { public: true }, component: () => import('./system/views/auth/GuardView.vue') },
    { path: '/setup', name: 'setup', meta: { public: true }, component: () => import('./system/views/auth/SetupView.vue') },

    // 内置应用
    { path: '/chat', name: 'chat', component: () => import('./apps/chat/index.vue') },
    { path: '/tasks', name: 'tasks', component: () => import('./apps/tasks/index.vue') },
    { path: '/tasks/:id', name: 'task-detail', component: () => import('./apps/tasks/detail.vue') },
    { path: '/schedules', name: 'schedules', component: () => import('./apps/schedules/index.vue') },
    { path: '/schedules/:id', name: 'schedule-detail', component: () => import('./apps/schedules/detail.vue') },
    { path: '/goals', name: 'goals', component: () => import('./apps/goals/index.vue') },
    { path: '/goals/:id', name: 'goal-detail', component: () => import('./apps/goals/detail.vue') },
    { path: '/memories', name: 'memories', component: () => import('./apps/memories/index.vue') },
    { path: '/settings', name: 'settings', component: () => import('./apps/settings/index.vue') },

    // 自定义应用(AI 生成的板块):运行页 + 创建引导
    { path: '/apps/new', name: 'app-create', component: () => import('./apps/app/create.vue') },
    { path: '/apps/:slug', name: 'app-run', component: () => import('./apps/app/index.vue') },

    // 设备:添加引导 + 详情
    { path: '/devices/new', name: 'device-add', component: () => import('./system/views/device/DeviceAdd.vue') },
    { path: '/devices/:name', name: 'device-detail', component: () => import('./system/views/device/DeviceDetail.vue') },

    // 电脑能力页(从设备详情进入,按设备 id 划分:/devices/<设备id>/<功能>)
    { path: '/devices/:dev/files', name: 'files', component: () => import('./system/views/device/files/index.vue') },
    { path: '/devices/:dev/status', name: 'status', component: () => import('./system/views/device/status/index.vue') },
    { path: '/devices/:dev/terminal', name: 'terminal', component: () => import('./system/views/device/terminal/index.vue') },

    { path: '/:pathMatch(.*)*', redirect: '/chat' },
];

export const router = createRouter({
    history: createWebHistory(),
    routes,
});

router.beforeEach((to) => {
    if (to.meta?.public) return true;
    if (!getToken()) return '/guard';
    return true;
});
