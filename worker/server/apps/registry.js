// 云端数据应用清单 —— 单一真相。
// apps 区路由读它分发;GET /api 读它列清单(前端侧边栏可派生于此)。
// 加一个数据应用 = 这里加一行 + 一个 apps/<name>/ 目录。
import messages from './messages/api.js';
import tasks from './tasks/api.js';
import schedules from './schedules/api.js';
import goals from './goals/api.js';
import settings from './settings/api.js';
import memories from './memories/api.js';
import notes from './notes/api.js';
import chats from './chats/api.js';

export const APPS = [
    { name: 'messages', label: '对话', icon: '💬', api: messages, nav: false },
    { name: 'tasks', label: '任务', icon: '⚡', api: tasks, nav: false },
    { name: 'schedules', label: '日程', icon: '⏰', api: schedules, nav: false },
    { name: 'goals', label: '目标', icon: '🎯', api: goals, nav: false },
    { name: 'memories', label: '记忆', icon: '🧠', api: memories, nav: false },
    { name: 'notes', label: '笔记', icon: '📝', api: notes, nav: false },
    { name: 'settings', label: '设置', icon: '⚙️', api: settings, nav: false },
    { name: 'chats', label: '会话', icon: '💬', api: chats, nav: false },
];

export const byName = Object.fromEntries(APPS.map((a) => [a.name, a]));

// 给前端的清单视图(只列进导航的数据应用)
export const manifest = () => APPS.filter((a) => a.nav !== false).map(({ name, label, icon }) => ({ name, label, icon }));
