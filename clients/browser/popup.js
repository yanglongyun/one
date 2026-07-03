const $ = (id) => document.getElementById(id);
let isConnected = false;

async function refresh() {
  const { worker, password, name } = await chrome.storage.local.get(["worker", "password", "name"]);
  if (document.activeElement !== $("worker")) $("worker").value = worker || "";
  if (document.activeElement !== $("password")) $("password").value = password || "";
  if (document.activeElement !== $("name")) $("name").value = name || "";
  const configured = !!worker;
  chrome.runtime.sendMessage({ type: "status" }, (s) => {
    isConnected = !!(s && s.connected);
    document.body.classList.toggle("connected", isConnected);
    $("status").textContent = isConnected
      ? `已连接 · ${s.name || ""} · 附加 ${s.attached ? s.attached.length : 0} 个标签`
      : (configured ? "未连接" : "未配置");
    const btn = $("toggle");
    btn.textContent = isConnected ? "断开" : "连接";
    btn.classList.toggle("on", isConnected);
  });
}

$("toggle").onclick = async () => {
  if (isConnected) {
    chrome.runtime.sendMessage({ cmd: "disconnect" }, () => setTimeout(refresh, 150));
  } else {
    // 主域名 + 密码 + 设备名(与所有客户端统一);写入即触发 background 连接
    await chrome.storage.local.set({
        worker: $("worker").value.trim(),
        password: $("password").value.trim(),
        name: $("name").value.trim(),
    });
    // 值没变时 storage.onChanged 不触发,显式让 background 立即(重)连
    chrome.runtime.sendMessage({ cmd: "connect" }, () => {});
    setTimeout(refresh, 400);
  }
};

document.addEventListener("DOMContentLoaded", () => {
  try { $("ver").textContent = "v" + chrome.runtime.getManifest().version; } catch {}
  refresh();
});
setInterval(refresh, 1500);
