package com.oneapp.one

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.Intent
import android.os.Build
import android.os.IBinder
import com.oneapp.one.system.Connection

/**
 * 手(前台服务外壳):维持与云端 worker 的连接。连接/重连/派发逻辑在 system.Connection,
 * 工具执行在 apps.Control —— 与 worker / 桌面 / 插件同一套 system + apps 心智模型。
 * 窗口/进程在,手就在;连接用「主域名 + token」(见 system.Config)。
 */
class DeviceService : Service() {

    private var conn: Connection? = null

    override fun onBind(intent: Intent?): IBinder? = null

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        startForeground(1, buildNotification())
        if (conn == null) {
            conn = Connection(applicationContext)
            conn?.start()
        }
        return START_STICKY
    }

    override fun onDestroy() {
        conn?.stop()
        conn = null
        super.onDestroy()
    }

    private fun buildNotification(): Notification {
        val channelId = "one-device"
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val nm = getSystemService(NotificationManager::class.java)
            nm.createNotificationChannel(
                NotificationChannel(channelId, "one 设备", NotificationManager.IMPORTANCE_LOW)
            )
        }
        // 点击通知 → 打开设置页
        val tap = PendingIntent.getActivity(
            this, 0,
            Intent(this, SettingsActivity::class.java).apply {
                flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP
            },
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
        )
        return Notification.Builder(this, channelId)
            .setContentTitle("one")
            .setContentText("这台安卓正作为云端 AI 的一只手待命")
            .setSmallIcon(android.R.drawable.ic_menu_compass)
            .setContentIntent(tap)
            .build()
    }
}
