# one

这是 one 的 Chrome 扩展执行层。它连接你的 one Worker,接收 AI 下发的浏览器工具调用,再通过 Chrome DevTools Protocol(CDP) 操作当前浏览器。

## 安装

1. 打开 `chrome://extensions`。
2. 打开「开发者模式」。
3. 选择「加载已解压的扩展程序」,加载本目录。
4. 点击扩展图标,填写:
   - 主域名:你的 one 地址,例如 `https://one.example.com`
   - 访问密码:和服务端实时通道一致的密码
   - 设备名:用于区分多个浏览器,例如 `chrome`
5. 点击「连接」,角标显示 `on` 后即可使用。

扩展会连接:

```text
wss://<你的 one 地址>/api/realtime/ws?password=<访问密码>&role=browser
```

## 能力

浏览器插件目前响应两个工具:

| 工具 | 作用 |
|---|---|
| `browser_cdp` | 透传 CDP 命令,可导航、读 DOM、点击、输入、抓网络等 |
| `screenshot` | 截取当前标签页并返回图片 |

## 边界

- 只支持 Chromium 系浏览器,例如 Chrome、Edge、Brave。
- 使用 `chrome.debugger` 时,浏览器顶部会显示正在调试的提示条。
- 它只能操作浏览器标签页,不能处理系统级弹窗或其他 App。
- 访问密码等同于浏览器控制权限,只连接你自己控制的 one 部署。

## 权限

`debugger`、`tabs`、`storage`、`alarms`、`host_permissions: <all_urls>`。
