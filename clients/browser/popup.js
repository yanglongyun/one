const $ = (id) => document.getElementById(id);
const FIELDS = ["worker", "password", "name"];
let isConnected = false;

function setStatus(text, bad) {
  $("status").textContent = text;
  $("status").classList.toggle("bad", !!bad);
}

// 打开时填一次:优先草稿(d_*,输入即缓存),回退已提交值。之后不再由轮询覆盖。
async function loadFields() {
  const keys = FIELDS.flatMap((f) => [f, "d_" + f]);
  const s = await chrome.storage.local.get(keys);
  for (const f of FIELDS) {
    if (document.activeElement !== $(f)) $(f).value = s["d_" + f] ?? s[f] ?? "";
  }
}

// 只刷新连接状态与按钮,绝不动输入框(修:原来每 1.5s 用 storage 覆盖未聚焦的输入 → 内容被清空)。
function renderStatus() {
  chrome.runtime.sendMessage({ type: "status" }, (s) => {
    if (chrome.runtime.lastError) return;
    isConnected = !!(s && s.connected);
    document.body.classList.toggle("connected", isConnected);
    const btn = $("toggle");
    btn.textContent = isConnected ? "断开" : "连接";
    btn.classList.toggle("on", isConnected);
    if (isConnected) {
      setStatus(`已连接 · ${s.name || ""} · 附加 ${s.attached ? s.attached.length : 0} 个标签`, false);
    } else if (s && s.error) {
      setStatus(s.error, true);                                   // 明确的失败原因
    } else {
      setStatus($("worker").value.trim() ? "未连接" : "未配置", false);
    }
  });
}

// 输入即缓存为草稿(只写 d_*,不碰已提交键,免得 background 拿半截地址去连)。
for (const f of FIELDS) {
  $(f).addEventListener("input", () => {
    chrome.storage.local.set({ ["d_" + f]: $(f).value });
    $("status").classList.remove("bad");
  });
}

$("toggle").onclick = async () => {
  if (isConnected) {
    chrome.runtime.sendMessage({ cmd: "disconnect" }, () => setTimeout(renderStatus, 150));
    return;
  }
  let worker = $("worker").value.trim().replace(/\/+$/, "");
  const password = $("password").value;
  const name = $("name").value.trim();
  if (!worker) { setStatus("请填主域名", true); $("worker").focus(); return; }
  if (!name) { setStatus("请给这台设备起个唯一名字", true); $("name").focus(); return; }
  // 裸域名自动补 https(裸域名本也能连,补上让展示/校验统一)
  if (!/^[a-z]+:\/\//i.test(worker)) worker = "https://" + worker;
  $("worker").value = worker;
  setStatus("连接中…", false);
  // 提交(触发 background 连接);同时保留草稿,连接失败也不清空输入
  await chrome.storage.local.set({ worker, password, name, d_worker: worker, d_password: password, d_name: name });
  chrome.runtime.sendMessage({ cmd: "connect" }, () => {});
  setTimeout(renderStatus, 700);
};

document.addEventListener("DOMContentLoaded", () => {
  try { $("ver").textContent = "v" + chrome.runtime.getManifest().version; } catch {}
  loadFields();
  renderStatus();
});
setInterval(renderStatus, 1500);
