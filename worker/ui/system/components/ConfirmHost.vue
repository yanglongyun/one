<script setup>
// 全局确认弹窗宿主:视觉走全局 .modal 体系;状态与 promise 在 system/lib/confirm.js。
import { confirmState, settleConfirm } from '@/system/lib/confirm';
</script>

<template>
    <Teleport to="body">
        <div v-if="confirmState.open" class="modal-mask" @click.self="settleConfirm(false)">
            <div class="modal confirm-modal">
                <div class="modal-title">{{ confirmState.title }}</div>
                <div class="confirm-msg">{{ confirmState.message }}</div>
                <div class="modal-foot">
                    <button class="btn btn-plain" @click="settleConfirm(false)">取消</button>
                    <button class="btn" :class="confirmState.danger ? 'btn-danger' : 'btn-primary'" @click="settleConfirm(true)">
                        {{ confirmState.confirmText }}
                    </button>
                </div>
            </div>
        </div>
    </Teleport>
</template>

<style>
.confirm-modal { width: min(380px, 100%); }
.confirm-msg { font-size: 13.5px; line-height: 1.7; color: var(--ink2); }
</style>
