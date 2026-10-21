const $ = (id) => document.getElementById(id);

chrome.storage.local.get(["appUrl", "token", "machine"]).then((s) => {
  $("appUrl").value = s.appUrl ?? ""; $("token").value = s.token ?? ""; $("machine").value = s.machine ?? "";
});

$("save").onclick = async () => {
  const appUrl = $("appUrl").value.trim().replace(/\/$/, "");
  const token = $("token").value.trim();
  const machine = $("machine").value.trim() || "Chrome extension";
  if (!/^https?:\/\//.test(appUrl)) { $("msg").textContent = "The address must start with http:// or https://"; return; }
  if (token.length < 16) { $("msg").textContent = "The token looks too short."; return; }
  $("msg").textContent = "Checking the connection...";
  try {
    const res = await fetch(appUrl + "/api/worker/jobs", { headers: { Authorization: `Bearer ${token}`, "X-Machine": machine } });
    if (res.status === 401) { $("msg").textContent = "The app rejected the token (401). Check it matches WORKER_TOKEN."; return; }
    if (!res.ok) { $("msg").textContent = `The app answered HTTP ${res.status}. Check the address.`; return; }
  } catch (e) { $("msg").textContent = `Could not reach the app: ${e.message}`; return; }
  await chrome.storage.local.set({ appUrl, token, machine });
  await chrome.runtime.sendMessage({ type: "restart-runner" });
  $("msg").textContent = "Saved. The helper is running in a pinned tab. You can close this page.";
};
