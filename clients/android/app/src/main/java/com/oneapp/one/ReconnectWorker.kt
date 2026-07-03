package com.oneapp.one

import android.content.Context
import android.content.Intent
import android.os.Build
import androidx.work.CoroutineWorker
import androidx.work.ExistingPeriodicWorkPolicy
import androidx.work.PeriodicWorkRequestBuilder
import androidx.work.WorkManager
import androidx.work.WorkerParameters
import com.oneapp.one.system.Config
import com.oneapp.one.system.Connection
import java.util.concurrent.TimeUnit

/**
 * 保活兜底:每 15 分钟检查一次设备通道;已配置但掉线(进程被杀/服务没起来)就拉起 DeviceService。
 * 系统限制起不来也不崩溃 —— 下个周期再试。
 */
class ReconnectWorker(ctx: Context, params: WorkerParameters) : CoroutineWorker(ctx, params) {

    override suspend fun doWork(): Result {
        val ctx = applicationContext
        if (Config.configured(ctx) && !Connection.online) {
            try {
                val svc = Intent(ctx, DeviceService::class.java)
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) ctx.startForegroundService(svc) else ctx.startService(svc)
            } catch (_: Exception) {
                // 后台启动前台服务可能被系统拒绝(Android 12+/15),等下次或用户打开 App
            }
        }
        return Result.success()
    }

    companion object {
        // 注册周期任务(KEEP:已注册就不重复)
        fun schedule(ctx: Context) {
            val req = PeriodicWorkRequestBuilder<ReconnectWorker>(15, TimeUnit.MINUTES).build()
            WorkManager.getInstance(ctx)
                .enqueueUniquePeriodicWork("one-reconnect", ExistingPeriodicWorkPolicy.KEEP, req)
        }
    }
}
