// one 浏览器手 — 浏览器插件作为 one 的一个「执行层」。
//
// 连接:与所有客户端统一,只需「主域名 + 密码」→ wss://{主域名}/api/realtime/ws?password=
// 模型:worker 广播 chat.tool.calls 给各执行层;本插件**自己捕捉归属自己的 browser_cdp / screenshot**,
//       经 chrome.debugger(CDP)执行,回 chat.tool.result{threadId,id,result}。
//   收  {type:"chat.tool.calls", threadId, calls:[{id,name,args}]}
//   回  {type:"chat.tool.result", threadId, id, result}
//   browser_cdp.args = { method, params, tabId? }(默认当前活动标签)

const CDP_VERSION = "1.3";
const KEEPALIVE_ALARM = "browser-use-keepalive";

let ws = null;
let connected = false;
let reconnectDelay = 1000;
let reconnectTimer = null;
const attached = new Set(); // 已 attach debugger 的 tabId

function send(obj) {
  if (ws && ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(obj));
    return true;
  }
  return false;
}

function setBadge() {
  try {
    chrome.action.setBadgeText({ text: connected ? "on" : "" });
    chrome.action.setBadgeBackgroundColor({ color: connected ? "#19a85e" : "#888888" });
  } catch {}
}

// 设备名(唯一,寻址键):用户在 popup 填,缺省 "Chrome 插件"。
async function deviceName() {
  const { name } = await chrome.storage.local.get("name");
  return (name || "").trim() || "Chrome 插件";
}

// 主域名 + 密码 → 系统实时 WS 地址(role=browser;密码即凭证)
async function wsUrl() {
  const { worker, password } = await chrome.storage.local.get(["worker", "password"]);
  const w = (worker || "").trim().replace(/\/+$/, "");
  if (!w) return "";
  const pw = (password || "").trim();
  // 强制加密:除本机(localhost/127.0.0.1)外一律 wss://,避免在网络上明文传密码。
  const host = w.replace(/^[a-z]+:\/\//i, "");
  const isLocal = /^(localhost|127\.0\.0\.1)(:|\/|$)/i.test(host);
  const base = (isLocal ? "ws://" : "wss://") + host;
  return `${base}/api/realtime/ws?password=${encodeURIComponent(pw)}&role=browser`;
}

function scheduleReconnect() {
  clearTimeout(reconnectTimer);
  reconnectTimer = setTimeout(connect, reconnectDelay);
  reconnectDelay = Math.min(reconnectDelay * 2, 30000);
}

async function connect() {
  clearTimeout(reconnectTimer);
  if (ws && (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING)) return;
  const url = await wsUrl();
  if (!url) { connected = false; setBadge(); return; }
  try {
    ws = new WebSocket(url);
  } catch {
    scheduleReconnect();
    return;
  }
  ws.onopen = async () => {
    connected = true; reconnectDelay = 1000; setBadge();
    send({ type: "hello", kind: "browser", name: await deviceName(), caps: ["browser_cdp", "screenshot"] });
  };
  ws.onmessage = (ev) => {
    let msg;
    try { msg = JSON.parse(ev.data); } catch { return; }
    handle(msg);
  };
  ws.onclose = () => { connected = false; setBadge(); scheduleReconnect(); };
  ws.onerror = () => { try { ws.close(); } catch {} };
}

function disconnect() {
  clearTimeout(reconnectTimer);
  if (ws) { try { ws.close(); } catch {} ws = null; }
  connected = false;
  setBadge();
}

async function activeTabId() {
  const [tab] = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
  return tab ? tab.id : undefined;
}

async function ensureAttached(tabId) {
  if (attached.has(tabId)) return;
  try {
    await chrome.debugger.attach({ tabId }, CDP_VERSION);
  } catch (e) {
    // attach 失败(如 chrome:// 页面 / DevTools 已占用)→ 错误透传给调用方
    throw new Error(`debugger attach 失败(tab ${tabId}):${(e && e.message) || e}`);
  }
  attached.add(tabId);
}

// 截图并压缩到 ≤1280px 宽,返回 {image,w,h,cw,ch}。
async function browserScreenshot(tabId) {
  // Page.captureScreenshot 返回 base64 PNG
  const { data } = await chrome.debugger.sendCommand({ tabId }, "Page.captureScreenshot", { format: "png" });

  // 在 OffscreenCanvas 里解码 → 按需缩放 → 重新编码
  const blob = await fetch(`data:image/png;base64,${data}`).then((r) => r.blob());
  const bmp = await createImageBitmap(blob);
  const ow = bmp.width, oh = bmp.height;
  const scale = ow > 1280 ? 1280 / ow : 1;
  const w = Math.round(ow * scale), h = Math.round(oh * scale);

  const canvas = new OffscreenCanvas(w, h);
  const ctx = canvas.getContext("2d");
  ctx.drawImage(bmp, 0, 0, w, h);
  bmp.close();

  const outBlob = await canvas.convertToBlob({ type: "image/png" });
  const ab = await outBlob.arrayBuffer();
  const b64 = btoa(String.fromCharCode(...new Uint8Array(ab)));
  return { image: `data:image/png;base64,${b64}`, w, h, cw: ow, ch: oh };
}

// 捕捉 chat.tool.calls 里归属本插件的工具,执行后回 chat.tool.result。
async function handle(msg) {
  if (!msg || msg.type !== "chat.tool.calls") return;
  const threadId = msg.threadId;
  const calls = Array.isArray(msg.calls) ? msg.calls : [];
  for (const call of calls) {
    if (!call || !["browser_cdp", "screenshot"].includes(call.name)) continue;
    const id = call.id;
    const args = call.args || {};
    let result;
    try {
      const tabId = args.tabId ?? (await activeTabId());
      if (tabId == null) throw new Error("没有可操作的标签页");
      await ensureAttached(tabId);
      if (call.name === "screenshot") {
        result = await browserScreenshot(tabId);
      } else {
        result = await chrome.debugger.sendCommand({ tabId }, args.method, args.params || {});
      }
    } catch (e) {
      result = { error: String((e && e.message) || e) };
    }
    send({ type: "chat.tool.result", threadId, id, result });
  }
}

chrome.debugger.onDetach.addListener((source) => {
  if (source.tabId != null) attached.delete(source.tabId);
});
chrome.tabs.onRemoved.addListener((tabId) => attached.delete(tabId));

// popup 控制
chrome.runtime.onMessage.addListener((req, _sender, sendResponse) => {
  if (req && (req.cmd === "getStatus" || req.type === "status")) {
    // 异步取设备名再回包(return true 保持通道)
    deviceName().then((name) => sendResponse({ connected, name, attached: [...attached] }));
    return true;
  }
  if (req && req.cmd === "connect") { connect(); sendResponse({ ok: true }); return; }
  if (req && req.cmd === "disconnect") { disconnect(); sendResponse({ ok: true }); return; }
  return false;
});

// 改了主域名/密码 就重连
chrome.storage.onChanged.addListener((changes, area) => {
  if (area === "local" && (changes.worker || changes.password || changes.name)) { disconnect(); connect(); }
});

// MV3 保活 + 守连:Chrome 116+ 有活跃 WS 时 SW 不会被杀;alarm 作为复活钩子,
// 每 30s 醒来仅检查 ws.readyState(不发消息,避免协议噪音),非 OPEN 即重连。
chrome.alarms.create(KEEPALIVE_ALARM, { periodInMinutes: 0.5 });
chrome.alarms.onAlarm.addListener((a) => {
  if (a.name !== KEEPALIVE_ALARM) return;
  if (!ws || ws.readyState !== WebSocket.OPEN) connect();
});

// SW 冷启动即连:浏览器启动 / 安装升级 / worker 被事件唤醒(模块顶层)都尝试连接
chrome.runtime.onStartup.addListener(connect);
chrome.runtime.onInstalled.addListener(connect);
connect();
