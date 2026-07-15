package com.oneapp.one

import android.content.Intent
import android.os.Build
import android.os.Bundle
import android.view.Gravity
import android.graphics.Typeface
import android.webkit.JavascriptInterface
import android.webkit.WebResourceError
import android.webkit.WebResourceRequest
import android.webkit.WebView
import android.webkit.WebViewClient
import android.widget.LinearLayout
import android.widget.TextView
import androidx.appcompat.app.AppCompatActivity
import com.oneapp.one.system.Config

/**
 * 屏:全屏 WebView 加载云端 UI,并拉起 DeviceService —— 让这台安卓成为云端大脑的一只「手」。
 * 未配置时转到 SettingsActivity;再次打开设置走网页「本机客户端」入口(JS 桥 OneNative)或通知栏。
 */
class MainActivity : AppCompatActivity() {

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        ReconnectWorker.schedule(this) // 保活兜底:周期检查设备通道
        if (!Config.configured(this)) {
            startActivity(Intent(this, SettingsActivity::class.java))
            finish()
            return
        }
        showWeb()
    }

    private fun dp(v: Int) = Ui.dp(this, v)

    private fun startHand() {
        val svc = Intent(this, DeviceService::class.java)
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) startForegroundService(svc) else startService(svc)
    }

    private fun openSettings() {
        startActivity(Intent(this, SettingsActivity::class.java))
    }

    private fun showWeb() {
        val web = WebView(this).apply {
            settings.javaScriptEnabled = true
            settings.domStorageEnabled = true
            settings.mediaPlaybackRequiresUserGesture = false
            addJavascriptInterface(NativeBridge(), "OneNative")
            webViewClient = object : WebViewClient() {
                // 主页面加载失败(域名填错 / 打成 http / 断网)别把用户困在系统死页面 —— 给回设置的退路
                override fun onReceivedError(view: WebView?, request: WebResourceRequest?, error: WebResourceError?) {
                    if (request?.isForMainFrame == true) {
                        runOnUiThread { showError(error?.description?.toString() ?: "无法连接") }
                    }
                }
            }
            loadUrl(Config.worker(this@MainActivity))
        }

        setContentView(web)
        startHand()
    }

    /** 云端打不开时的逃生页:显示地址与原因,一键回设置改地址 / 重试。 */
    private fun showError(reason: String) {
        val root = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            gravity = Gravity.CENTER
            background = Ui.skyBackground()
            setPadding(dp(32), dp(32), dp(32), dp(32))
        }
        root.addView(TextView(this).apply {
            text = "打不开云端"
            setTextColor(Ui.ink); textSize = 20f
            typeface = Typeface.DEFAULT_BOLD; gravity = Gravity.CENTER
        })
        root.addView(TextView(this).apply {
            text = "地址:${Config.worker(this@MainActivity)}\n$reason\n检查主域名是否填对、能否访问"
            setTextColor(Ui.muted); textSize = 13f; gravity = Gravity.CENTER
            setPadding(0, dp(12), 0, dp(24))
        })
        root.addView(Ui.primaryButton(this, "返回设置改地址").apply {
            layoutParams = Ui.lp(LinearLayout.LayoutParams.MATCH_PARENT, dp(50))
            setOnClickListener { openSettings(); finish() }
        })
        root.addView(Ui.ghostButton(this, "重试").apply {
            layoutParams = Ui.lp(LinearLayout.LayoutParams.MATCH_PARENT, dp(48), dp(12))
            setOnClickListener { recreate() }
        })
        setContentView(root)
    }

    /** JS 桥:worker 网页检测 window.OneNative 即显示原生入口。 */
    inner class NativeBridge {
        @JavascriptInterface
        fun deviceName(): String = Config.name(this@MainActivity)

        @JavascriptInterface
        fun openSettings() {
            runOnUiThread { this@MainActivity.openSettings() }
        }

        @JavascriptInterface
        fun version(): String = BuildConfig.VERSION_NAME
    }
}
