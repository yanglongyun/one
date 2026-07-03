package com.oneapp.one.system

import android.content.Context
import com.oneapp.one.BuildConfig
import java.net.URLEncoder

// 配置:所有客户端统一「主域名 + 密码」两字段(密码 = 网页访问密码,存 SharedPreferences)。
// 主域名缺省回退编译期默认(BuildConfig.WORKER_URL),密码未设则留空。
object Config {
    private fun prefs(ctx: Context) = ctx.getSharedPreferences("one-device", Context.MODE_PRIVATE)

    fun worker(ctx: Context): String =
        (prefs(ctx).getString("worker", null) ?: BuildConfig.WORKER_URL).trim().trimEnd('/')

    fun password(ctx: Context): String = (prefs(ctx).getString("password", "") ?: "").trim()

    // 设备名(唯一,寻址键):缺省回退机型
    fun name(ctx: Context): String =
        (prefs(ctx).getString("name", "") ?: "").trim().ifEmpty { android.os.Build.MODEL }

    // 是否已完成首次设置(密码可为空,故用单独标记)
    fun configured(ctx: Context): Boolean = prefs(ctx).getBoolean("ready", false)

    fun save(ctx: Context, worker: String, password: String, name: String) {
        prefs(ctx).edit()
            .putString("worker", worker.trim().trimEnd('/'))
            .putString("password", password.trim())
            .putString("name", name.trim())
            .putBoolean("ready", true)
            .apply()
    }

    // 主域名 → 系统实时 WS 地址(role=device,密码即凭证):https→wss / http→ws
    fun wsUrl(ctx: Context): String {
        val w = worker(ctx)
        val base = when {
            w.startsWith("https") -> "wss" + w.substring(5)
            w.startsWith("http") -> "ws" + w.substring(4)
            else -> "wss://$w"
        }
        return "$base/api/realtime/ws?password=${URLEncoder.encode(password(ctx), "UTF-8")}&role=device"
    }
}
