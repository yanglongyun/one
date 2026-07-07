package com.oneapp.one

import android.annotation.SuppressLint
import android.content.ComponentName
import android.content.Intent
import android.graphics.Color
import android.graphics.Typeface
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.os.PowerManager
import android.provider.Settings
import android.text.InputType
import android.view.Gravity
import android.view.View
import android.widget.Button
import android.widget.EditText
import android.widget.LinearLayout
import android.widget.ScrollView
import android.widget.TextView
import android.widget.Toast
import androidx.appcompat.app.AppCompatActivity
import com.oneapp.one.system.Config
import com.oneapp.one.system.Connection

/**
 * 两步式连接(晴空软糖):
 *   第 1 步 · 连接   —— 品牌 + 三个输入(主域名 / 密码 / 设备名)+「下一步」
 *   第 2 步 · 授权与保活 —— 连接状态 + 无障碍 / 电池优化 / 自启动 / 后台锁定 +「进入 one」
 * 首次未配置从第 1 步开始;已配置(再次打开设置)直接落到第 2 步,可「‹ 修改连接信息」退回第 1 步。
 */
class SettingsActivity : AppCompatActivity() {

    private lateinit var step1: LinearLayout
    private lateinit var step2: LinearLayout

    private lateinit var workerIn: EditText
    private lateinit var passwordIn: EditText
    private lateinit var nameIn: EditText

    private lateinit var connPill: TextView
    private lateinit var axStatus: TextView
    private lateinit var batteryStatus: TextView

    private val okColor = Color.parseColor("#2E9E5B")
    private val warnColor = Color.parseColor("#D1622B")

    private fun dp(v: Int) = Ui.dp(this, v)

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        val scroll = ScrollView(this).apply {
            background = Ui.skyBackground()
            isFillViewport = true
        }
        val root = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            gravity = Gravity.CENTER_HORIZONTAL
            setPadding(dp(24), dp(44), dp(24), dp(40))
        }
        step1 = buildStep1()
        step2 = buildStep2()
        root.addView(step1)
        root.addView(step2)
        scroll.addView(root)
        setContentView(scroll)

        // 已配置 → 直接进第 2 步;全新未配置 → 从第 1 步
        showStep(if (Config.configured(this)) 2 else 1)
    }

    override fun onResume() {
        super.onResume()
        refreshStatus()
    }

    private fun showStep(n: Int) {
        step1.visibility = if (n == 1) View.VISIBLE else View.GONE
        step2.visibility = if (n == 2) View.VISIBLE else View.GONE
        if (n == 2) refreshStatus()
    }

    // ─────────── 第 1 步:连接 ───────────
    private fun buildStep1(): LinearLayout {
        val col = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            gravity = Gravity.CENTER_HORIZONTAL
        }
        col.addView(Ui.brandTile(this).apply { layoutParams = Ui.lp(dp(56), dp(56)) })
        col.addView(TextView(this).apply {
            text = "one"
            setTextColor(Ui.ink)
            textSize = 30f
            typeface = Typeface.create(Typeface.SERIF, Typeface.BOLD)
            gravity = Gravity.CENTER
            setPadding(0, dp(12), 0, 0)
        })
        col.addView(Ui.body(this, "连接到你的云端大脑").apply {
            gravity = Gravity.CENTER
            setPadding(0, dp(6), 0, dp(20))
        })

        val card = cardBox()
        workerIn = field("主域名 https://your-worker.example.com", false).apply {
            setText(Config.worker(this@SettingsActivity))
        }
        passwordIn = field("访问密码", true)
        nameIn = field("设备名(唯一,如 phone)", false).apply {
            setText(Config.name(this@SettingsActivity))
        }
        card.addView(label("主域名"))
        card.addView(workerIn)
        card.addView(label("访问密码", dp(14)))
        card.addView(passwordIn)
        card.addView(label("设备名", dp(14)))
        card.addView(nameIn)
        col.addView(card)

        col.addView(Ui.primaryButton(this, "下一步 →").apply {
            layoutParams = Ui.lp(LinearLayout.LayoutParams.MATCH_PARENT, dp(50), dp(20))
            setOnClickListener {
                val worker = workerIn.text.toString().trim()
                val name = nameIn.text.toString().trim()
                if (worker.isEmpty()) { toast("请填主域名"); return@setOnClickListener }
                if (name.isEmpty()) { toast("请给这台设备起个唯一的名字"); return@setOnClickListener }
                // 只保存,不进云端;执行臂随后自动连。滑到第 2 步授权
                Config.save(this@SettingsActivity, worker, passwordIn.text.toString(), name)
                startHand()
                showStep(2)
            }
        })
        return col
    }

    // ─────────── 第 2 步:授权与保活 ───────────
    private fun buildStep2(): LinearLayout {
        val col = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            visibility = View.GONE
        }
        col.addView(TextView(this).apply {
            text = "授权与保活"
            setTextColor(Ui.ink)
            textSize = 23f
            typeface = Typeface.DEFAULT_BOLD
            gravity = Gravity.CENTER
            setPadding(0, dp(4), 0, 0)
        })
        col.addView(TextView(this).apply {
            text = "授权后 one 才能替你操控这台手机,并常驻不被系统收走"
            setTextColor(Ui.muted)
            textSize = 12.5f
            gravity = Gravity.CENTER
            setPadding(dp(6), dp(6), dp(6), dp(14))
        })

        // 连接状态条
        val statusCard = cardBox().apply {
            orientation = LinearLayout.HORIZONTAL
            gravity = Gravity.CENTER_VERTICAL
            setPadding(dp(18), dp(14), dp(18), dp(14))
        }
        statusCard.addView(TextView(this).apply {
            text = "设备通道"
            setTextColor(Ui.ink)
            textSize = 14f
            typeface = Typeface.DEFAULT_BOLD
        })
        statusCard.addView(View(this), LinearLayout.LayoutParams(0, 1, 1f))
        connPill = TextView(this).apply {
            textSize = 12.5f
            typeface = Typeface.DEFAULT_BOLD
        }
        statusCard.addView(connPill)
        col.addView(statusCard)

        // 无障碍
        axStatus = statusText()
        col.addView(permCard(
            "无障碍权限",
            "one 靠它点按屏幕、输入文字 —— 没有它这只「手」动不了",
            axStatus,
            "去开启",
        ) { runCatching { startActivity(Intent(Settings.ACTION_ACCESSIBILITY_SETTINGS)) } })

        // 电池优化
        batteryStatus = statusText()
        col.addView(permCard(
            "忽略电池优化",
            "让系统别在后台掐掉 one 的网络与运行",
            batteryStatus,
            "去豁免",
        ) { requestIgnoreBattery() })

        // 厂商自启动
        col.addView(permCard(
            "厂商自启动",
            "允许 one 被系统 / 开机自动拉起(各家入口不同,找不到时退到应用详情页)",
            null,
            "去开启",
        ) { openAutoStartSettings() })

        // 后台锁定(纯说明)
        col.addView(permCard(
            "后台锁定",
            "打开最近任务,长按或下拉 one 的卡片选「锁定」,防一键清理误杀",
            null,
            null,
        ) {})

        col.addView(Ui.primaryButton(this, "进入 one").apply {
            layoutParams = Ui.lp(LinearLayout.LayoutParams.MATCH_PARENT, dp(50), dp(22))
            setOnClickListener {
                startActivity(Intent(this@SettingsActivity, MainActivity::class.java).apply {
                    flags = Intent.FLAG_ACTIVITY_CLEAR_TOP or Intent.FLAG_ACTIVITY_SINGLE_TOP
                })
                finish()
            }
        })
        col.addView(TextView(this).apply {
            text = "‹ 修改连接信息"
            setTextColor(Ui.muted)
            textSize = 13f
            typeface = Typeface.DEFAULT_BOLD
            gravity = Gravity.CENTER
            setPadding(0, dp(16), 0, 0)
            setOnClickListener { showStep(1) }
        })
        return col
    }

    private fun refreshStatus() {
        if (!::connPill.isInitialized) return
        val on = Connection.online
        connPill.text = if (on) "● 在线" else "● 离线"
        connPill.setTextColor(if (on) Ui.online else Ui.offline)

        val ax = accessibilityEnabled()
        axStatus.text = if (ax) "状态:已开启 ✓" else "状态:未开启"
        axStatus.setTextColor(if (ax) okColor else warnColor)

        val bat = isIgnoringBattery()
        batteryStatus.text = if (bat) "状态:已豁免 ✓" else "状态:未豁免"
        batteryStatus.setTextColor(if (bat) okColor else warnColor)
    }

    // ─────────── UI 小工具 ───────────
    private fun cardBox(): LinearLayout = LinearLayout(this).apply {
        orientation = LinearLayout.VERTICAL
        background = Ui.cardBackground(this@SettingsActivity)
        setPadding(dp(20), dp(20), dp(20), dp(20))
        layoutParams = Ui.lp(LinearLayout.LayoutParams.MATCH_PARENT, LinearLayout.LayoutParams.WRAP_CONTENT, dp(14))
        Ui.applyCardElevation(this, this@SettingsActivity)
    }

    /** 条目卡片:标题 + 说明 +(状态)+(按钮),按钮右对齐。 */
    private fun permCard(title: String, desc: String, statusView: TextView?, buttonText: String?, onClick: () -> Unit): LinearLayout {
        val card = cardBox().apply { setPadding(dp(18), dp(16), dp(18), dp(16)) }
        card.addView(TextView(this).apply {
            text = title
            setTextColor(Ui.ink)
            textSize = 15f
            typeface = Typeface.DEFAULT_BOLD
        })
        card.addView(TextView(this).apply {
            text = desc
            setTextColor(Ui.muted)
            textSize = 12.5f
            setPadding(0, dp(4), 0, 0)
        })
        statusView?.let { card.addView(it) }
        if (buttonText != null) {
            card.addView(Ui.primaryButton(this, buttonText).apply {
                textSize = 13f
                layoutParams = LinearLayout.LayoutParams(dp(112), dp(40)).apply {
                    topMargin = dp(12)
                    gravity = Gravity.END
                }
                setOnClickListener { onClick() }
            })
        }
        return card
    }

    private fun statusText(): TextView = TextView(this).apply {
        textSize = 12.5f
        setPadding(0, dp(8), 0, 0)
    }

    private fun label(text: String, top: Int = 0): TextView = TextView(this).apply {
        this.text = text
        setTextColor(Ui.ink)
        textSize = 12.5f
        typeface = Typeface.DEFAULT_BOLD
        setPadding(dp(2), top, 0, dp(6))
    }

    private fun field(hint: String, password: Boolean): EditText = EditText(this).apply {
        this.hint = hint
        background = Ui.fieldBackground(this@SettingsActivity)
        setHintTextColor(Ui.muted)
        setTextColor(Ui.ink)
        textSize = 14f
        setSingleLine()
        setPadding(dp(14), dp(12), dp(14), dp(12))
        if (password) inputType = InputType.TYPE_CLASS_TEXT or InputType.TYPE_TEXT_VARIATION_PASSWORD
        layoutParams = Ui.lp(LinearLayout.LayoutParams.MATCH_PARENT, dp(48))
    }

    private fun toast(msg: String) = Toast.makeText(this, msg, Toast.LENGTH_SHORT).show()

    private fun startHand() {
        val svc = Intent(this, DeviceService::class.java)
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) startForegroundService(svc) else startService(svc)
    }

    private fun accessibilityEnabled(): Boolean {
        val enabled = Settings.Secure.getString(contentResolver, Settings.Secure.ENABLED_ACCESSIBILITY_SERVICES) ?: return false
        return enabled.split(':').any { it.startsWith("$packageName/") }
    }

    // ─────────── 电池优化 ───────────
    private fun isIgnoringBattery(): Boolean =
        getSystemService(PowerManager::class.java).isIgnoringBatteryOptimizations(packageName)

    @SuppressLint("BatteryLife")
    private fun requestIgnoreBattery() {
        if (isIgnoringBattery()) { refreshStatus(); return }
        try {
            startActivity(Intent(Settings.ACTION_REQUEST_IGNORE_BATTERY_OPTIMIZATIONS, Uri.parse("package:$packageName")))
        } catch (_: Exception) {
            try { startActivity(Intent(Settings.ACTION_IGNORE_BATTERY_OPTIMIZATION_SETTINGS)) } catch (_: Exception) {}
        }
    }

    // ─────────── 厂商自启动(逐级回退,永不崩溃) ───────────
    private fun openAutoStartSettings() {
        val brand = (Build.MANUFACTURER + Build.BRAND).lowercase()
        val candidates = mutableListOf<Intent>()
        fun comp(pkg: String, cls: String) { candidates.add(Intent().setComponent(ComponentName(pkg, cls))) }
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
        candidates.add(Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS, Uri.parse("package:$packageName")))
        for (intent in candidates) {
            try {
                if (intent.resolveActivity(packageManager) != null) { startActivity(intent); return }
            } catch (_: Exception) { /* 逐个回退 */ }
        }
        try { startActivity(Intent(Settings.ACTION_SETTINGS)) } catch (_: Exception) {}
    }
}
