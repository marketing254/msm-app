// MSM rank worker. Runs on a PC with a normal internet connection, not on a server.
// Asks the app for pending rank jobs, does each Google search in a real browser with the city set as the location,
// reads the top 10 results and the AI Mode answer, and posts everything back. Nothing is stored on this PC
// except the browser profile (cookies) in ./profile.
//
// Configure with environment variables or a .env file next to this script:
//   MSM_APP_URL=http://localhost:3000      the app (local or the Vercel URL)
//   WORKER_TOKEN=...                       same value as WORKER_TOKEN in the app's .env.local
//   SEARCH_DELAY_MS=15000                  pause between searches (default 15 s, random +0-5 s)
//   HEADLESS=0                             keep 0 so you can tick a captcha if Google asks

import { chromium } from "playwright";
import { readFileSync, existsSync } from "node:fs";
import { hostname } from "node:os";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
if (existsSync(join(here, ".env"))) {
  for (const line of readFileSync(join(here, ".env"), "utf8").split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z_]+)\s*=\s*(.*)\s*$/); if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^['"]|['"]$/g, "");
  }
}

const APP = (process.env.MSM_APP_URL ?? "http://localhost:3000").replace(/\/$/, "");
const TOKEN = process.env.WORKER_TOKEN ?? "";
const DELAY = Number(process.env.SEARCH_DELAY_MS ?? 15000);
const HEADLESS = process.env.HEADLESS === "1"; // default: visible window, so a captcha can be ticked
const MACHINE = hostname();
const POLL_MS = 15000;

if (TOKEN.length < 16) { console.error("WORKER_TOKEN missing or too short. Put the same token as the app's .env.local in worker/.env"); process.exit(1); }

const log = (...a) => console.log(new Date().toTimeString().slice(0, 8), ...a);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const pause = () => sleep(DELAY + Math.random() * 5000);

async function api(path, init = {}) {
  const res = await fetch(APP + path, { ...init, headers: { Authorization: `Bearer ${TOKEN}`, "X-Machine": MACHINE, "Content-Type": "application/json", ...(init.headers ?? {}) } });
  if (!res.ok) throw new Error(`${path}: HTTP ${res.status} ${await res.text().catch(() => "")}`);
  return res.json();
}
const report = (id, status, message, result) => api(`/api/worker/jobs/${id}`, { method: "POST", body: JSON.stringify({ status, message, result }) }).catch((e) => log("report failed:", e.message));

function domainOf(url) { try { return new URL(url).hostname.replace(/^www\./, "").toLowerCase(); } catch { return ""; } }

async function acceptConsent(page) {
  for (const t of ["Accept all", "I agree", "Accept"]) {
    const b = page.getByRole("button", { name: t, exact: false }).first();
    if (await b.isVisible().catch(() => false)) { await b.click().catch(() => {}); await sleep(800); return; }
  }
}

async function blocked403(page) {
  const t = (await page.locator("body").innerText().catch(() => "")).slice(0, 400);
  return /403\. That.s an error|does not have permission to get URL/i.test(t);
}

async function captchaGate(page, jobId, what) {
  let waited = 0;
  // Google's temporary block (403 page): wait and reload every 2 minutes, up to 45 minutes.
  let blockedFor = 0;
  while (await blocked403(page)) {
    if (blockedFor === 0) { log("Google returned 403: this connection is blocked for a while. Waiting."); await report(jobId, "captcha", "Google has blocked this connection for a while (403). Retrying every 2 minutes; nothing to do unless it lasts over 45 minutes."); }
    await sleep(120000); blockedFor += 2;
    if (blockedFor > 45) throw new Error("Google 403 block did not clear within 45 minutes. Wait an hour and start the report again.");
    await page.reload({ waitUntil: "domcontentloaded" }).catch(() => {});
  }
  if (blockedFor) { log("403 cleared, continuing."); await report(jobId, "running", `Continuing ${what}`); }
  while (page.url().includes("/sorry/") || (await page.locator("text=unusual traffic").first().isVisible().catch(() => false))) {
    if (waited === 0) { log("CAPTCHA shown. Tick the box in the browser window."); await report(jobId, "captcha", `Google is asking for a captcha during ${what}. Tick it in the worker window.`); }
    await sleep(5000); waited += 5;
    if (waited > 600) throw new Error("Captcha not solved within 10 minutes");
  }
  if (waited) { log("Captcha cleared, continuing."); await report(jobId, "running", `Continuing ${what}`); await sleep(3000); }
}

async function search(page, jobId, keyword, city, state, clientDomain) {
  // Same query a person types: keyword plus city and state. No extra parameters, which Google treats as an automation signal.
  const q = `${keyword} ${city} ${state}`;
  const url = `https://www.google.com/search?q=${encodeURIComponent(q)}`;
  await page.goto(url, { waitUntil: "domcontentloaded", timeout: 60000 });
  await acceptConsent(page);
  await captchaGate(page, jobId, `"${q}"`);
  await page.waitForSelector("#search", { timeout: 20000 }).catch(() => {});
  const raw = await page.$$eval("#search a:has(h3)", (as) => as.map((a) => ({ href: a.href, title: a.querySelector("h3")?.innerText?.trim() ?? "" })));
  const seen = new Set(); const results = [];
  for (const x of raw) {
    const d = domainOf(x.href);
    if (!d || d.includes("google.") || seen.has(d)) continue;
    seen.add(d); results.push({ position: results.length + 1, domain: d, title: x.title, url: x.href });
    if (results.length === 10) break;
  }
  const mine = results.find((x) => x.domain === clientDomain || x.domain.endsWith("." + clientDomain));
  return { keyword, city, results, clientPosition: mine ? mine.position : null };
}

async function aiMode(page, jobId, keyword, city, state) {
  const q = `${keyword} ${city} ${state}`;
  await page.goto(`https://www.google.com/search?q=${encodeURIComponent(q)}&udm=50`, { waitUntil: "domcontentloaded", timeout: 60000 });
  await acceptConsent(page);
  await captchaGate(page, jobId, `AI Mode for "${q}"`);
  await sleep(6000);
  const text = await page.evaluate(() => document.body.innerText).catch(() => "");
  return { keyword, text: text.replace(/\s+/g, " ").slice(0, 6000) };
}

/** Reads a page's visible text after a short wait. */
async function pageText(page, max = 7000) {
  await sleep(2500);
  const t = await page.evaluate(() => document.body.innerText).catch(() => "");
  return t.replace(/\s+/g, " ").slice(0, max);
}

/** Google search for "<business> <city> <state>": the business panel text and the page URL. */
async function googlePanel(page, jobId, name, city, state) {
  const q = `${name} ${city} ${state}`;
  await page.goto(`https://www.google.com/search?q=${encodeURIComponent(q)}`, { waitUntil: "domcontentloaded", timeout: 60000 });
  await acceptConsent(page); await captchaGate(page, jobId, `"${q}"`);
  return { url: page.url(), text: await pageText(page) };
}

/** Google search restricted to one site: first result link plus the page text. */
async function googleSite(page, jobId, name, city, site) {
  const q = `${name} ${city} site:${site}`;
  await page.goto(`https://www.google.com/search?q=${encodeURIComponent(q)}`, { waitUntil: "domcontentloaded", timeout: 60000 });
  await acceptConsent(page); await captchaGate(page, jobId, `"${q}"`);
  const first = await page.$$eval("#search a:has(h3)", (as) => as.map((a) => a.href)).then((h) => h.find((x) => x.includes(site)) ?? "").catch(() => "");
  return { url: first, text: await pageText(page) };
}

async function readListings(page, job) {
  const L = job.listings; const out = [];
  const step = async (platform, fn) => {
    try { const r = await fn(); out.push({ platform, url: r.url ?? "", text: r.text ?? "" }); log(`  listing ${platform}: ${r.text ? "read" : "empty"}`); }
    catch (e) { out.push({ platform, url: "", text: "" }); log(`  listing ${platform} failed: ${e.message.slice(0, 80)}`); }
    await report(job.id, "running", `Reading ${platform} listing`); await pause();
  };
  await step("Google", () => googlePanel(page, job.id, L.name, L.city, L.state));
  await step("Bing", async () => { await page.goto(`https://www.bing.com/search?q=${encodeURIComponent(`${L.name} ${L.city} ${L.state}`)}`, { waitUntil: "domcontentloaded", timeout: 60000 }); return { url: page.url(), text: await pageText(page) }; });
  await step("Yelp", async () => { await page.goto(`https://www.yelp.com/search?find_desc=${encodeURIComponent(L.name)}&find_loc=${encodeURIComponent(`${L.city}, ${L.state}`)}`, { waitUntil: "domcontentloaded", timeout: 60000 }); return { url: page.url(), text: await pageText(page) }; });
  await step("Facebook", () => googleSite(page, job.id, L.name, L.city, "facebook.com"));
  await step("Yellow Pages", async () => { await page.goto(`https://www.yellowpages.com/search?search_terms=${encodeURIComponent(L.name)}&geo_location_terms=${encodeURIComponent(`${L.city}, ${L.state}`)}`, { waitUntil: "domcontentloaded", timeout: 60000 }); return { url: page.url(), text: await pageText(page) }; });
  if (L.vertical !== "Legal") await step("Zocdoc", () => googleSite(page, job.id, L.name, L.city, "zocdoc.com"));
  return out;
}

async function runCompetitorJob(job) {
  const names = job.competitorNames ?? [];
  log(`Job ${job.id}: Google reviews for ${names.length} competitors`);
  await report(job.id, "running", `Reading ${names.length} competitor profiles`);
  const opts = { headless: HEADLESS, chromiumSandbox: true, viewport: { width: 1280, height: 900 }, locale: "en-US", ignoreDefaultArgs: ["--enable-automation"] };
  let ctx;
  try { ctx = await chromium.launchPersistentContext(join(here, "profile"), { ...opts, channel: "chrome" }); }
  catch { ctx = await chromium.launchPersistentContext(join(here, "profile"), opts); }
  const page = ctx.pages()[0] ?? (await ctx.newPage());
  const startedAt = new Date().toISOString(); const competitors = [];
  try {
    for (let i = 0; i < names.length; i++) {
      const c = names[i];
      const r = await googlePanel(page, job.id, c.name, c.city, c.state);
      competitors.push({ id: c.id, url: r.url, text: r.text });
      log(`  competitor ${i + 1}/${names.length}: ${c.name}`);
      await report(job.id, "running", `Competitor ${i + 1} of ${names.length}: ${c.name}`);
      await pause();
    }
    await report(job.id, "done", "Finished", { searches: [], aiMode: [], competitors, startedAt, finishedAt: new Date().toISOString(), machine: MACHINE });
    log(`Job ${job.id} done.`);
  } catch (e) {
    log(`Job ${job.id} failed: ${e.message}`); await report(job.id, "failed", e.message.slice(0, 200));
  } finally { await ctx.close().catch(() => {}); }
}

async function runJob(job) {
  if (job.kind === "competitors") return runCompetitorJob(job);
  const total = job.keywords.length * job.cities.length;
  log(`Job ${job.id}: ${job.clientName}, ${total} searches + ${job.keywords.length} AI Mode reads`);
  await report(job.id, "running", `Starting ${total} searches`);
  // Prefer the installed Google Chrome: it looks like a normal browser to Google. Falls back to Playwright's Chromium.
  // chromiumSandbox: true keeps Chrome's own sandbox on. No extra command-line switches, so Chrome shows no warnings.
  const opts = { headless: HEADLESS, chromiumSandbox: true, viewport: { width: 1280, height: 900 }, locale: "en-US", ignoreDefaultArgs: ["--enable-automation"] };
  let ctx;
  try { ctx = await chromium.launchPersistentContext(join(here, "profile"), { ...opts, channel: "chrome" }); }
  catch { ctx = await chromium.launchPersistentContext(join(here, "profile"), opts); }
  const page = ctx.pages()[0] ?? (await ctx.newPage());
  const startedAt = new Date().toISOString();
  const searches = []; const ai = [];
  try {
    let n = 0;
    for (const c of job.cities) for (const k of job.keywords) {
      n++;
      const s = await search(page, job.id, k, c.name, c.state, job.clientDomain);
      searches.push(s);
      log(`  ${n}/${total} ${k} | ${c.name}: ${s.clientPosition ? "#" + s.clientPosition : "not on page 1"}`);
      await report(job.id, "running", `Search ${n} of ${total}: ${k} in ${c.name}`);
      await pause();
      if (n % 10 === 0 && n < total) { log("  short rest"); await sleep(30000); }
    }
    const home = job.cities[0];
    const aiKeywords = job.aiKeywords ?? job.keywords;
    for (let i = 0; i < aiKeywords.length; i++) {
      const k = aiKeywords[i];
      ai.push(await aiMode(page, job.id, k, home.name, home.state));
      log(`  AI Mode ${i + 1}/${aiKeywords.length}: ${k}`);
      await report(job.id, "running", `AI Mode ${i + 1} of ${aiKeywords.length}: ${k}`);
      await pause();
    }
    const listings = job.listings ? await readListings(page, job) : [];
    await report(job.id, "done", "Finished", { searches, aiMode: ai, listings, startedAt, finishedAt: new Date().toISOString(), machine: MACHINE });
    log(`Job ${job.id} done.`);
  } catch (e) {
    log(`Job ${job.id} failed: ${e.message}`);
    await report(job.id, "failed", e.message.slice(0, 200));
  } finally {
    await ctx.close().catch(() => {});
  }
}

log(`MSM rank worker on ${MACHINE}, app ${APP}, delay ${DELAY} ms, ${HEADLESS ? "headless" : "visible browser"}`);
for (;;) {
  try {
    const { jobs } = await api("/api/worker/jobs");
    if (jobs.length) await runJob(jobs[0]);
    else await sleep(POLL_MS);
  } catch (e) {
    log("App not reachable:", e.message); await sleep(POLL_MS);
  }
}
