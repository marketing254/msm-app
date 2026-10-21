// The worker, running as an extension page in the person's own Chrome. Same job protocol as worker/worker.mjs:
//   GET  <app>/api/worker/jobs            -> pending jobs (also the heartbeat)
//   POST <app>/api/worker/jobs/<id>       -> { status, message, result?, debug? }
// Searches open in ONE normal Chrome tab, one after another, with human-like pauses. No automation link to the
// browser, so Google sees ordinary use.

/* global readPageState, readOrganicResults, readPageStructure, readPageText, readFirstLinkTo, showOverlay */

const POLL_MS = 20000;
const GAP_MS = [18000, 28000];       // between searches
const REST_EVERY = 10; const REST_MS = 45000;
const CAPTCHA_MAX_MS = 30 * 60000;
const BLOCK_MAX_MS = 45 * 60000;

let settings = { appUrl: "", token: "", machine: "Chrome extension" };
let paused = false;
let tabId = null;
let currentJob = null;
// Progress shown on the search tab's top bar.
const progress = { text: "", done: 0, total: 0 };

async function setPaused(v, why = "") {
  paused = v;
  await chrome.storage.local.set({ paused: v });
  $("pause").textContent = v ? "Resume" : "Pause";
  if (why) log(why);
}
/** Honour a pause: waits here until Resume. Called between pages, so the current page always finishes. */
async function pausePoint(jobId) {
  if (!paused) return;
  setStatus("warn", "Paused", "Click Resume to continue. The report waits.");
  if (jobId) await report(jobId, "running", "Paused on the helper laptop; click Resume in the MSM Rank Helper tab");
  while (paused) await sleep(1500);
  setStatus("ok", "Resumed");
}
chrome.storage.onChanged.addListener((ch, area) => {
  if (area === "local" && ch.paused && ch.paused.newValue !== paused) { paused = !!ch.paused.newValue; $("pause").textContent = paused ? "Resume" : "Pause"; log(paused ? "Paused from the search tab. The current page finishes, then it waits." : "Resumed."); }
});

const $ = (id) => document.getElementById(id);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const rand = (a, b) => a + Math.floor(Math.random() * (b - a));
const domainOf = (url) => { try { return new URL(url).hostname.replace(/^www\./, "").toLowerCase(); } catch { return ""; } };

function log(...a) {
  const line = `${new Date().toTimeString().slice(0, 8)} ${a.join(" ")}`;
  const pre = $("log"); pre.textContent = (pre.textContent + "\n" + line).split("\n").slice(-300).join("\n"); pre.scrollTop = pre.scrollHeight;
}
function setStatus(cls, text, detail = "") { const s = $("status"); s.className = `status ${cls}`; s.textContent = text; $("detail").textContent = detail; }

/* ---------------- app API ---------------- */
async function api(path, init = {}) {
  const res = await fetch(settings.appUrl.replace(/\/$/, "") + path, {
    ...init, headers: { Authorization: `Bearer ${settings.token}`, "X-Machine": settings.machine, "Content-Type": "application/json", ...(init.headers ?? {}) },
  });
  if (!res.ok) throw new Error(`${path}: HTTP ${res.status} ${(await res.text().catch(() => "")).slice(0, 120)}`);
  return res.json();
}
const report = (id, status, message, extra = {}) => api(`/api/worker/jobs/${id}`, { method: "POST", body: JSON.stringify({ status, message, ...extra }) }).catch((e) => log("report failed:", e.message));

/* ---------------- the one search tab ---------------- */
async function ensureTab() {
  if (tabId != null) { try { await chrome.tabs.get(tabId); return tabId; } catch { tabId = null; } }
  const t = await chrome.tabs.create({ url: "about:blank", active: false });
  tabId = t.id; return tabId;
}
async function closeTab() { if (tabId != null) { await chrome.tabs.remove(tabId).catch(() => {}); tabId = null; } }

function waitForLoad(id, timeoutMs = 60000) {
  return new Promise((resolve) => {
    let done = false;
    const finish = () => { if (done) return; done = true; chrome.tabs.onUpdated.removeListener(onUpd); resolve(); };
    const onUpd = (tid, info) => { if (tid === id && info.status === "complete") finish(); };
    chrome.tabs.onUpdated.addListener(onUpd);
    setTimeout(finish, timeoutMs);
  });
}
async function goto(url) {
  const id = await ensureTab();
  const loaded = waitForLoad(id);
  await chrome.tabs.update(id, { url });
  await loaded;
  await sleep(1200);
  // Progress bar on the page itself, so anyone looking at the tab sees where the run is and can pause it.
  try { await chrome.scripting.executeScript({ target: { tabId: id }, func: showOverlay, args: [progress] }); } catch { /* some pages refuse scripts; the pinned tab still shows progress */ }
}
function setProgress(text, done, total) { progress.text = text; progress.done = done; progress.total = total; }
async function run(fn, ...args) {
  const id = await ensureTab();
  const [r] = await chrome.scripting.executeScript({ target: { tabId: id }, func: fn, args });
  return r?.result;
}
async function focusTab() { try { const t = await chrome.tabs.get(tabId); await chrome.windows.update(t.windowId, { focused: true }); await chrome.tabs.update(tabId, { active: true }); } catch { /* fine */ } }

/** Waits out a Google captcha (someone ticks it) or a 403 block (retries every 2 min). */
async function gate(jobId, what) {
  let state = await run(readPageState);
  if (state === "consent") { await sleep(1500); state = await run(readPageState); }
  let blockedMs = 0;
  while (state === "blocked") {
    if (blockedMs === 0) { log("Google 403 block. Waiting, retrying every 2 minutes."); setStatus("warn", "Google has blocked this connection for a while", "Retrying every 2 minutes, up to 45 minutes."); await report(jobId, "captcha", "Google has blocked this connection for a while (403). Retrying every 2 minutes; nothing to do unless it lasts over 45 minutes."); }
    await sleep(120000); blockedMs += 120000;
    if (blockedMs > BLOCK_MAX_MS) throw new Error("Google 403 block did not clear within 45 minutes. Wait an hour and click Run rank checks again.");
    await chrome.tabs.reload(tabId).catch(() => {}); await waitForLoad(tabId); await sleep(1000);
    state = await run(readPageState);
  }
  if (blockedMs) { log("403 cleared."); await report(jobId, "running", `Continuing ${what}`); }
  let waited = 0;
  while (state === "captcha") {
    if (waited === 0) {
      log("CAPTCHA. Tick it in the Google tab."); $("captcha").style.display = "block"; setStatus("warn", "Google is asking for a captcha", "Tick the box in the Google tab; searches continue by themselves.");
      await report(jobId, "captcha", `Google is asking for a captcha during ${what}. Tick it in the Google tab on the laptop running the MSM Rank Helper.`);
      await focusTab();
    }
    await sleep(5000); waited += 5000;
    if (waited > CAPTCHA_MAX_MS) throw new Error("Captcha not ticked within 30 minutes. Tick it in the Google tab, then click Run rank checks again on the report page.");
    state = await run(readPageState);
  }
  if (waited) { $("captcha").style.display = "none"; log("Captcha cleared."); await report(jobId, "running", `Continuing ${what}`); await sleep(3000); }
}

/* ---------------- readers ---------------- */
async function search(jobId, keyword, city, state, clientDomain) {
  const q = `${keyword} ${city} ${state}`;
  await goto(`https://www.google.com/search?q=${encodeURIComponent(q)}`);
  await gate(jobId, `"${q}"`);
  await sleep(1500);
  let raw = await run(readOrganicResults) ?? [];
  if (raw.length === 0) {
    await goto(`https://www.google.com/search?q=${encodeURIComponent(q)}&udm=14`);
    await gate(jobId, `"${q}" (web results)`);
    await sleep(1500);
    raw = await run(readOrganicResults) ?? [];
  }
  const seen = new Set(); const results = [];
  for (const x of raw) {
    const d = domainOf(x.href);
    if (!d || d.includes("google.") || seen.has(d)) continue;
    seen.add(d); results.push({ position: results.length + 1, domain: d, title: x.title, url: x.href });
    if (results.length === 10) break;
  }
  if (results.length === 0) {
    const page = await run(readPageText, 200);
    const debug = await run(readPageStructure);
    log(`  could not read results for "${q}"`);
    return { keyword, city, results, clientPosition: null, unread: true, note: `${page?.title ?? ""} | ${page?.text ?? ""}`.slice(0, 300), debug: String(debug ?? "").slice(0, 5000) };
  }
  const mine = results.find((x) => x.domain === clientDomain || x.domain.endsWith("." + clientDomain));
  return { keyword, city, results, clientPosition: mine ? mine.position : null, method: raw[0]?.method };
}

async function aiMode(jobId, keyword, city, state) {
  const q = `${keyword} ${city} ${state}`;
  await goto(`https://www.google.com/search?q=${encodeURIComponent(q)}&udm=50`);
  await gate(jobId, `AI Mode for "${q}"`);
  await sleep(7000);
  const p = await run(readPageText, 6000);
  return { keyword, text: p?.text ?? "" };
}

async function googlePanel(jobId, name, city, state) {
  const q = `${name} ${city} ${state}`;
  await goto(`https://www.google.com/search?q=${encodeURIComponent(q)}`);
  await gate(jobId, `"${q}"`);
  await sleep(2500);
  const p = await run(readPageText, 7000);
  return { url: p?.url ?? "", text: p?.text ?? "" };
}
async function googleSite(jobId, name, city, site) {
  const q = `${name} ${city} site:${site}`;
  await goto(`https://www.google.com/search?q=${encodeURIComponent(q)}`);
  await gate(jobId, `"${q}"`);
  await sleep(2500);
  const first = await run(readFirstLinkTo, site);
  const p = await run(readPageText, 7000);
  return { url: first ?? "", text: p?.text ?? "" };
}
async function plainPage(url) {
  await goto(url); await sleep(2500);
  const p = await run(readPageText, 7000);
  return { url: p?.url ?? url, text: p?.text ?? "" };
}

async function readListings(job, tick = () => {}) {
  const L = job.listings; const out = [];
  const step = async (platform, fn) => {
    await pausePoint(job.id); tick(); progress.text = `${job.clientName}: reading ${platform} listing`;
    try { const r = await fn(); out.push({ platform, url: r.url ?? "", text: r.text ?? "" }); log(`  listing ${platform}: ${r.text ? "read" : "empty"}`); }
    catch (e) { out.push({ platform, url: "", text: "" }); log(`  listing ${platform} failed: ${e.message.slice(0, 80)}`); }
    await report(job.id, "running", `Reading ${platform} listing`); await sleep(rand(...GAP_MS));
  };
  await step("Google", () => googlePanel(job.id, L.name, L.city, L.state));
  await step("Bing", () => plainPage(`https://www.bing.com/search?q=${encodeURIComponent(`${L.name} ${L.city} ${L.state}`)}`));
  await step("Yelp", () => plainPage(`https://www.yelp.com/search?find_desc=${encodeURIComponent(L.name)}&find_loc=${encodeURIComponent(`${L.city}, ${L.state}`)}`));
  await step("Facebook", () => googleSite(job.id, L.name, L.city, "facebook.com"));
  await step("Yellow Pages", () => plainPage(`https://www.yellowpages.com/search?search_terms=${encodeURIComponent(L.name)}&geo_location_terms=${encodeURIComponent(`${L.city}, ${L.state}`)}`));
  if (L.vertical !== "Legal") await step("Zocdoc", () => googleSite(job.id, L.name, L.city, "zocdoc.com"));
  return out;
}

/* ---------------- jobs ---------------- */
async function runRankJob(job) {
  const total = job.keywords.length * job.cities.length;
  log(`Job ${job.id}: ${job.clientName}, ${total} searches + ${(job.aiKeywords ?? job.keywords).length} AI Mode reads`);
  setStatus("ok", `Working on ${job.clientName}`, `${total} searches, about ${Math.round(total * 0.4 + 6)} minutes`);
  await report(job.id, "running", `Starting ${total} searches`);
  const startedAt = new Date().toISOString();
  const searches = []; const ai = [];
  const aiKeywords = job.aiKeywords ?? job.keywords;
  const pages = total + aiKeywords.length + (job.listings ? (job.listings.vertical === "Legal" ? 5 : 6) : 0);
  let page = 0;
  try {
    let n = 0;
    for (const c of job.cities) for (const k of job.keywords) {
      n++;
      await pausePoint(job.id);
      setProgress(`${job.clientName}: search ${n} of ${total}, "${k}" in ${c.name}`, page++, pages);
      const s = await search(job.id, k, c.name, c.state, job.clientDomain);
      searches.push(s);
      log(`  ${n}/${total} ${k} | ${c.name}: ${s.unread ? "results could not be read" : s.clientPosition ? "#" + s.clientPosition : "not on page 1"}${s.method ? ` (${s.method})` : ""}`);
      if (n === 3 && searches.every((x) => x.unread)) throw new Error(`Google results could not be read on the first 3 searches. The page showed: ${(searches[2].note || "nothing").slice(0, 140)}`);
      await report(job.id, "running", `Search ${n} of ${total}: ${k} in ${c.name}`);
      setStatus("ok", `Working on ${job.clientName}`, `Search ${n} of ${total}`);
      await sleep(rand(...GAP_MS));
      if (n % REST_EVERY === 0 && n < total) { log("  short rest"); await sleep(REST_MS); }
    }
    const home = job.cities[0];
    for (let i = 0; i < aiKeywords.length; i++) {
      await pausePoint(job.id);
      setProgress(`${job.clientName}: AI Mode ${i + 1} of ${aiKeywords.length}, "${aiKeywords[i]}"`, page++, pages);
      ai.push(await aiMode(job.id, aiKeywords[i], home.name, home.state));
      log(`  AI Mode ${i + 1}/${aiKeywords.length}: ${aiKeywords[i]}`);
      await report(job.id, "running", `AI Mode ${i + 1} of ${aiKeywords.length}: ${aiKeywords[i]}`);
      await sleep(rand(...GAP_MS));
    }
    const listings = job.listings ? await readListings(job, () => { setProgress(`${job.clientName}: reading listings`, page++, pages); }) : [];
    const result = { searches: searches.map(({ method, ...s }) => s), aiMode: ai, listings, startedAt, finishedAt: new Date().toISOString(), machine: settings.machine };
    await report(job.id, "done", "Finished", { result });
    log(`Job ${job.id} done.`);
  } catch (e) {
    log(`Job ${job.id} failed: ${e.message}`);
    const debug = searches.find((s) => s.debug)?.debug;
    await report(job.id, "failed", e.message.slice(0, 200), debug ? { debug } : {});
  } finally { await closeTab(); $("captcha").style.display = "none"; }
}

async function runCompetitorJob(job) {
  const names = job.competitorNames ?? [];
  log(`Job ${job.id}: Google reviews for ${names.length} competitors`);
  setStatus("ok", `Reading ${names.length} competitor profiles`);
  await report(job.id, "running", `Reading ${names.length} competitor profiles`);
  const startedAt = new Date().toISOString(); const competitors = [];
  try {
    for (let i = 0; i < names.length; i++) {
      const c = names[i];
      await pausePoint(job.id);
      setProgress(`${job.clientName}: competitor ${i + 1} of ${names.length}, ${c.name}`, i, names.length);
      const r = await googlePanel(job.id, c.name, c.city, c.state);
      competitors.push({ id: c.id, url: r.url, text: r.text });
      log(`  competitor ${i + 1}/${names.length}: ${c.name}`);
      await report(job.id, "running", `Competitor ${i + 1} of ${names.length}: ${c.name}`);
      await sleep(rand(...GAP_MS));
    }
    await report(job.id, "done", "Finished", { result: { searches: [], aiMode: [], competitors, startedAt, finishedAt: new Date().toISOString(), machine: settings.machine } });
    log(`Job ${job.id} done.`);
  } catch (e) {
    log(`Job ${job.id} failed: ${e.message}`); await report(job.id, "failed", e.message.slice(0, 200));
  } finally { await closeTab(); }
}

/* ---------------- main loop ---------------- */
async function loop() {
  for (;;) {
    if (paused) { setStatus("warn", "Paused", "Click Resume to continue. No searches run while paused."); await sleep(3000); continue; }
    try {
      const { jobs } = await api("/api/worker/jobs");
      if (jobs.length) {
        currentJob = jobs[0];
        if (currentJob.kind === "competitors") await runCompetitorJob(currentJob); else await runRankJob(currentJob);
        currentJob = null;
      } else {
        setStatus("ok", "Online, waiting for a report", `Connected to ${settings.appUrl} as "${settings.machine}". Last check ${new Date().toTimeString().slice(0, 8)}.`);
        await sleep(POLL_MS);
      }
    } catch (e) {
      const m = e.message || String(e);
      setStatus("bad", "Cannot reach MSM Studio", /401/.test(m) ? "The token does not match the app's WORKER_TOKEN. Fix it in Settings." : m.slice(0, 160));
      log("App not reachable:", m.slice(0, 160));
      await sleep(POLL_MS);
    }
  }
}

(async () => {
  const s = await chrome.storage.local.get(["appUrl", "token", "machine", "paused"]);
  settings = { appUrl: s.appUrl ?? "", token: s.token ?? "", machine: s.machine || "Chrome extension" };
  paused = !!s.paused; $("pause").textContent = paused ? "Resume" : "Pause";
  $("who").textContent = settings.machine;
  $("pause").onclick = () => setPaused(!paused, !paused ? "Paused by you. The current page finishes, then it waits." : "Resumed.");
  $("settings").onclick = () => chrome.runtime.openOptionsPage();
  if (!settings.appUrl || !settings.token) { setStatus("bad", "Not set up yet", "Click Settings and enter the app address and token."); return; }
  log(`MSM Rank Helper on "${settings.machine}", app ${settings.appUrl}`);
  loop();
})();
