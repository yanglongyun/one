package com.oneapp.one

import android.content.Intent
import android.graphics.Color
import android.graphics.drawable.GradientDrawable
import android.os.Build
import android.os.Bundle
import android.view.Gravity
import android.net.Uri
import android.webkit.JavascriptInterface
import android.webkit.ValueCallback
import android.webkit.WebChromeClient
import android.webkit.WebView
import android.webkit.WebViewClient
import androidx.activity.result.ActivityResultLauncher
import androidx.activity.result.contract.ActivityResultContracts
import android.widget.FrameLayout
import android.widget.TextView
import androidx.appcompat.app.AppCompatActivity
import com.oneapp.one.system.Config

/**
 * 屏:全屏 WebView 加载云端 UI,并拉起 DeviceService —— 让这台安卓成为云端大脑的一只「手」。
 * 未配置时转到 SettingsActivity;再次打开设置走网页「本机客户端」入口(JS 桥 OneNative)或通知栏。
 */
class MainActivity : AppCompatActivity() {

    // WebView <input type=file> 的回调 + 系统选择器 launcher(不做这个,网页点附件毫无反应)
    private var filePathCallback: ValueCallback<Array<Uri>>? = null
    private val fileChooser: ActivityResultLauncher<String> =
        registerForActivityResult(ActivityResultContracts.GetMultipleContents()) { uris ->
            filePathCallback?.onReceiveValue(uris?.toTypedArray() ?: emptyArray())
            filePathCallback = null
        }

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
            webViewClient = WebViewClient()
            webChromeClient = object : WebChromeClient() {
                override fun onShowFileChooser(
                    view: WebView?,
                    callback: ValueCallback<Array<Uri>>?,
                    params: FileChooserParams?,
                ): Boolean {
                    filePathCallback?.onReceiveValue(null) // 取消上一次未完成的选择
                    filePathCallback = callback
                    val types = params?.acceptTypes?.filter { it.isNotBlank() }
                    val mime = types?.firstOrNull()?.takeIf { it.contains('/') } ?: "image/*"
                    return try { fileChooser.launch(mime); true }
                    catch (e: Exception) { filePathCallback = null; false }
                }
            }
            loadUrl(Config.worker(this@MainActivity))
        }

        setContentView(web)
        startHand()
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
