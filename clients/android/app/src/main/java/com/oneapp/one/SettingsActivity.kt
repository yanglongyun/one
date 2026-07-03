package com.oneapp.one

import android.content.Intent
import android.provider.Settings
import android.os.Build
import android.os.Bundle
import android.text.InputType
import android.view.Gravity
import android.widget.EditText
import android.widget.LinearLayout
import android.widget.ScrollView
import android.widget.TextView
import androidx.appcompat.app.AppCompatActivity
import com.oneapp.one.system.Config
import com.oneapp.one.system.Connection

/**
 * 全屏配置页(晴空软糖):品牌方块「1」+ one 标题、三个输入(主域名 / 访问密码 / 设备名)、
 * 「连接」主按钮、连接状态行(在线绿点 / 离线灰点)、进入「保活设置」的次级按钮。
 * 首次设置与「再次打开设置」共用同一页。
 */
class SettingsActivity : AppCompatActivity() {

    private lateinit var statusDot: TextView
    private lateinit var statusText: TextView
    private lateinit var axDot: TextView
    private lateinit var axText: TextView
    private lateinit var axBtn: TextView

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
            setPadding(dp(24), dp(48), dp(24), dp(40))
        }

        // 品牌方块 + 标题
        root.addView(Ui.brandTile(this).apply {
            layoutParams = Ui.lp(dp(56), dp(56))
        })
        root.addView(TextView(this).apply {
            text = "one"
            setTextColor(Ui.ink)
            textSize = 30f
            typeface = android.graphics.Typeface.create(android.graphics.Typeface.SERIF, android.graphics.Typeface.BOLD)
            gravity = Gravity.CENTER
            setPadding(0, dp(12), 0, 0)
        })
        root.addView(Ui.body(this, "连接到你的云端大脑").apply {
            gravity = Gravity.CENTER
            setPadding(0, dp(6), 0, dp(20))
        })

        // 卡片:三个输入 + 连接按钮
        val card = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            background = Ui.cardBackground(this@SettingsActivity)
            setPadding(dp(20), dp(22), dp(20), dp(22))
            layoutParams = Ui.lp(LinearLayout.LayoutParams.MATCH_PARENT, LinearLayout.LayoutParams.WRAP_CONTENT)
        }
        Ui.applyCardElevation(card, this)

        val workerIn = field("主域名 https://your-worker.example.com", false).apply {
            setText(Config.worker(this@SettingsActivity))
        }
        val passwordIn = field("访问密码", true)
        val nameIn = field("设备名(唯一,如 phone)", false).apply {
            setText(Config.name(this@SettingsActivity))
        }

        card.addView(label("主域名"))
        card.addView(workerIn)
        card.addView(label("访问密码", dp(14)))
        card.addView(passwordIn)
        card.addView(label("设备名", dp(14)))
        card.addView(nameIn)

        val connect = Ui.primaryButton(this, "连接").apply {
            layoutParams = Ui.lp(LinearLayout.LayoutParams.MATCH_PARENT, dp(50), dp(20))
            setOnClickListener {
                Config.save(
                    this@SettingsActivity,
                    workerIn.text.toString(),
                    passwordIn.text.toString(),
                    nameIn.text.toString(),
                )
                startHand()
                refreshStatus()
                startActivity(Intent(this@SettingsActivity, MainActivity::class.java).apply {
                    flags = Intent.FLAG_ACTIVITY_CLEAR_TOP or Intent.FLAG_ACTIVITY_SINGLE_TOP
                })
                finish()
            }
        }
        card.addView(connect)

        // 连接状态行
        val statusRow = LinearLayout(this).apply {
            orientation = LinearLayout.HORIZONTAL
            gravity = Gravity.CENTER_VERTICAL
            layoutParams = Ui.lp(LinearLayout.LayoutParams.WRAP_CONTENT, LinearLayout.LayoutParams.WRAP_CONTENT, dp(16))
        }
        statusDot = TextView(this).apply {
            text = "●"
            textSize = 12f
        }
        statusText = TextView(this).apply {
            setTextColor(Ui.muted)
            textSize = 13f
            setPadding(dp(6), 0, 0, 0)
        }
        statusRow.addView(statusDot)
        statusRow.addView(statusText)

        root.addView(card)
        root.addView(statusRow)

        // 无障碍引导:one 靠它点屏幕/输入,未开启时给显眼引导
        val axRow = LinearLayout(this).apply {
            orientation = LinearLayout.HORIZONTAL
            gravity = Gravity.CENTER_VERTICAL
            background = Ui.cardBackground(this@SettingsActivity, dp(16))
            setPadding(dp(16), dp(12), dp(12), dp(12))
            layoutParams = Ui.lp(LinearLayout.LayoutParams.MATCH_PARENT, LinearLayout.LayoutParams.WRAP_CONTENT, dp(14))
        }
        axDot = TextView(this).apply { text = "●"; textSize = 10f }
        axText = TextView(this).apply {
            setTextColor(Ui.ink)
            textSize = 13f
            setPadding(dp(8), 0, 0, 0)
        }
        axBtn = Ui.ghostButton(this, "去开启").apply {
            setOnClickListener {
                runCatching { startActivity(Intent(Settings.ACTION_ACCESSIBILITY_SETTINGS)) }
            }
        }
        val axSpace = TextView(this).apply { layoutParams = LinearLayout.LayoutParams(0, 1, 1f) }
        axRow.addView(axDot); axRow.addView(axText); axRow.addView(axSpace); axRow.addView(axBtn)
        root.addView(axRow)

        // 次级按钮:保活设置
        root.addView(Ui.ghostButton(this, "保活设置 ›").apply {
            layoutParams = Ui.lp(LinearLayout.LayoutParams.MATCH_PARENT, dp(48), dp(16))
            setOnClickListener { startActivity(Intent(this@SettingsActivity, KeepAliveActivity::class.java)) }
        })

        scroll.addView(root)
        setContentView(scroll)
    }

    override fun onResume() {
        super.onResume()
        refreshStatus()
    }

    private fun refreshStatus() {
        val on = Connection.online
        statusDot.setTextColor(if (on) Ui.online else Ui.offline)
        statusText.text = if (on) "设备通道在线" else "设备通道离线"

        val ax = accessibilityEnabled()
        axDot.setTextColor(if (ax) Ui.online else Ui.offline)
        axText.text = if (ax) "无障碍已开启,可以操控屏幕" else "无障碍未开启,无法点按/输入"
        axBtn.text = if (ax) "查看" else "去开启"
    }

    /** 检查本应用的无障碍服务是否已启用。 */
    private fun accessibilityEnabled(): Boolean {
        val enabled = Settings.Secure.getString(contentResolver, Settings.Secure.ENABLED_ACCESSIBILITY_SERVICES) ?: return false
        return enabled.split(':').any { it.startsWith("$packageName/") }
    }

    private fun label(text: String, top: Int = 0): TextView = TextView(this).apply {
        this.text = text
        setTextColor(Ui.ink)
        textSize = 12.5f
        typeface = android.graphics.Typeface.DEFAULT_BOLD
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

    private fun startHand() {
        val svc = Intent(this, DeviceService::class.java)
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) startForegroundService(svc) else startService(svc)
    }
}
