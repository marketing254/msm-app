import type { Finding, Intake, KeywordOption, NotifyChannel, Report, Vertical } from "./types";
import {
  CHECKPOINTS, DRIVE_FOLDER, nextStepLabel, PLATFORMS, STEP_TITLES, stepDetail, VERTICAL_CITIES, VERTICAL_KEYWORDS, type Seed,
} from "./data";
import { env, has } from "./env";
import { inspectSite } from "./site";
import { aiModeNames, readGoogleReviews, readListing, servicesAndKeywords, writeFindings } from "./openai";
import { createCompetitorJob, createJob, domainOf, getJob, ingest, JOB_TIMEOUT_MS, updateJob, workerOnline } from "./worker";
import type { RankJob } from "./types";
import { runPageSpeed } from "./pagespeed";
import { runCopyscape } from "./copyscape";
import { appendRows, createReportSheet, nextDataId, nextLogId, upsertReportRow } from "./google";
import { buildWorkbook } from "./excel";
import { reportDataRows, reportRow } from "./dbExport";
import { summarise } from "@/components/ui";
import { loadAll, persist } from "./persist";
import { restoreJob, restoreWorker } from "./worker";

/**
 * Report store. Reports live in memory on the server; every approval is also written to the MSM Database sheet.
 * Research steps run one at a time when the page polls /api/reports/[id]/advance.
 * Steps with a connected source use it; the rest stay empty and say "not run" (provenance).
 */
interface Meta { profile: Seed["rankProfile"]; lastStepAt: number; busy: boolean }
interface Store { reports: Map<string, Report>; meta: Map<string, Meta>; nextId: number }

const STEP_MS = 2500;

function hashStr(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}

declare global { var __msmStore: Store | undefined }

/** Starts empty. Reports only exist once someone creates them; approved ones live in the MSM Database sheet. */
function init(): Store {
  return { reports: new Map<string, Report>(), meta: new Map<string, Meta>(), nextId: 1001 };
}

function store(): Store {
  if (!globalThis.__msmStore) globalThis.__msmStore = init();
  return globalThis.__msmStore;
}

declare global { var __msmLoaded: Promise<void> | undefined }

/** Loads saved reports, jobs and the worker heartbeat from the State tab once per server instance. */
export async function ensureLoaded(): Promise<void> {
  if (!globalThis.__msmLoaded) {
    globalThis.__msmLoaded = (async () => {
      const s = store();
      let all: Record<string, unknown> = {};
      try { all = await loadAll(); } catch (e) { console.error("[state] load failed:", e instanceof Error ? e.message : String(e)); return; }
      for (const [id, v] of Object.entries(all)) {
        if (id === "WORKER") restoreWorker(v as { lastHeartbeat: number; machine: string });
        else if (id.startsWith("J")) restoreJob(v as RankJob);
        else {
          const r = v as Report;
          if (!r || !r.id || !r.intake) continue;
          s.reports.set(r.id, r);
          s.meta.set(r.id, { profile: "mixed", lastStepAt: 0, busy: false });
          const n = Number(r.id); if (Number.isFinite(n) && n >= s.nextId) s.nextId = n + 1;
        }
      }
    })();
  }
  await globalThis.__msmLoaded;
}

function save(r: Report) { persist(r.id, r); }

function now(): string { return new Date().toTimeString().slice(0, 5); }

function localIso(): string {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
}

const STATE_CITIES: Record<string, [string, number][]> = {
  NC: [["Charlotte", 874579], ["Raleigh", 467665], ["Greensboro", 299035], ["Durham", 283506], ["Winston-Salem", 249545], ["Cary", 174721]],
  SC: [["Charleston", 150227], ["Columbia", 136632], ["North Charleston", 114852], ["Mount Pleasant", 90801], ["Rock Hill", 74372]],
  FL: [["Jacksonville", 949611], ["Miami", 442241], ["Tampa", 384959], ["Orlando", 307573], ["St. Petersburg", 258308], ["Hialeah", 223109]],
  TX: [["Houston", 2304580], ["San Antonio", 1434625], ["Dallas", 1304379], ["Austin", 961855], ["Fort Worth", 918915], ["El Paso", 678815]],
  CO: [["Denver", 715522], ["Colorado Springs", 478961], ["Aurora", 386261], ["Fort Collins", 169810], ["Lakewood", 155984]],
  OH: [["Columbus", 905748], ["Cleveland", 372624], ["Cincinnati", 309317], ["Toledo", 270871], ["Akron", 190469]],
  ID: [["Boise", 235684], ["Meridian", 117635], ["Nampa", 100200], ["Idaho Falls", 64818], ["Caldwell", 59996]],
  CA: [["Los Angeles", 3898747], ["San Diego", 1386932], ["San Jose", 1013240], ["San Francisco", 873965], ["Fresno", 542107], ["Sacramento", 524943]],
  NY: [["New York", 8804190], ["Buffalo", 278349], ["Yonkers", 211569], ["Rochester", 211328], ["Syracuse", 148620]],
  GA: [["Atlanta", 498715], ["Columbus", 206922], ["Augusta", 202081], ["Macon", 157346], ["Savannah", 147780]],
  AZ: [["Phoenix", 1608139], ["Tucson", 542629], ["Mesa", 504258], ["Chandler", 275987], ["Scottsdale", 241361]],
  WA: [["Seattle", 737015], ["Spokane", 228989], ["Tacoma", 219346], ["Vancouver", 190915], ["Bellevue", 151854]],
  IL: [["Chicago", 2746388], ["Aurora", 180542], ["Joliet", 150362], ["Naperville", 149540], ["Rockford", 148655]],
  PA: [["Philadelphia", 1603797], ["Pittsburgh", 302971], ["Allentown", 125845], ["Reading", 95112], ["Erie", 94831]],
  NJ: [["Newark", 311549], ["Jersey City", 292449], ["Paterson", 159732], ["Elizabeth", 137298], ["Edison", 107588]],
  VA: [["Virginia Beach", 459470], ["Chesapeake", 249422], ["Norfolk", 238005], ["Richmond", 226610], ["Arlington", 238643]],
  TN: [["Nashville", 689447], ["Memphis", 633104], ["Knoxville", 190740], ["Chattanooga", 181099], ["Clarksville", 166722]],
  MI: [["Detroit", 639111], ["Grand Rapids", 198917], ["Warren", 139387], ["Sterling Heights", 134346], ["Ann Arbor", 123851]],
  MA: [["Boston", 675647], ["Worcester", 206518], ["Springfield", 155929], ["Cambridge", 118403], ["Lowell", 115554]],
  NV: [["Las Vegas", 641903], ["Henderson", 317610], ["Reno", 264165], ["North Las Vegas", 262527], ["Sparks", 108445]],
};

function syncSteps(r: Report) {
  for (const st of r.steps) {
    if (st.id < r.currentStep) st.state = "done";
    else if (st.id === r.currentStep) st.state = r.status === "waiting" ? "waiting" : r.status === "running" ? "running" : r.status === "ready" || r.status === "sent" ? "done" : "todo";
    else st.state = "todo";
    st.detail = st.state === "todo" ? "" : stepDetail(r, st.id);
  }
  r.nextStepLabel = nextStepLabel(r);
}

function log(r: Report, text: string) { r.log.unshift({ time: now(), text }); }

function startRunning(r: Report, fromStep: number) {
  r.status = "running";
  r.currentStep = fromStep;
  const m = store().meta.get(r.id);
  if (m) m.lastStepAt = Date.now();
  syncSteps(r);
}

/* ---------------- research steps ---------------- */

/** Runs one step. Real where a source is connected, otherwise the empty values stay. */
async function runStep(r: Report, step: number): Promise<void> {
  switch (step) {
    case 1: {
      const site = await inspectSite(r.intake.website);
      if (!site.ok) { r.provenance[1] = "not run"; log(r, `Website could not be read: ${site.error ?? "no response"}. Website values stay empty.`); return; }
      r.wordpress = site.wordpress;
      r.sitePages = site.servicePages;
      r.provenance[1] = "live";
      if (site.finalUrl.replace(/\/$/, "") !== r.intake.website.replace(/\/$/, "")) log(r, `Website redirects to ${site.finalUrl}`);
      if (has.openai()) {
        const ai = await servicesAndKeywords(r.intake.company, r.intake.vertical, site.text, site.links);
        if (ai && ai.keywords.length >= 5) {
          r.services = ai.services;
          const opts: KeywordOption[] = ai.keywords.slice(0, 10).map((k) => ({ keyword: k, selected: true, source: "website" }));
          for (const k of ai.extra.slice(0, 2)) opts.push({ keyword: k, selected: false, source: "website" });
          r.keywords = opts;
          log(r, `OpenAI listed ${ai.services.length} service lines and suggested ${opts.length} keywords`);
        } else log(r, "OpenAI did not return keywords, generic list kept for you to edit");
      }
      return;
    }
    case 3: {
      // With the worker, the result was ingested in advance() before this runs. Without it, positions stay unknown.
      if (!has.worker()) log(r, "Rank worker not configured (WORKER_TOKEN missing or MSM_DISABLE_LIVE set): positions stay unknown");
      r.provenance[3] = r.provenance[3] ?? "not run";
      return;
    }
    case 6: {
      const pages = (r.jobId ? getJob(r.jobId) : undefined)?.result?.listings ?? [];
      if (!pages.length || !has.openai()) { r.provenance[6] = pages.length ? "not run" : "not run"; return; }
      const onFile = { name: r.intake.company, address: r.intake.address, phone: r.intake.office };
      let live = 0;
      const next: typeof r.listings = [];
      for (const l of r.listings) {
        if (l.match === "not-applicable") { next.push({ ...l, confirmed: true }); continue; }
        const p = pages.find((x) => x.platform === l.platform);
        if (!p) { next.push(l); continue; }
        const read = await readListing(l.platform, onFile, p.url, p.text);
        if (!read) { next.push({ ...l, source: "worker", confirmed: false }); continue; }
        live++;
        const source: typeof l.source = l.platform === "Facebook" || l.platform === "Zocdoc" ? "search" : "worker";
        if (!read.found) { next.push({ platform: l.platform, name: null, address: null, phone: null, url: null, match: "not-listed", reason: read.note, source, confirmed: false }); continue; }
        next.push({ platform: l.platform, name: read.name, address: read.address, phone: read.phone, url: read.url || p.url || null, match: read.matches ? "match" : "mismatch", reason: read.note, source, confirmed: source === "worker" });
        r.platformRatings ??= {};
        r.platformRatings[l.platform] = { rating: read.rating, reviews: read.reviews };
      }
      r.listings = next;
      r.provenance[6] = live ? "live" : "not run";
      return;
    }
    case 7: {
      const ratings = r.platformRatings;
      if (!ratings || r.provenance[6] !== "live") { r.provenance[7] = r.provenance[6] === "not run" ? "not run" : "not run"; return; }
      const you = `${r.intake.company} (YOU)`;
      const mine = (["Google", "Yelp", "Facebook"] as const).map((platform) => {
        const l = r.listings.find((x) => x.platform === platform);
        const g = ratings[platform];
        if (!l || l.match === "not-listed") return { who: you, platform, rating: null, reviews: null, note: "No listing found" };
        if (!g || (g.rating == null && g.reviews == null)) return { who: you, platform, rating: null, reviews: null, note: platform === "Facebook" ? "Page found but shows no public rating" : "Listed but no rating shown" };
        return { who: you, platform, rating: g.rating, reviews: g.reviews, note: "" };
      });
      r.reviews = [...mine, ...r.reviews.filter((x) => !x.who.endsWith("(YOU)"))];
      r.provenance[7] = "live";
      return;
    }
    case 9: {
      const job = r.competitorJobId ? getJob(r.competitorJobId) : undefined;
      const texts = job?.result?.competitors ?? [];
      if (job?.status !== "done" || !has.openai()) { r.provenance[9] = r.provenance[3] === "live" ? "live" : "not run"; return; }
      const others = r.reviews.filter((x) => x.who.endsWith("(YOU)"));
      let live = 0;
      for (const c of r.competitors.filter((x) => x.selected)) {
        const t = texts.find((x) => x.id === c.id);
        const read = t ? await readGoogleReviews(c.name, t.text) : null;
        if (read?.found) { c.rating = read.rating ?? 0; c.reviews = read.reviews ?? 0; live++; others.push({ who: c.name, platform: "Google", rating: read.rating, reviews: read.reviews, note: "" }); }
        else others.push({ who: c.name, platform: "Google", rating: null, reviews: null, note: "No Google Business Profile found" });
      }
      r.reviews = others;
      r.provenance[9] = live ? "live" : "not run";
      return;
    }
    case 10: {
      const job = r.jobId ? getJob(r.jobId) : undefined;
      const texts = job?.result?.aiMode ?? [];
      if (!texts.length || !has.openai()) { r.provenance[10] = "not run"; r.aiMode = r.aiMode.map((a) => ({ ...a, others: [] })); return; }
      const client = domainOf(r.intake.website);
      let live = 0;
      for (const a of r.aiMode) {
        const t = texts.find((x) => x.keyword === a.keyword);
        if (!t) continue;
        const out = await aiModeNames(r.intake.company, client, a.keyword, t.text);
        if (out) { a.shows = out.shows; a.others = out.others; live++; }
      }
      r.provenance[10] = live ? "live" : "not run";
      return;
    }
    case 4: {
      if (!has.pagespeed()) { r.provenance[4] = "not run"; return; }
      const home = r.intake.website;
      const service = r.sitePages[0] ?? home.replace(/\/$/, "") + "/services/";
      const rows = await Promise.all([
        runPageSpeed("Home Page", home, "Mobile"), runPageSpeed("Home Page", home, "Desktop"),
        runPageSpeed("Key Service Page", service, "Mobile"), runPageSpeed("Key Service Page", service, "Desktop"),
      ]);
      r.pageSpeed = rows;
      r.provenance[4] = rows.some((x) => x.performance != null) ? "live" : "not run";
      return;
    }
    case 5: {
      if (!has.copyscape()) { r.provenance[5] = "not run"; return; }
      const home = r.intake.website;
      const pages = [home, ...r.sitePages.slice(0, 2)];
      while (pages.length < 3) pages.push(home.replace(/\/$/, "") + (pages.length === 1 ? "/services/" : "/about/"));
      pages.length = env.copyscapePages;
      if (env.copyscapePages < 3) log(r, `Copyscape limited to ${env.copyscapePages} page${env.copyscapePages === 1 ? "" : "s"} (COPYSCAPE_PAGES)`);
      const out = [];
      for (const p of pages) {
        const res = await runCopyscape(p);
        out.push(res);
        if (!res.ran && !res.fromCache) { log(r, `Copyscape stopped for this report: ${res.finding.replace(/^Not run: /, "")}`); break; }
      }
      r.copyscape = out.map(({ url, allowedPct, foundPct, finding }) => ({ url, allowedPct, foundPct, finding }));
      const cached = out.filter((x) => x.fromCache).length;
      if (cached) log(r, `Copyscape: ${cached} page${cached === 1 ? "" : "s"} reused from an earlier check, no credits spent`);
      r.provenance[5] = out.some((x) => x.ran) ? "live" : "not run";
      return;
    }
    case 11: {
      if (has.openai()) {
        const s = summarise(r);
        const out = await writeFindings(r, { total: s.total, top3: s.top3, p1: s.p1, lost: s.lost, reviews: s.reviews, rating: s.rating, compAvg: s.compAvg });
        if (out) { r.bottomLine = out.bottomLine; r.findings = out.findings; r.provenance[11] = "live"; return; }
      }
      if (r.findings.length === 0) r.findings = draftFindings(r);
      r.provenance[11] = "not run";
      return;
    }
    default:
      r.provenance[step] = r.provenance[step] ?? "not run";
  }
}

/** Called by the page while a report is running. Runs at most one step per call, with a short pause between steps. */
export async function advance(id: string): Promise<Report | undefined> {
  await ensureLoaded();
  const r = store().reports.get(id);
  const m = store().meta.get(id);
  if (!r || !m || r.status !== "running" || m.busy) return r;
  if (Date.now() - m.lastStepAt < STEP_MS) return r;
  m.busy = true;
  try {
    const step = r.currentStep;
    // Steps 3 and 9 are done by the browser worker on a PC. Hand it a job and wait here until it reports back.
    if ((step === 3 || step === 9) && has.worker()) {
      const isRank = step === 3;
      const jobId = isRank ? r.jobId : r.competitorJobId;
      const job = jobId ? getJob(jobId) : undefined;
      if (!job) {
        if (isRank) {
          const j = createJob(r); r.jobId = j.id;
          log(r, `Sent ${j.keywords.length * j.cities.length} searches plus the 6 listing pages to the rank worker${j.testMode ? " (test mode: 5 searches in the home city, the rest show as -)" : ""}`);
        } else {
          const j = createCompetitorJob(r); r.competitorJobId = j.id;
          log(r, `Sent ${j.competitorNames?.length ?? 0} competitors to the worker for Google reviews`);
        }
        syncSteps(r); return r;
      }
      if (job.status === "pending" || job.status === "running" || job.status === "captcha") {
        if (Date.now() - job.createdAt > JOB_TIMEOUT_MS && !workerOnline().online) updateJob(job.id, { status: "failed", message: "The worker did not respond in time" });
        else { syncSteps(r); return r; }
      }
      if (job.status === "failed") { r.provenance[step] = "not run"; log(r, `Worker failed on step ${step}: ${job.message}. Website values stay empty.`); }
      else if (job.status === "done" && job.result && isRank) {
        const { competitorsFound } = ingest(r, job.result);
        r.provenance[3] = "live";
        log(r, `Rank worker finished on ${job.result.machine}: ${job.result.searches.length} searches, ${competitorsFound} competitors found`);
      }
    }
    try { await runStep(r, step); }
    catch (e) { r.provenance[step] = "not run"; r.lastError = e instanceof Error ? e.message : String(e); log(r, `${STEP_TITLES[step - 1]} failed: ${r.lastError.slice(0, 120)}`); }
    log(r, `${STEP_TITLES[step - 1]}: ${stepDetail(r, step) || "done"}${r.provenance[step] === "live" ? "" : r.provenance[step] === "not run" ? " (not run)" : " (sample)"}`);
    if (step >= 12) { r.status = "ready"; r.currentStep = 12; log(r, "Report ready to review"); }
    else { r.currentStep = step + 1; if (CHECKPOINTS[r.currentStep]) r.status = "waiting"; }
  } finally {
    m.busy = false; m.lastStepAt = Date.now();
  }
  syncSteps(r);
  save(r);
  return r;
}

export async function advanceAll(): Promise<void> {
  await ensureLoaded();
  for (const r of store().reports.values()) if (r.status === "running") await advance(r.id);
}

/* ---------------- reads ---------------- */
export async function listReports(): Promise<Report[]> {
  await ensureLoaded();
  return [...store().reports.values()].sort((a, b) => (a.startedAt < b.startedAt ? 1 : -1));
}

export async function getReport(id: string): Promise<Report | undefined> { await ensureLoaded(); return store().reports.get(id); }

/** The worker job behind a report, if any. */
export function reportJob(r: Report): RankJob | undefined { return r.jobId ? getJob(r.jobId) : undefined; }

/* ---------------- writes ---------------- */
export async function createReport(intake: Intake, ae: string, notify: NotifyChannel, createdBy = "Dulmini Dodawatte"): Promise<Report> {
  await ensureLoaded();
  const s = store();
  const id = String(s.nextId++);
  const v: Vertical = intake.vertical;
  const home = intake.address.split(",").map((x) => x.trim());
  let cities = VERTICAL_CITIES[v].map((c) => ({ ...c }));
  if (home.length >= 3) {
    const cityName = home[home.length - 2];
    const st = (home[home.length - 1].match(/[A-Z]{2}/) ?? [cities[0].state])[0];
    const pool = STATE_CITIES[st];
    if (pool) {
      const homePop = pool.find(([n]) => n.toLowerCase() === cityName.toLowerCase())?.[1] ?? 50000 + (hashStr(cityName) % 150000);
      const others = pool.filter(([n]) => n.toLowerCase() !== cityName.toLowerCase()).slice(0, 4);
      cities = [
        { name: cityName, state: st, population: homePop, distanceMiles: 0, home: true },
        ...others.map(([n, p], i) => ({ name: n, state: st, population: p, distanceMiles: 8 + ((hashStr(cityName + n) % 15) + i * 3) })),
      ];
    } else {
      cities[0] = { ...cities[0], name: cityName, state: st };
    }
  }
  // Nothing is invented. Every research value starts empty ("Not checked" / "Not run") and is filled only by a live source.
  const home0 = cities[0];
  const you = `${intake.company} (YOU)`;
  const homePage = intake.website;
  const service = homePage.replace(/\/$/, "") + "/services/";
  const r: Report = {
    id, intake, ae, notify, provenance: {}, sitePages: [],
    delivery: { driveFolder: DRIVE_FOLDER, aeApproval: "not-sent", hubspot: "not-connected" },
    status: "running", currentStep: 1, nextStepLabel: "", startedAt: localIso(),
    wordpress: false, services: [],
    cities: cities.map((c, i) => ({ ...c, selected: i < 3 })),
    // Generic starting list for the vertical; OpenAI replaces it from the real site in step 1, and Dulmini edits it at checkpoint 1.
    keywords: VERTICAL_KEYWORDS[v].map((k) => ({ keyword: k, selected: true, source: "website" as const })),
    steps: STEP_TITLES.map((title, i) => ({ id: i + 1, title, state: "todo" as const, detail: "" })),
    log: [{ time: now(), text: `Report created by ${createdBy}` }],
    ranks: {}, competitors: [], competitorRanks: {},
    listings: PLATFORMS.map((platform) => platform === "Zocdoc" && v === "Legal"
      ? { platform, name: null, address: null, phone: null, url: null, match: "not-applicable" as const, reason: "Zocdoc lists medical providers only", source: "worker" as const, confirmed: true }
      : { platform, name: null, address: null, phone: null, url: null, match: "not-checked" as const, source: "worker" as const, confirmed: false }),
    aiMode: [],
    pageSpeed: (["Mobile", "Desktop"] as const).flatMap((device) => [
      { page: "Home Page", url: homePage, device, performance: null, accessibility: null, bestPractices: null, seo: null },
      { page: "Key Service Page", url: service, device, performance: null, accessibility: null, bestPractices: null, seo: null },
    ]),
    copyscape: [homePage, service, homePage.replace(/\/$/, "") + "/about/"].map((url) => ({ url, allowedPct: 5, foundPct: 0, finding: "Not run" })),
    reviews: (["Google", "Yelp", "Facebook"] as const).map((platform) => ({ who: you, platform, rating: null, reviews: null, note: "Not checked" })),
    bottomLine: "", findings: [],
  };
  void home0;
  s.reports.set(id, r);
  s.meta.set(id, { profile: "mixed", lastStepAt: Date.now(), busy: false });
  syncSteps(r);
  save(r);
  return r;
}

export async function approveKeywords(id: string, cityKeys: string[], keywords: string[]): Promise<Report | undefined> {
  const r = await getReport(id); if (!r) return;
  const m = store().meta.get(id)!;
  r.cities = r.cities.map((c) => ({ ...c, selected: cityKeys.includes(`${c.name}, ${c.state}`) }));
  const existing = new Set(r.keywords.map((k) => k.keyword));
  const opts: KeywordOption[] = r.keywords.map((k) => ({ ...k, selected: keywords.includes(k.keyword) }));
  for (const k of keywords) if (!existing.has(k)) opts.push({ keyword: k, selected: true, source: "added" });
  r.keywords = opts;
  const selected = opts.filter((k) => k.selected).map((k) => k.keyword);
  const cityCount = r.cities.filter((c) => c.selected).length;
  // Positions stay unknown ("-") until the rank worker reports; nothing is invented.
  r.ranks = Object.fromEntries(selected.map((k) => [k, Array.from({ length: cityCount }, () => undefined)]));
  r.competitorRanks = {};
  r.aiMode = selected.map((k) => r.aiMode.find((a) => a.keyword === k) ?? { keyword: k, shows: false, others: [], checked: false });
  void m;
  r.provenance[2] = "live";
  log(r, "Keywords and cities approved by Dulmini");
  startRunning(r, 3);
  save(r);
  return r;
}

export async function pickCompetitors(id: string, ids: string[]): Promise<Report | undefined> {
  const r = await getReport(id); if (!r) return;
  r.competitors = r.competitors.map((c) => ({ ...c, selected: ids.includes(c.id) }));
  r.provenance[8] = "live";
  log(r, `${ids.length} competitors confirmed by Dulmini`);
  startRunning(r, 9);
  save(r);
  return r;
}

export async function confirmListings(id: string, urls: Record<string, string>, checkedKeywords: string[]): Promise<Report | undefined> {
  const r = await getReport(id); if (!r) return;
  r.listings = r.listings.map((l) => {
    const u = urls[l.platform]?.trim();
    if (l.match === "not-applicable") return { ...l, confirmed: true };
    if (u) return { ...l, url: u, match: l.match === "not-listed" ? "match" : l.match, name: l.name ?? r.intake.company, address: l.address ?? r.intake.address, phone: l.phone ?? r.intake.office, confirmed: true };
    return { ...l, confirmed: l.match !== "not-listed" ? true : l.confirmed };
  });
  r.aiMode = r.aiMode.map((a) => ({ ...a, checked: checkedKeywords.includes(a.keyword) || a.checked }));
  r.provenance[10] = r.provenance[10] ?? "not run";
  log(r, "Listings and AI Mode confirmed by Dulmini");
  startRunning(r, 11);
  save(r);
  return r;
}

/** Approve: freeze the wording, create the Google Sheet in the reports folder, write the database rows. */
export async function approveReport(id: string, bottomLine: string, findings: Finding[], approvedBy: string): Promise<Report | undefined> {
  const r = await getReport(id); if (!r) return;
  r.bottomLine = bottomLine.trim() || r.bottomLine;
  r.findings = findings.filter((f) => f.text.trim());
  r.status = "sent";
  r.approvedBy = approvedBy;
  r.approvedAt = localIso();
  r.delivery = { sheetUrl: "#", driveFolder: DRIVE_FOLDER, sentTo: r.ae, sentVia: r.notify, sentAt: r.approvedAt, aeApproval: "pending", hubspot: "not-connected" };
  log(r, `Approved by ${approvedBy}`);
  syncSteps(r);

  const date = new Date(r.approvedAt).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
  const name = `${r.intake.company.replace(/[\\/:*?"<>|]/g, "")} - ${date} MSM`;

  if (has.reportsFolder()) {
    try {
      const xlsx = await buildWorkbook(r, false);
      const sheet = await createReportSheet(name, xlsx);
      r.delivery.sheetUrl = sheet.url;
      r.provenance[12] = "live";
      log(r, `Google Sheet created: ${name}`);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      r.lastError = /storage quota/i.test(msg)
        ? "Drive refused: a service account cannot own files in a My Drive folder. Move MSM Reports to a Shared Drive, or connect a Google account (see README)."
        : msg;
      log(r, `Google Sheet could not be created: ${r.lastError.slice(0, 200)} Excel fallback is available.`);
    }
  } else {
    log(r, "Google Sheet not created: Drive folder not connected. Excel fallback is available.");
  }

  if (has.database()) {
    try {
      await upsertReportRow(`R${r.id}`, reportRow(r) as (string | number)[]);
      const start = await nextDataId();
      const dataRows = reportDataRows(r).map((row, i) => { row[0] = `D${String(start + i).padStart(4, "0")}`; return row as (string | number)[]; });
      await appendRows("Report Data", dataRows);
      const logId = await nextLogId();
      const sheetRef = r.delivery.sheetUrl && r.delivery.sheetUrl !== "#" ? r.delivery.sheetUrl : "Excel fallback";
      await appendRows("Log", [[logId, `R${r.id}`, (r.approvedAt ?? "").replace("T", " ").slice(0, 16), approvedBy, "Report approved", sheetRef]]);
      log(r, `Saved to the MSM Database sheet (${dataRows.length} data rows)`);
    } catch (e) {
      r.lastError = e instanceof Error ? e.message : String(e);
      log(r, `MSM Database write failed: ${r.lastError.slice(0, 140)}`);
    }
  } else {
    log(r, "MSM Database not connected: nothing written");
  }

  log(r, r.notify.includes("Slack") && has.slack() ? `Link posted to Slack for ${r.ae}` : `Link for ${r.ae} shown on screen (Slack not connected)`);
  save(r);
  return r;
}

export async function sendBack(id: string): Promise<Report | undefined> {
  const r = await getReport(id); if (!r) return;
  r.status = "waiting"; r.currentStep = 10;
  log(r, "Sent back to checkpoint 3 by Dulmini");
  syncSteps(r);
  save(r);
  return r;
}

function draftFindings(r: Report): Finding[] {
  const sel = r.keywords.filter((k) => k.selected).map((k) => k.keyword);
  const cities = r.cities.filter((c) => c.selected);
  const total = sel.length * cities.length;
  let top3 = 0, p1 = 0;
  for (const k of sel) for (const v of r.ranks[k] ?? []) { if (v != null) p1++; if (v != null && v <= 3) top3++; }
  const out: Finding[] = [];
  out.push({ level: top3 < total / 4 ? "attention" : "strength", text: `${top3} of ${total} keyword/city slots reach the top 3 and ${p1} reach page 1.` });
  const slowest = r.pageSpeed.reduce((a, b) => ((b.performance ?? 100) < (a.performance ?? 100) ? b : a));
  if ((slowest.performance ?? 100) < 70) out.push({ level: "watch", text: `${slowest.page} scores ${slowest.performance} on ${slowest.device.toLowerCase()} performance.` });
  const over = r.copyscape.filter((c) => c.foundPct > c.allowedPct);
  if (over.length) out.push({ level: "watch", text: `${over.length} page(s) exceed the 5% duplicate-content threshold.` });
  const mismatch = r.listings.filter((l) => l.match === "mismatch" || l.match === "not-listed");
  out.push(mismatch.length
    ? { level: "watch", text: `Listings need attention on ${mismatch.map((l) => l.platform).join(", ")}.` }
    : { level: "strength", text: "Listings match the on-file record on every applicable platform." });
  return out;
}

export function reportHref(r: Report): string {
  if (r.status === "ready") return `/reports/${r.id}/review`;
  const cp = CHECKPOINTS[r.currentStep];
  if (r.status === "waiting" && cp) return cp === 1 ? `/reports/${r.id}/keywords` : cp === 2 ? `/reports/${r.id}/competitors` : `/reports/${r.id}/listings`;
  return `/reports/${r.id}`;
}
