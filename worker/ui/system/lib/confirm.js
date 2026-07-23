import { reactive } from 'vue';

// 全局确认弹窗(替代 window.confirm —— 客户端 WebView 不弹原生对话框,统一走应用内组件)。
// 用法:if (!(await confirmDialog({ title: '删除会话', message: '…', confirmText: '删除', danger: true }))) return;
// 视图由 system/components/ConfirmHost.vue 渲染,App.vue 全局挂载。
export const confirmState = reactive({
    open: false,
    title: '',
    message: '',
    confirmText: '确定',
    danger: false,
    _resolve: null,
});

export function confirmDialog({ title = '确认操作', message = '', confirmText = '确定', danger = false } = {}) {
    return new Promise((resolve) => {
        confirmState._resolve?.(false); // 罕见的叠开:上一个按「取消」收掉
        Object.assign(confirmState, { open: true, title, message, confirmText, danger, _resolve: resolve });
    });
}

export function settleConfirm(ok) {
    confirmState.open = false;
    confirmState._resolve?.(Boolean(ok));
    confirmState._resolve = null;
}
