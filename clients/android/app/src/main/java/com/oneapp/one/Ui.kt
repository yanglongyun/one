package com.oneapp.one

import android.content.Context
import android.graphics.Canvas
import android.graphics.Color
import android.graphics.LinearGradient
import android.graphics.Paint
import android.graphics.RectF
import android.graphics.Shader
import android.graphics.drawable.GradientDrawable
import android.util.TypedValue
import android.view.View
import android.widget.Button
import android.widget.EditText
import android.widget.LinearLayout
import android.widget.TextView

/**
 * 「晴空软糖」视觉常量与工具 —— 全客户端原生页面共用一套色值 / 圆角 / 间距。
 * 天空浅蓝渐变画布、白色大圆角卡片、糖果蓝渐变主按钮、白底浅蓝描边输入框。
 */
object Ui {
    // ---- 色值 ----
    val skyTop = Color.parseColor("#D5EAFD")      // 画布渐变(上)
    val skyBottom = Color.parseColor("#F7FBFF")   // 画布渐变(下)
    val card = Color.WHITE                          // 卡片底
    val ink = Color.parseColor("#22354E")          // 主文字(墨色)
    val muted = Color.parseColor("#54688A")        // 次级文字
    val candy = Color.parseColor("#3B9BF5")        // 糖果蓝(浅)
    val candyD = Color.parseColor("#2B86E4")       // 糖果蓝(深)
    val fieldStroke = Color.parseColor("#CFE3FA")  // 输入框浅蓝描边
    val online = Color.parseColor("#2FBE6E")       // 在线绿点
    val offline = Color.parseColor("#9FB0C6")      // 离线灰点
    val shadow = 0x1A2B86E4                          // 柔和阴影(带蓝调)

    // ---- 圆角(dp)----
    const val cardRadius = 24
    const val buttonRadius = 14
    const val fieldRadius = 13

    fun dp(ctx: Context, v: Int): Int =
        TypedValue.applyDimension(TypedValue.COMPLEX_UNIT_DIP, v.toFloat(), ctx.resources.displayMetrics).toInt()

    // 天空浅蓝渐变画布
    fun skyBackground(): GradientDrawable = GradientDrawable(
        GradientDrawable.Orientation.TOP_BOTTOM, intArrayOf(skyTop, skyBottom),
    )

    // 白色大圆角卡片(柔和阴影 —— 靠 elevation)
    fun cardBackground(ctx: Context, radius: Int = cardRadius): GradientDrawable = GradientDrawable().apply {
        setColor(card)
        cornerRadius = dp(ctx, radius).toFloat()
    }

    fun applyCardElevation(view: View, ctx: Context) {
        view.elevation = dp(ctx, 8).toFloat()
        view.outlineAmbientShadowColor = shadow
        view.outlineSpotShadowColor = shadow
    }

    // 白底圆角 + 浅蓝描边输入框
    fun fieldBackground(ctx: Context): GradientDrawable = GradientDrawable().apply {
        setColor(card)
        cornerRadius = dp(ctx, fieldRadius).toFloat()
        setStroke(dp(ctx, 1), fieldStroke)
    }

    // 糖果蓝渐变主按钮
    fun primaryButton(ctx: Context, label: String): Button = Button(ctx).apply {
        text = label
        setTextColor(Color.WHITE)
        textSize = 15f
        isAllCaps = false
        typeface = android.graphics.Typeface.DEFAULT_BOLD
        stateListAnimator = null
        background = GradientDrawable(
            GradientDrawable.Orientation.LEFT_RIGHT, intArrayOf(candy, candyD),
        ).apply { cornerRadius = dp(ctx, buttonRadius).toFloat() }
    }

    // 次级(幽灵)按钮:白底糖果蓝字 + 浅蓝描边
    fun ghostButton(ctx: Context, label: String): Button = Button(ctx).apply {
        text = label
        setTextColor(candyD)
        textSize = 14f
        isAllCaps = false
        typeface = android.graphics.Typeface.DEFAULT_BOLD
        stateListAnimator = null
        background = GradientDrawable().apply {
            setColor(card)
            cornerRadius = dp(ctx, buttonRadius).toFloat()
            setStroke(dp(ctx, 1), fieldStroke)
        }
    }

    fun title(ctx: Context, text: String): TextView = TextView(ctx).apply {
        this.text = text
        setTextColor(ink)
        textSize = 22f
        typeface = android.graphics.Typeface.DEFAULT_BOLD
    }

    fun body(ctx: Context, text: String): TextView = TextView(ctx).apply {
        this.text = text
        setTextColor(muted)
        textSize = 13f
    }

    fun lp(width: Int, height: Int, topMargin: Int = 0): LinearLayout.LayoutParams =
        LinearLayout.LayoutParams(width, height).apply { this.topMargin = topMargin }

    // 品牌方块:糖果蓝圆角底 + 白色软糖圆簇(与桌面 / 应用图标同一套 c5-tilt 造型,程序化绘制)
    fun brandTile(ctx: Context): View = object : View(ctx) {
        private val bg = Paint(Paint.ANTI_ALIAS_FLAG)
        private val fg = Paint(Paint.ANTI_ALIAS_FLAG).apply { color = Color.WHITE }
        private val rf = RectF()
        // c5-tilt 的 7 个白圆(1024 视图坐标:cx, cy, r)
        private val blobs = arrayOf(
            floatArrayOf(466f, 466f, 142f), floatArrayOf(356f, 524f, 96f),
            floatArrayOf(512f, 418f, 88f), floatArrayOf(586f, 504f, 110f),
            floatArrayOf(664f, 546f, 78f), floatArrayOf(446f, 596f, 86f),
            floatArrayOf(560f, 606f, 76f),
        )
        override fun onDraw(canvas: Canvas) {
            val w = width.toFloat(); val h = height.toFloat()
            bg.shader = LinearGradient(w * 0.15f, 0f, w * 0.85f, h, candy, candyD, Shader.TileMode.CLAMP)
            rf.set(0f, 0f, w, h)
            val r = dp(context, 16).toFloat()
            canvas.drawRoundRect(rf, r, r, bg)
            // 圆簇按桌面同比例(svg 34 / tile 56)居中缩放
            val s = (w * 34f / 56f) / 1024f
            val ox = w / 2f; val oy = h / 2f
            for (b in blobs) canvas.drawCircle(ox + (b[0] - 512f) * s, oy + (b[1] - 512f) * s, b[2] * s, fg)
        }
    }
}
