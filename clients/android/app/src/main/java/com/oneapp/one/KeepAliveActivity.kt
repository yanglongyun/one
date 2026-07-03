package com.oneapp.one

import android.annotation.SuppressLint
import android.content.ComponentName
import android.content.Intent
import android.graphics.Color
import android.graphics.Typeface
import android.graphics.drawable.GradientDrawable
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.os.PowerManager
import android.provider.Settings
import android.view.Gravity
import android.widget.Button
import android.widget.LinearLayout
import android.widget.TextView
import androidx.appcompat.app.AppCompatActivity

/**
 * 保活设置:三件事让「手」常在 —— 忽略电池优化、厂商自启动、后台锁定。
 * 视觉沿用 MainActivity 的晴空主题(纯代码 View,不引入布局资源)。
 */
class KeepAliveActivity : AppCompatActivity() {

    private val accent = Ui.candy
    private val accentD = Ui.candyD
    private val ink = Ui.ink
    private val muted = Ui.muted

    private lateinit var batteryStatus: TextView

    private fun dp(v: Int) = Ui.dp(this, v)

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        val root = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            setPadding(dp(24), dp(40), dp(24), dp(40))
            background = Ui.skyBackground()
        }

        root.addView(TextView(this).apply {
            text = "保活设置"
            setTextColor(ink)
            textSize = 24f
            typeface = Typeface.create(Typeface.SERIF, Typeface.BOLD)
        })
        root.addView(TextView(this).apply {
            text = "做完这三步,这只「手」才不容易被系统收走"
            setTextColor(muted)
            textSize = 12.5f
            setPadding(0, dp(6), 0, dp(18))
        })

        // 1. 忽略电池优化
        batteryStatus = TextView(this)
        root.addView(card(
            "忽略电池优化",
            "让系统不在后台限制 one 的网络与运行",
            statusView = batteryStatus,
            buttonText = "去豁免",
        ) { requestIgnoreBattery() })

        // 2. 自启动权限
        root.addView(card(
            "自启动权限",
            "允许 one 被系统/开机自动拉起(各厂商入口不同,找不到时会退到应用详情页)",
            statusView = null,
            buttonText = "去开启",
        ) { openAutoStartSettings() })

        // 3. 后台锁定(纯说明)
        root.addView(card(
            "后台锁定",
            "打开最近任务,长按或下拉 one 的卡片,选择「锁定」,防止一键清理误杀",
            statusView = null,
            buttonText = null,
        ) {})

        setContentView(root)
    }

    override fun onResume() {
        super.onResume()
        refreshBatteryStatus()
    }

    // ---- 条目卡片:标题 + 说明 + (状态)+ (按钮) ----
    private fun card(title: String, desc: String, statusView: TextView?, buttonText: String?, onClick: () -> Unit): LinearLayout {
        val col = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            background = Ui.cardBackground(this@KeepAliveActivity)
            setPadding(dp(18), dp(16), dp(18), dp(16))
            layoutParams = LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, LinearLayout.LayoutParams.WRAP_CONTENT)
                .apply { topMargin = dp(14) }
        }
        Ui.applyCardElevation(col, this)
        col.addView(TextView(this).apply {
            text = title
            setTextColor(ink)
            textSize = 15f
            typeface = Typeface.DEFAULT_BOLD
        })
        col.addView(TextView(this).apply {
            text = desc
            setTextColor(muted)
            textSize = 12.5f
            setPadding(0, dp(4), 0, 0)
        })
        statusView?.let {
            it.textSize = 12.5f
            it.setPadding(0, dp(6), 0, 0)
            col.addView(it)
        }
        if (buttonText != null) {
            col.addView(Button(this).apply {
                text = buttonText
                setTextColor(Color.WHITE)
                textSize = 13f
                isAllCaps = false
                stateListAnimator = null
                background = GradientDrawable(
                    GradientDrawable.Orientation.TL_BR, intArrayOf(accent, accentD),
                ).apply { cornerRadius = dp(Ui.buttonRadius).toFloat() }
                layoutParams = LinearLayout.LayoutParams(dp(120), dp(40)).apply {
                    topMargin = dp(10)
                    gravity = Gravity.END
                }
                setOnClickListener { onClick() }
            })
        }
        return col
    }

    // ---- 1. 电池优化 ----
    private fun isIgnoringBattery(): Boolean =
        getSystemService(PowerManager::class.java).isIgnoringBatteryOptimizations(packageName)

    private fun refreshBatteryStatus() {
        val ok = isIgnoringBattery()
        batteryStatus.text = if (ok) "状态:已豁免 ✓" else "状态:未豁免"
        batteryStatus.setTextColor(if (ok) Color.parseColor("#2e9e5b") else Color.parseColor("#d1622b"))
    }

    @SuppressLint("BatteryLife")
    private fun requestIgnoreBattery() {
        if (isIgnoringBattery()) { refreshBatteryStatus(); return }
        try {
            startActivity(Intent(Settings.ACTION_REQUEST_IGNORE_BATTERY_OPTIMIZATIONS, Uri.parse("package:$packageName")))
        } catch (_: Exception) {
            // 个别 ROM 没有该弹窗,退到电池优化列表
            try { startActivity(Intent(Settings.ACTION_IGNORE_BATTERY_OPTIMIZATION_SETTINGS)) } catch (_: Exception) {}
        }
    }

    // ---- 2. 厂商自启动设置(逐级回退,永不崩溃) ----
    private fun openAutoStartSettings() {
        val brand = (Build.MANUFACTURER + Build.BRAND).lowercase()
        val candidates = mutableListOf<Intent>()
        fun comp(pkg: String, cls: String) {
            candidates.add(Intent().setComponent(ComponentName(pkg, cls)))
        }
        when {
            brand.contains("xiaomi") || brand.contains("redmi") ->
                comp("com.miui.securitycenter", "com.miui.permcenter.autostart.AutoStartManagementActivity")
            brand.contains("huawei") || brand.contains("honor") -> {
                comp("com.huawei.systemmanager", "com.huawei.systemmanager.startupmgr.ui.StartupNormalAppListActivity")
                comp("com.huawei.systemmanager", "com.huawei.systemmanager.appcontrol.activity.StartupAppControlActivity")
                comp("com.hihonor.systemmanager", "com.hihonor.systemmanager.startupmgr.ui.StartupNormalAppListActivity")
            }
            brand.contains("oppo") || brand.contains("realme") || brand.contains("oneplus") -> {
                comp("com.coloros.safecenter", "com.coloros.safecenter.startupapp.StartupAppListActivity")
                comp("com.oppo.safe", "com.oppo.safe.permission.startup.StartupAppListActivity")
                comp("com.oneplus.security", "com.oneplus.security.chainlaunch.view.ChainLaunchAppListActivity")
            }
            brand.contains("vivo") || brand.contains("iqoo") -> {
                comp("com.vivo.permissionmanager", "com.vivo.permissionmanager.activity.BgStartUpManagerActivity")
                comp("com.iqoo.secure", "com.iqoo.secure.ui.phoneoptimize.BgStartUpManager")
            }
            brand.contains("samsung") ->
                comp("com.samsung.android.lool", "com.samsung.android.sm.battery.ui.BatteryActivity")
        }
        // 兜底:应用详情页
        candidates.add(Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS, Uri.parse("package:$packageName")))
        for (intent in candidates) {
            try {
                if (intent.resolveActivity(packageManager) != null) { startActivity(intent); return }
            } catch (_: Exception) { /* 逐个回退 */ }
        }
        // 连详情页都失败就打开系统设置(几乎不可能到这)
        try { startActivity(Intent(Settings.ACTION_SETTINGS)) } catch (_: Exception) {}
    }
}
