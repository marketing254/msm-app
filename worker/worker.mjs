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
import { readFileSync, existsSync, mkdirSync, writeFileSync } from "node:fs";
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
    if (waited === 0) { log("CAPTCHA shown. Tick the box in the browser window."); await report(jobId, "captcha", `Google is asking for a captcha during ${what}. Tick it in the Chrome window on the worker laptop.`); }
    await sleep(5000); waited += 5;
    if (waited > 1800) throw new Error("Captcha not ticked within 30 minutes. Someone needs to tick it in the Chrome window on the worker laptop; then click Run rank checks again on the report page.");
  }
  if (waited) { log("Captcha cleared, continuing."); await report(jobId, "running", `Continuing ${what}`); await sleep(3000); }
}

/**
 * Organic results on the current Google page, in order. Google changes its markup often, so this tries several
 * patterns: result links with an <h3> title, links with a heading role, and Google's /url?q= redirect links.
 */
async function organicResults(page) {
  return page.evaluate(() => {
    const unwrap = (href) => {
      try {
        const u = new URL(href);
        if (/google\./.test(u.hostname) && u.pathname === "/url") return u.searchParams.get("q") || u.searchParams.get("url") || "";
        return href;
      } catch { return ""; }
    };
    const isExternal = (href) => { try { const h = new URL(href).hostname; return /^https?:/i.test(href) && !/(^|\.)google\.|googleadservices|doubleclick|gstatic|youtube\.com\/redirect/.test(h); } catch { return false; } };
    const root = document.querySelector("#rso") || document.querySelector("#search") || document.querySelector("#center_col") || document.querySelector("[role=main]") || document.body;
    const ADS = "#tads, #tadsb, [data-text-ad], [aria-label='Ads'], [aria-label='Sponsored'], .commercial-unit-desktop-top, g-scrolling-carousel, [jscontroller][data-initq]";

    // 1. Classic layout: each result is a link with an <h3> (or heading role) title.
    const out = [];
    for (const a of root.querySelectorAll("a[href]")) {
      const titleEl = a.querySelector("h3, [role=heading]");
      if (!titleEl || a.closest(ADS)) continue;
      const href = unwrap(a.href);
      if (!isExternal(href)) continue;
      out.push({ href, title: (titleEl.innerText || "").trim(), method: "title" });
    }
    if (out.length >= 3) return out;

    // 1b. Title + shown address: Google prints each result's web address under its title ("https://site.com › page").
    //     This works even when every link on the page goes through google.com, which is what some sessions get.
    const NOISE = /^(Choose what|Search Results|Customi[sz]ed date|Web results|Page navigation|Next|Footer links|Share|People also ask|Related searches|Things to know|Images|Videos|Short videos|Top stories|Places|Discussions)/i;
    const byTitle = [];
    for (const h of root.querySelectorAll("h3, [role=heading]")) {
      const title = (h.innerText || "").replace(/\s+/g, " ").trim();
      if (!title || NOISE.test(title) || h.closest(ADS)) continue;
      // Smallest ancestor whose text contains a web address: that is this result's block.
      let el = h, href = "";
      for (let i = 0; el && el !== root && i < 8 && !href; i++) {
        el = el.parentElement; if (!el) break;
        const link = [...el.querySelectorAll("a[href]")].map((a) => unwrap(a.href)).find(isExternal);
        if (link) { href = link; break; }
        const cite = el.querySelector("cite");
        const m = ((cite && cite.innerText) || el.innerText || "").replace(/\s+/g, " ").match(/https?:\/\/([a-z0-9-]+\.)+[a-z]{2,}(\/[^\s›]*)?/i);
        if (m) href = m[0].replace(/[›…]+$/, "");
      }
      if (href) byTitle.push({ href, title, method: "title+address" });
    }
    if (byTitle.length >= 3) return byTitle;

    // 2. Any layout: website links in page order, leaving out blocks that are not organic results
    //    (AI Overview, ads, the map pack, People also ask, images, videos, related searches, navigation).
    const SKIP = /^(AI Overview|AI Mode|Sponsored|Ads?\b|People also ask|People also search|Places|Businesses|Map|Locations|Images|Videos|Short videos|Top stories|Related searches|Things to know|Discussions and forums|Perspectives|What people are saying)/i;
    const BUTTON = /^(Website|Directions|Call|Save|Share|More|Read more|Learn more|Book|Book online|Order|Menu|Reviews?)$/i;
    const main = document.querySelector("#center_col") || document.querySelector("#rcnt") || document.querySelector("[role=main]") || document.body;
    const skipped = (a) => {
      if (a.closest(`header, footer, nav, [role=navigation], [role=banner], [role=contentinfo], ${ADS}`)) return true;
      let el = a.parentElement;
      for (let i = 0; el && el !== main && i < 14; i++, el = el.parentElement) {
        const label = el.getAttribute("aria-label") || "";
        if (SKIP.test(label)) return true;
        const t = (el.innerText || "").trim();
        if (t.length > 0 && t.length < 6000 && SKIP.test(t.slice(0, 40))) return true;
      }
      return false;
    };
    const generic = [];
    for (const a of main.querySelectorAll("a[href]")) {
      const href = unwrap(a.href);
      if (!isExternal(href)) continue;
      const text = (a.innerText || "").replace(/\s+/g, " ").trim();
      if (text.length < 8 || BUTTON.test(text)) continue;
      if (skipped(a)) continue;
      generic.push({ href, title: text.split(/ (?:https?:\/\/|www\.|›)/)[0].slice(0, 120), method: "page order" });
    }
    const best = [generic, byTitle, out].sort((a, b) => b.length - a.length)[0];
    return best;
  });
}

/** What the page looked like, compactly, when no results could be read: headings, website links and the start of the text. */
async function pageStructure(page) {
  return page.evaluate(() => {
    const heads = [...document.querySelectorAll("h1, h2, h3, [role=heading]")].map((h) => (h.innerText || "").replace(/\s+/g, " ").trim()).filter(Boolean).slice(0, 25);
    const links = [...document.querySelectorAll("a[href]")].filter((a) => { try { return !/(^|\.)google\./.test(new URL(a.href).hostname); } catch { return false; } })
      .slice(0, 25).map((a) => `${new URL(a.href).hostname} :: ${(a.innerText || "").replace(/\s+/g, " ").trim().slice(0, 60)} :: ${a.parentElement?.tagName ?? ""}`);
    const ids = ["rso", "search", "center_col", "rcnt", "main", "botstuff"].filter((i) => document.getElementById(i));
    // Raw hrefs around the first result titles, so the link format Google uses is visible.
    const raw = [...document.querySelectorAll("h3")].slice(0, 4).map((h) => { let el = h; for (let i = 0; i < 4 && el && !el.querySelector("a[href]"); i++) el = el.parentElement; const a = el?.querySelector("a[href]"); return `${(h.innerText || "").slice(0, 40)} => ${a ? a.getAttribute("href")?.slice(0, 140) : "no anchor"} | tag=${h.parentElement?.tagName} ping=${a?.hasAttribute("ping")} data-href=${a?.getAttribute("data-href")?.slice(0, 60) ?? ""}`; });
    return `url=${location.href.slice(0, 120)}\nids=${ids.join(",")} anchors=${document.querySelectorAll("a[href]").length} h3=${document.querySelectorAll("h3").length}\nHEADINGS: ${heads.join(" | ")}\nRESULT LINKS:\n${raw.join("\n")}\nEXTERNAL LINKS:\n${links.join("\n")}\nTEXT: ${document.body.innerText.replace(/\s+/g, " ").slice(0, 1500)}`;
  }).catch((e) => `structure not readable: ${e.message}`);
}

async function search(page, jobId, keyword, city, state, clientDomain) {
  // Same query a person types: keyword plus city and state.
  const q = `${keyword} ${city} ${state}`;
  const url = `https://www.google.com/search?q=${encodeURIComponent(q)}`;
  await page.goto(url, { waitUntil: "domcontentloaded", timeout: 60000 });
  await acceptConsent(page);
  await captchaGate(page, jobId, `"${q}"`);
  await page.waitForSelector("#rso, #search, [role=main]", { timeout: 20000 }).catch(() => {});
  await sleep(1500);
  let raw = await organicResults(page);
  // Nothing readable on the normal page (AI answer only, new layout): open Google's own "Web" tab, which lists only website results.
  if (raw.length === 0) {
    await page.goto(`https://www.google.com/search?q=${encodeURIComponent(q)}&udm=14`, { waitUntil: "domcontentloaded", timeout: 60000 }).catch(() => {});
    await captchaGate(page, jobId, `"${q}" (web results)`);
    await page.waitForSelector("#rso, #search, [role=main]", { timeout: 20000 }).catch(() => {});
    await sleep(1500);
    raw = await organicResults(page);
  }
  const seen = new Set(); const results = [];
  for (const x of raw) {
    const d = domainOf(x.href);
    if (!d || d.includes("google.") || seen.has(d)) continue;
    seen.add(d); results.push({ position: results.length + 1, domain: d, title: x.title, url: x.href });
    if (results.length === 10) break;
  }
  if (results.length === 0) {
    // Report what the page showed instead, so the app says "could not be read" rather than "Not on page 1".
    const shown = await page.evaluate(() => `${document.title} | ${document.body.innerText.replace(/\s+/g, " ").slice(0, 200)}`).catch(() => "");
    const structure = await pageStructure(page);
    // Keep a copy of the page on this PC for whoever fixes the reader.
    try { mkdirSync(join(here, "debug"), { recursive: true }); writeFileSync(join(here, "debug", `${q.replace(/[^a-z0-9]+/gi, "-").slice(0, 60)}.html`), await page.content()); } catch { /* not essential */ }
    log(`  could not read results for "${q}": ${shown.slice(0, 120)}`);
    return { keyword, city, results, clientPosition: null, unread: true, note: shown.slice(0, 300), debug: structure.slice(0, 5000) };
  }
  log(`  read ${results.length} results (${raw[0]?.method ?? "?"})`);
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

/** Listing links the reviewer pasted at checkpoint 3: open each one and send back its text. */
async function runPagesJob(job) {
  const pages = job.pages ?? [];
  log(`Job ${job.id}: reading ${pages.length} pasted listing links`);
  await report(job.id, "running", `Reading ${pages.length} pasted listing links`);
  const opts = { headless: HEADLESS, chromiumSandbox: true, viewport: { width: 1280, height: 900 }, locale: "en-US", ignoreDefaultArgs: ["--enable-automation"] };
  let ctx;
  try { ctx = await chromium.launchPersistentContext(join(here, "profile"), { ...opts, channel: "chrome" }); }
  catch { ctx = await chromium.launchPersistentContext(join(here, "profile"), opts); }
  const page = ctx.pages()[0] ?? (await ctx.newPage());
  const startedAt = new Date().toISOString(); const out = [];
  try {
    for (let i = 0; i < pages.length; i++) {
      const p = pages[i];
      try { await page.goto(p.url, { waitUntil: "domcontentloaded", timeout: 60000 }); out.push({ platform: p.platform, url: page.url(), text: await pageText(page) }); log(`  ${p.platform}: read`); }
      catch (e) { out.push({ platform: p.platform, url: p.url, text: "" }); log(`  ${p.platform} failed: ${e.message.slice(0, 80)}`); }
      await report(job.id, "running", `Read ${i + 1} of ${pages.length}: ${p.platform}`);
      await pause();
    }
    await report(job.id, "done", "Finished", { searches: [], aiMode: [], pages: out, startedAt, finishedAt: new Date().toISOString(), machine: MACHINE });
    log(`Job ${job.id} done.`);
  } catch (e) {
    log(`Job ${job.id} failed: ${e.message}`); await report(job.id, "failed", e.message.slice(0, 200));
  } finally { await ctx.close().catch(() => {}); }
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
  if (job.kind === "pages") return runPagesJob(job);
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
      log(`  ${n}/${total} ${k} | ${c.name}: ${s.unread ? "results could not be read" : s.clientPosition ? "#" + s.clientPosition : "not on page 1"}`);
      // The first 3 searches all unreadable: Google is showing a page the worker cannot read. Stop instead of
      // spending 30 searches, and say what the page showed.
      if (n === 3 && searches.every((x) => x.unread)) {
        throw new Error(`Google results could not be read on the first 3 searches. The page showed: ${(searches[2].note || "nothing").slice(0, 140)}`);
      }
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
    // Send the page structure of the first unreadable search with the failure, so the reader can be fixed remotely.
    const debug = searches.find((s) => s.debug)?.debug;
    await api(`/api/worker/jobs/${job.id}`, { method: "POST", body: JSON.stringify({ status: "failed", message: e.message.slice(0, 200), debug }) }).catch((err) => log("report failed:", err.message));
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
