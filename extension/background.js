// Keeps the runner page open. The runner page (runner.html) does the actual work, because an extension page
// lives as long as its tab, while this service worker is stopped by Chrome whenever it is idle.

const RUNNER = chrome.runtime.getURL("runner.html");

async function ensureRunner() {
  const { appUrl, token } = await chrome.storage.local.get(["appUrl", "token"]);
  if (!appUrl || !token) return; // not set up yet: the options page says so
  const tabs = await chrome.tabs.query({ url: RUNNER });
  if (tabs.length) return;
  await chrome.tabs.create({ url: RUNNER, pinned: true, active: false });
}

chrome.runtime.onInstalled.addListener(async ({ reason }) => {
  const { appUrl, token } = await chrome.storage.local.get(["appUrl", "token"]);
  if (!appUrl || !token) chrome.runtime.openOptionsPage();
  else ensureRunner();
  if (reason === "install") chrome.alarms.create("keep-runner", { periodInMinutes: 1 });
});
chrome.runtime.onStartup.addListener(() => { ensureRunner(); chrome.alarms.create("keep-runner", { periodInMinutes: 1 }); });
chrome.alarms.onAlarm.addListener((a) => { if (a.name === "keep-runner") ensureRunner(); });
chrome.alarms.create("keep-runner", { periodInMinutes: 1 });

// Options page asks to (re)start the runner after saving settings.
chrome.runtime.onMessage.addListener((msg, _sender, reply) => {
  if (msg?.type === "restart-runner") {
    (async () => {
      const tabs = await chrome.tabs.query({ url: RUNNER });
      for (const t of tabs) await chrome.tabs.remove(t.id).catch(() => {});
      await ensureRunner();
      reply({ ok: true });
    })();
    return true;
  }
  if (msg?.type === "open-runner") {
    (async () => {
      const tabs = await chrome.tabs.query({ url: RUNNER });
      if (tabs.length) await chrome.tabs.update(tabs[0].id, { active: true });
      else await chrome.tabs.create({ url: RUNNER, pinned: true, active: true });
      reply({ ok: true });
    })();
    return true;
  }
});
