package com.oneapp.one.apps

import android.content.Context
import android.content.Intent
import android.os.Build
import com.oneapp.one.HandAccessibilityService
import org.json.JSONObject

// 安卓控制 app:安卓控制工具统一使用 android_* 前缀。
// 经无障碍服务(HandAccessibilityService)出手。
object Control {
    fun owns(name: String): Boolean = name.startsWith("android_")

    fun run(ctx: Context, name: String, args: JSONObject): JSONObject {
        val hand = HandAccessibilityService.instance
        return when (name) {
            // 读屏:返回当前界面的可交互元素(文字+坐标),AI 据此决定点哪
            "android_screen" -> {
                hand ?: return notReady()
                JSONObject().put("elements", hand.dumpScreen())
            }

            // 点击:优先按文字(稳),否则按坐标
            "android_tap" -> {
                hand ?: return notReady()
                val text = args.optString("text")
                val ok = if (text.isNotEmpty()) {
                    hand.tapByText(text)
                } else {
                    hand.tap(args.optDouble("x", 0.0).toFloat(), args.optDouble("y", 0.0).toFloat()); true
                }
                if (ok) JSONObject().put("ok", true) else JSONObject().put("error", "没找到文字为「$text」的元素")
            }

            "android_type" -> {
                hand ?: return notReady()
                JSONObject().put("ok", hand.typeText(args.optString("text")))
            }

            "android_swipe" -> {
                hand ?: return notReady()
                hand.swipe(
                    args.optDouble("x1").toFloat(), args.optDouble("y1").toFloat(),
                    args.optDouble("x2").toFloat(), args.optDouble("y2").toFloat()
                )
                JSONObject().put("ok", true)
            }

            // 全局键:back / home / recents / notifications
            "android_key" -> {
                hand ?: return notReady()
                JSONObject().put("ok", hand.global(args.optString("key")))
            }

            "android_open_app" -> {
                val pkg = args.optString("name")
                val intent = ctx.packageManager.getLaunchIntentForPackage(pkg)
                if (intent == null) {
                    JSONObject().put("error", "找不到应用包名: $pkg(安卓需传 package name)")
                } else {
                    intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
                    ctx.startActivity(intent)
                    JSONObject().put("ok", true)
                }
            }

            "android_status" -> JSONObject()
                .put("platform", "android")
                .put("model", Build.MODEL)
                .put("sdk", Build.VERSION.SDK_INT)
                .put("accessibility", hand != null)

            else -> JSONObject().put("error", "android 暂未实现工具: $name")
        }
    }

    private fun notReady() =
        JSONObject().put("error", "无障碍服务未开启。请到 设置→无障碍→one 打开。")
}
