const RUNNER = chrome.runtime.getURL("runner.html");
(async () => {
  const s = await chrome.storage.local.get(["appUrl", "token"]);
  const tabs = await chrome.tabs.query({ url: RUNNER });
  document.getElementById("state").textContent = !s.appUrl || !s.token ? "Not set up yet. Open Settings." : tabs.length ? "Running in a pinned tab." : "Status tab is closed. Click below to open it.";
})();
document.getElementById("open").onclick = () => chrome.runtime.sendMessage({ type: "open-runner" }).then(() => window.close());
document.getElementById("settings").onclick = () => chrome.runtime.openOptionsPage();
