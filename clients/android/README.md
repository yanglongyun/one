# one · 安卓的手

安卓既是「屏」(WebView 加载云端 `你的 worker 域名`),也是「手」(连云端 worker 的 device 通道,听命执行)。

## 形态

| 组件 | 职责 |
|---|---|
| `MainActivity` | 全屏 WebView 开 worker UI —— 跟网页/桌面同一份界面、同一份云端数据 |
| `DeviceService` | 前台服务:注册设备 → 连 `wss /do/ws` → 收 `tool.exec` 执行回 `tool.result` |
| `HandAccessibilityService` | 无障碍服务:点击(手势)+ 文本输入 |

worker 地址写在 `app/build.gradle.kts` 的 `WORKER_URL`(改域名只动这一行)。

## 当前工具集(最小骨架)

已实现:`android_screen`、`android_tap`、`android_type`、`android_swipe`、`android_key`、`android_open_app`、`screenshot`。
未实现(返回明确错误):`shell`(安卓无)、`browser_cdp`、`computer_*`。

## 构建

```bash
cd clients/android
./gradlew assembleDebug          # 产物 app/build/outputs/apk/debug/app-debug.apk
```

## 装机(需手机连 adb,开 USB 调试)

```bash
adb install -r app/build/outputs/apk/debug/app-debug.apk
```

装好后:打开 app(WebView 出云端界面)→ 到「设置→无障碍→one」打开无障碍,这只手才能点击/输入。
