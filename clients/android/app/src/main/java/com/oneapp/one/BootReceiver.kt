package com.oneapp.one

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.os.Build
import com.oneapp.one.system.Config

/**
 * 开机拉起:BOOT_COMPLETED 后尝试起 DeviceService。
 * Android 15 起 BOOT 时不能直接起 dataSync 前台服务 —— 失败就静默,交给 ReconnectWorker 兜底。
 */
class BootReceiver : BroadcastReceiver() {
    override fun onReceive(ctx: Context, intent: Intent) {
        if (intent.action != Intent.ACTION_BOOT_COMPLETED) return
        if (!Config.configured(ctx)) return
        ReconnectWorker.schedule(ctx) // 无论如何先把周期兜底挂上
        try {
            val svc = Intent(ctx, DeviceService::class.java)
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) ctx.startForegroundService(svc) else ctx.startService(svc)
        } catch (_: Exception) {
            // 系统不允许(如 Android 15 对 dataSync 的 BOOT 限制),不崩溃
        }
    }
}
