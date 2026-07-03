package com.oneapp.one.system

import android.content.Context
import com.oneapp.one.apps.Control
import org.json.JSONObject

// 派发:按 type 路由(app.xxx),与 worker/桌面/插件同一心智模型。
// 本机执行层自己捕捉 chat.tool.calls 里归属自己的工具(android_*),跑完回 chat.tool.result。
object Dispatch {
    fun handle(ctx: Context, msg: JSONObject, send: (JSONObject) -> Unit) {
        when (msg.optString("type")) {
            "chat.tool.calls" -> {
                val threadId = msg.optString("threadId")
                val calls = msg.optJSONArray("calls") ?: return
                for (i in 0 until calls.length()) {
                    val call = calls.optJSONObject(i) ?: continue
                    val name = call.optString("name")
                    if (!Control.owns(name)) continue // 只接归属本机的工具
                    val id = call.optString("id")
                    val args = call.optJSONObject("args") ?: JSONObject()
                    val result = try {
                        Control.run(ctx, name, args)
                    } catch (e: Exception) {
                        JSONObject().put("error", e.message ?: "error")
                    }
                    send(
                        JSONObject()
                            .put("type", "chat.tool.result")
                            .put("threadId", threadId)
                            .put("id", id)
                            .put("result", result)
                    )
                }
            }
            // 其余(files.* / status.* 等)本机暂不实现,忽略
        }
    }
}
