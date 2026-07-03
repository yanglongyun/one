package com.oneapp.one

import android.accessibilityservice.AccessibilityService
import android.accessibilityservice.GestureDescription
import android.graphics.Bitmap
import android.graphics.Path
import android.graphics.Rect
import android.os.Build
import android.os.Bundle
import android.util.Base64
import android.view.Display
import android.view.accessibility.AccessibilityEvent
import android.view.accessibility.AccessibilityNodeInfo
import java.io.ByteArrayOutputStream
import java.util.concurrent.CountDownLatch
import java.util.concurrent.TimeUnit
import org.json.JSONArray
import org.json.JSONObject

/**
 * 手(执行层):无障碍服务。被 DeviceService 调用,做点击(手势)和文本输入。
 * 用户需在「设置→无障碍→one」手动开启;开启后 instance 非空。
 */
class HandAccessibilityService : AccessibilityService() {

    companion object {
        @Volatile var instance: HandAccessibilityService? = null
    }

    override fun onServiceConnected() {
        super.onServiceConnected()
        instance = this
    }

    override fun onDestroy() {
        instance = null
        super.onDestroy()
    }

    override fun onAccessibilityEvent(event: AccessibilityEvent?) {}
    override fun onInterrupt() {}

    /** 在屏幕坐标 (x,y) 点一下。 */
    fun tap(x: Float, y: Float) {
        val path = Path().apply { moveTo(x, y) }
        val stroke = GestureDescription.StrokeDescription(path, 0, 60)
        dispatchGesture(GestureDescription.Builder().addStroke(stroke).build(), null, null)
    }

    /** 往当前聚焦的可编辑控件填文本;无聚焦控件返回 false。 */
    fun typeText(text: String): Boolean {
        val node = findFocusedEditable(rootInActiveWindow) ?: return false
        val args = Bundle().apply {
            putCharSequence(AccessibilityNodeInfo.ACTION_ARGUMENT_SET_TEXT_CHARSEQUENCE, text)
        }
        return node.performAction(AccessibilityNodeInfo.ACTION_SET_TEXT, args)
    }

    private fun findFocusedEditable(node: AccessibilityNodeInfo?): AccessibilityNodeInfo? {
        if (node == null) return null
        if (node.isEditable && node.isFocused) return node
        for (i in 0 until node.childCount) {
            findFocusedEditable(node.getChild(i))?.let { return it }
        }
        return null
    }

    /** 读屏:把当前界面里有意义的元素(可点/可编辑/有文字)导成列表,供 AI「看」屏(语义,非像素)。 */
    fun dumpScreen(): JSONArray {
        val arr = JSONArray()
        collect(rootInActiveWindow, arr, 0)
        return arr
    }

    private fun collect(node: AccessibilityNodeInfo?, arr: JSONArray, depth: Int) {
        if (node == null || arr.length() >= 200 || depth > 40) return
        val text = (node.text ?: node.contentDescription)?.toString()?.trim() ?: ""
        if (node.isClickable || node.isEditable || text.isNotEmpty()) {
            val r = Rect()
            node.getBoundsInScreen(r)
            if (r.width() > 0 && r.height() > 0) {
                arr.put(
                    JSONObject()
                        .put("text", text)
                        .put("cls", node.className?.toString()?.substringAfterLast('.') ?: "")
                        .put("clickable", node.isClickable)
                        .put("editable", node.isEditable)
                        .put("x", r.centerX()).put("y", r.centerY())
                        .put("w", r.width()).put("h", r.height())
                )
            }
        }
        for (i in 0 until node.childCount) collect(node.getChild(i), arr, depth + 1)
    }

    /** 按文字找一个可点元素点它(比盲点坐标稳)。找不到返回 false。 */
    fun tapByText(text: String): Boolean {
        val node = findByText(rootInActiveWindow, text) ?: return false
        val r = Rect()
        node.getBoundsInScreen(r)
        tap(r.centerX().toFloat(), r.centerY().toFloat())
        return true
    }

    private fun findByText(node: AccessibilityNodeInfo?, text: String): AccessibilityNodeInfo? {
        if (node == null) return null
        val t = (node.text ?: node.contentDescription)?.toString() ?: ""
        if (t.contains(text, ignoreCase = true) && node.isVisibleToUser) return node
        for (i in 0 until node.childCount) {
            findByText(node.getChild(i), text)?.let { return it }
        }
        return null
    }

    /** 从 (x1,y1) 滑到 (x2,y2)。 */
    fun swipe(x1: Float, y1: Float, x2: Float, y2: Float) {
        val path = Path().apply { moveTo(x1, y1); lineTo(x2, y2) }
        dispatchGesture(GestureDescription.Builder().addStroke(GestureDescription.StrokeDescription(path, 0, 300)).build(), null, null)
    }

    /** 截屏(API30+):回 {image(base64 png), w,h(缩后像素), cw,ch(原始像素=触摸坐标空间)}。同步阻塞等回调。 */
    fun screenshot(): JSONObject {
        val out = JSONObject()
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.R) {
            return out.put("error", "需要 Android 11+ 才能截屏")
        }
        val latch = CountDownLatch(1)
        takeScreenshot(Display.DEFAULT_DISPLAY, mainExecutor, object : TakeScreenshotCallback {
            override fun onSuccess(result: ScreenshotResult) {
                try {
                    val raw = Bitmap.wrapHardwareBuffer(result.hardwareBuffer, result.colorSpace)
                        ?.copy(Bitmap.Config.ARGB_8888, false)
                    result.hardwareBuffer.close()
                    if (raw == null) { out.put("error", "位图转换失败"); return }
                    val cw = raw.width; val ch = raw.height
                    val scaled = if (cw > 1280) {
                        val s = 1280f / cw
                        Bitmap.createScaledBitmap(raw, 1280, (ch * s).toInt(), true)
                    } else raw
                    val baos = ByteArrayOutputStream()
                    scaled.compress(Bitmap.CompressFormat.PNG, 100, baos)
                    val b64 = Base64.encodeToString(baos.toByteArray(), Base64.NO_WRAP)
                    out.put("image", "data:image/png;base64,$b64")
                        .put("w", scaled.width).put("h", scaled.height)
                        .put("cw", cw).put("ch", ch)
                } catch (e: Exception) {
                    out.put("error", e.message ?: "截屏处理失败")
                } finally {
                    latch.countDown()
                }
            }
            override fun onFailure(errorCode: Int) {
                out.put("error", "截屏失败 code=$errorCode"); latch.countDown()
            }
        })
        if (!latch.await(8, TimeUnit.SECONDS)) return JSONObject().put("error", "截屏超时")
        return out
    }

    /** 全局键:back / home / recents / notifications。 */
    fun global(action: String): Boolean {
        val a = when (action) {
            "back" -> GLOBAL_ACTION_BACK
            "home" -> GLOBAL_ACTION_HOME
            "recents" -> GLOBAL_ACTION_RECENTS
            "notifications" -> GLOBAL_ACTION_NOTIFICATIONS
            else -> return false
        }
        return performGlobalAction(a)
    }
}
