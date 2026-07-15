package com.oneapp.one.system

import android.content.Context
import com.oneapp.one.BuildConfig
import okhttp3.*
import org.json.JSONObject
import java.util.concurrent.TimeUnit

// 与 worker 的唯一连接:用「主域名 + 密码」连 wss://{主域名}/api/realtime/ws,断线退避重连。
// 收到消息交给 Dispatch;回执经传入的 send 回 worker。
class Connection(private val ctx: Context) {
    companion object {
        // 设备通道是否在线(供保活 Worker 判断要不要拉起服务)
        @Volatile var online = false
            internal set
    }

    private val client = OkHttpClient.Builder().pingInterval(20, TimeUnit.SECONDS).build()
    private var socket: WebSocket? = null
    @Volatile private var stopped = false

    fun start() { stopped = false; connect() }

    fun stop() {
        stopped = true
        online = false
        socket?.close(1000, null)
        socket = null
    }

    private fun connect() {
        if (stopped) return
        if (!Config.configured(ctx)) { retry(); return } // 没填 token,等
        val req = Request.Builder().url(Config.wsUrl(ctx)).build()
        socket = client.newWebSocket(req, object : WebSocketListener() {
            override fun onOpen(webSocket: WebSocket, response: Response) {
                if (stopped) { webSocket.close(1000, null); return }
                online = true
                // 自报身份:唯一设备名(寻址键)+ 类型 + 能力(暂无网页视图/agent 工具)
                val caps = org.json.JSONArray()
                    .put("android_screen").put("android_tap").put("android_type")
                    .put("android_swipe").put("android_key").put("android_open_app")
                webSocket.send(
                    JSONObject()
                        .put("type", "hello")
                        .put("protocolVersion", 1)
                        .put("clientVersion", BuildConfig.VERSION_NAME)
                        .put("kind", "android")
                        .put("name", Config.name(ctx))
                        .put("caps", caps)
                        .toString()
                )
            }
            override fun onMessage(webSocket: WebSocket, text: String) {
                val msg = try { JSONObject(text) } catch (_: Exception) { return }
                Dispatch.handle(ctx, msg) { reply -> webSocket.send(reply.toString()) }
            }
            override fun onClosed(webSocket: WebSocket, code: Int, reason: String) {
                online = false
                if (code == 4002) stopped = true else retry()
            }
            override fun onFailure(webSocket: WebSocket, t: Throwable, response: Response?) { online = false; retry() }
        })
    }

    private fun retry() {
        if (stopped) return
        Thread { Thread.sleep(3000); connect() }.start()
    }
}
