import type { Competitor, RankGrid, RankJob, RankJobResult, Report } from "./types";
import { env } from "./env";
import { persist } from "./persist";

/**
 * App side of the browser worker. Jobs live in memory next to the reports.
 * The worker (worker/worker.mjs on a PC) polls /api/worker/jobs, runs the searches in a real browser,
 * and posts progress and results back. See ingest() for how results become report data.
 */

interface WorkerState { jobs: Map<string, RankJob>; lastHeartbeat: number; machine: string; nextId: number }
declare global { var __msmWorker: WorkerState | undefined }

function state(): WorkerState {
  if (!globalThis.__msmWorker) globalThis.__msmWorker = { jobs: new Map(), lastHeartbeat: 0, machine: "", nextId: 1 };
  return globalThis.__msmWorker;
}

export const HEARTBEAT_MS = 120_000;
export const JOB_TIMEOUT_MS = 45 * 60_000;

export function workerOnline(): { online: boolean; machine: string; secondsAgo: number | null } {
  const s = state();
  if (!s.lastHeartbeat) return { online: false, machine: "", secondsAgo: null };
  const ago = Math.round((Date.now() - s.lastHeartbeat) / 1000);
  return { online: ago * 1000 < HEARTBEAT_MS, machine: s.machine, secondsAgo: ago };
}

let heartbeatSavedAt = 0;
export function heartbeat(machine: string) {
  const s = state(); s.lastHeartbeat = Date.now(); s.machine = machine;
  if (Date.now() - heartbeatSavedAt > 60_000) { heartbeatSavedAt = Date.now(); persist("WORKER", { lastHeartbeat: s.lastHeartbeat, machine }); }
}

/** Called on start-up with what was saved in the sheet. */
export function restoreJob(job: RankJob) {
  const s = state();
  s.jobs.set(job.id, job);
  const n = Number(job.id.replace(/^J/, "")); if (Number.isFinite(n) && n >= s.nextId) s.nextId = n + 1;
}
export function restoreWorker(w: { lastHeartbeat: number; machine: string }) {
  const s = state(); if (w.lastHeartbeat > s.lastHeartbeat) { s.lastHeartbeat = w.lastHeartbeat; s.machine = w.machine; }
}

export function createJob(r: Report): RankJob {
  const s = state();
  const id = `J${String(s.nextId++).padStart(4, "0")}`;
  const keywords = r.keywords.filter((k) => k.selected).map((k) => k.keyword);
  const allCities = r.cities.filter((c) => c.selected).map((c) => ({ name: c.name, state: c.state }));
  const home = r.cities.find((c) => c.home) ?? r.cities[0];
  const job: RankJob = {
    id, reportId: r.id, kind: "rank", status: "pending", message: "Waiting for the rank worker to pick this up", createdAt: Date.now(), updatedAt: Date.now(),
    clientName: r.intake.company, clientDomain: domainOf(r.intake.website),
    listings: { name: r.intake.company, address: r.intake.address, phone: r.intake.office, city: home.name, state: home.state, vertical: r.intake.vertical },
    // Test mode: 5 searches (home city, first 5 keywords) and 2 AI Mode reads, to stay well under Google's limits.
    keywords: env.rankTestMode ? keywords.slice(0, 5) : keywords,
    cities: env.rankTestMode ? allCities.slice(0, 1) : allCities,
    aiKeywords: env.rankTestMode ? keywords.slice(0, 2) : keywords,
    testMode: env.rankTestMode,
  };
  s.jobs.set(id, job);
  persist(id, job);
  return job;
}

/** Second job after checkpoint 2: Google rating and review count for the chosen competitors. */
export function createCompetitorJob(r: Report): RankJob {
  const s = state();
  const id = `J${String(s.nextId++).padStart(4, "0")}`;
  const home = r.cities.find((c) => c.home) ?? r.cities[0];
  const job: RankJob = {
    id, reportId: r.id, kind: "competitors", status: "pending", message: "Waiting for the worker to read competitor reviews", createdAt: Date.now(), updatedAt: Date.now(),
    clientName: r.intake.company, clientDomain: domainOf(r.intake.website), keywords: [], cities: [{ name: home.name, state: home.state }],
    competitorNames: r.competitors.filter((c) => c.selected).map((c) => ({ id: c.id, name: c.name, domain: c.website, city: home.name, state: home.state })),
  };
  s.jobs.set(id, job);
  persist(id, job);
  return job;
}

export function getJob(id: string): RankJob | undefined { return state().jobs.get(id); }
const STALE_MS = 3 * 60_000;

/** Jobs the worker should take: pending ones, plus running/captcha ones nobody has touched for 3 minutes (worker restarted). */
export function pendingJobs(): RankJob[] {
  const now = Date.now();
  return [...state().jobs.values()].filter((j) => {
    if (j.status === "pending") return true;
    if ((j.status === "running" || j.status === "captcha") && now - j.updatedAt > STALE_MS) { j.status = "pending"; j.message = "Re-queued after the worker restarted"; persist(j.id, j); return true; }
    return false;
  });
}

export function updateJob(id: string, patch: Partial<Pick<RankJob, "status" | "message" | "result">>): RankJob | undefined {
  const j = state().jobs.get(id); if (!j) return;
  Object.assign(j, patch, { updatedAt: Date.now() });
  persist(id, j);
  return j;
}

export function domainOf(url: string): string {
  try { return new URL(/^https?:\/\//i.test(url) ? url : "https://" + url).hostname.replace(/^www\./, "").toLowerCase(); }
  catch { return url.replace(/^https?:\/\/(www\.)?/, "").split("/")[0].toLowerCase(); }
}

/** Sites that appear in results but are directories, not competing practices. */
const DIRECTORIES = /(^|\.)(google|yelp|facebook|instagram|youtube|healthgrades|zocdoc|webmd|vitals|sharecare|ratemds|findatopdoc|realself|groupon|mapquest|yellowpages|bbb|nextdoor|indeed|linkedin|glassdoor|angi|thumbtack|care|tripadvisor|wikipedia|reddit|quora|avvo|justia|findlaw|lawyers|superlawyers|nolo|legalzoom|expertise|threebestrated|opencare|dentistry|1800dentist|smilegeneration|aspendental|castledental|americanbestdentists|doctor|md|npidb|npino|healthline|mayoclinic|clevelandclinic|nih|cdc|apple|bing|yahoo|amazon|pinterest|tiktok|x|twitter)\.(com|org|gov|net|co|io)$/i;

export function isDirectory(domain: string): boolean { return DIRECTORIES.test(domain); }

function cleanTitle(t: string): string {
  return t.split(/\s[|\-–—:]\s/)[0].replace(/\s+/g, " ").trim().slice(0, 60) || t.slice(0, 60);
}

/** Turns worker results into ranks, a competitor shortlist and their positions. */
export function ingest(r: Report, res: RankJobResult): { competitorsFound: number } {
  const keywords = r.keywords.filter((k) => k.selected).map((k) => k.keyword);
  const cities = r.cities.filter((c) => c.selected);
  const client = domainOf(r.intake.website);
  const grid: RankGrid = {};
  const beats = new Map<string, { beats: number; title: string; url: string }>();

  // Cities the worker did not search (test mode) stay undefined and show as "-".
  const searchedCity = new Set(res.searches.map((s) => s.city));
  const searchedKw = new Set(res.searches.map((s) => s.keyword));
  for (const k of keywords) grid[k] = cities.map((c) => (searchedCity.has(c.name) && searchedKw.has(k) ? null : undefined));
  for (const s of res.searches) {
    const ki = keywords.indexOf(s.keyword); const ci = cities.findIndex((c) => c.name === s.city);
    if (ki < 0 || ci < 0) continue;
    grid[s.keyword][ci] = s.clientPosition;
    const mine = s.clientPosition ?? 99;
    for (const x of s.results) {
      if (x.domain === client || x.domain.endsWith("." + client) || isDirectory(x.domain)) continue;
      if (x.position < mine) {
        const e = beats.get(x.domain) ?? { beats: 0, title: x.title, url: x.url };
        e.beats++; beats.set(x.domain, e);
      }
    }
  }
  r.ranks = grid;

  const total = keywords.length * cities.length;
  const top = [...beats.entries()].sort((a, b) => b[1].beats - a[1].beats).slice(0, 6);
  const competitors: Competitor[] = top.map(([domain, e], i) => ({
    id: `${r.id}-w${i + 1}`, name: cleanTitle(e.title) || domain, beats: e.beats, distanceMiles: 0, overlapPct: 0, rating: 0, reviews: 0,
    website: domain, verified: "verified", selected: false, dataKnown: false,
  }));
  if (competitors.length) {
    r.competitors = competitors;
    // Reviews for the new competitors are not read by the worker yet; keep the client's rows and mark the rest.
    const mine = r.reviews.filter((x) => x.who.endsWith("(YOU)"));
    r.reviews = [...mine, ...competitors.map((c) => ({ who: c.name, platform: "Google" as const, rating: null, reviews: null, note: "Not checked yet" }))];
  }

  const compRanks: Record<string, RankGrid> = {};
  for (const c of r.competitors) {
    const g: RankGrid = {};
    for (const k of keywords) g[k] = cities.map((city) => {
      const s = res.searches.find((x) => x.keyword === k && x.city === city.name);
      if (!s) return undefined;
      const hit = s.results.find((x) => x.domain === c.website || x.domain.endsWith("." + c.website));
      return hit ? hit.position : null;
    });
    compRanks[c.id] = g;
  }
  r.competitorRanks = compRanks;
  void total;
  return { competitorsFound: competitors.length };
}
