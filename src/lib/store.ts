import type { Finding, Intake, KeywordOption, NotifyChannel, Report, Vertical } from "./types";
import {
  buildRanks, CHECKPOINTS, DRIVE_FOLDER, nextStepLabel, seedReports, STEP_TITLES, stepDetail,
  VERTICAL_CITIES, VERTICAL_COMPETITORS, VERTICAL_KEYWORDS, VERTICAL_SERVICES, buildReport, type Seed,
} from "./data";

/**
 * In-memory store for the demo. Every function here maps 1:1 to what will
 * later be a database call, so the screens do not change when Supabase is wired in.
 */
interface Meta { profile: Seed["rankProfile"]; runningSince: number | null }
interface Store { reports: Map<string, Report>; meta: Map<string, Meta>; nextId: number }

const STEP_MS = 2500;

function hashStr(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}

declare global { var __msmStore: Store | undefined }

function init(): Store {
  const reports = new Map<string, Report>();
  const meta = new Map<string, Meta>();
  for (const r of seedReports()) {
    reports.set(r.id, r);
    meta.set(r.id, { profile: r.id === "1042" ? "all-poor" : r.id === "1039" || r.id === "1037" ? "strong" : "mixed", runningSince: r.status === "running" ? Date.now() : null });
  }
  return { reports, meta, nextId: 1043 };
}

function store(): Store {
  if (!globalThis.__msmStore) globalThis.__msmStore = init();
  return globalThis.__msmStore;
}

function now(): string { return new Date().toTimeString().slice(0, 5); }

/** Local time as an ISO-like string without a zone, matching the seed data format. */
function localIso(): string {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
}

/** Largest cities by state for proposing nearby markets when a new report is created. */
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

/** Advance a running report based on wall-clock time. */
function tick(r: Report) {
  const m = store().meta.get(r.id);
  if (!m || r.status !== "running" || m.runningSince == null) return;
  let since = m.runningSince;
  let elapsed = Date.now() - since;
  while (elapsed >= STEP_MS && r.status === "running") {
    const finished = r.currentStep;
    r.log.unshift({ time: now(), text: `${STEP_TITLES[finished - 1]}: ${stepDetail(r, finished) || "done"}` });
    elapsed -= STEP_MS;
    since += STEP_MS;
    m.runningSince = since;
    if (finished >= 12) { r.status = "ready"; r.currentStep = 12; m.runningSince = null; r.log.unshift({ time: now(), text: "Report ready to review" }); break; }
    r.currentStep = finished + 1;
    if (CHECKPOINTS[r.currentStep]) { r.status = "waiting"; m.runningSince = null; }
  }
  syncSteps(r);
}

function startRunning(r: Report, fromStep: number) {
  r.status = "running";
  r.currentStep = fromStep;
  const m = store().meta.get(r.id);
  if (m) m.runningSince = Date.now();
  syncSteps(r);
}

/* ---------------- reads ---------------- */
export function listReports(): Report[] {
  const all = [...store().reports.values()];
  for (const r of all) tick(r);
  return all.sort((a, b) => (a.startedAt < b.startedAt ? 1 : -1));
}

export function getReport(id: string): Report | undefined {
  const r = store().reports.get(id);
  if (r) tick(r);
  return r;
}

/* ---------------- writes ---------------- */
export function createReport(intake: Intake, ae: string, notify: NotifyChannel): Report {
  const s = store();
  const id = String(s.nextId++);
  const v: Vertical = intake.vertical;
  const home = intake.address.split(",").map((x) => x.trim());
  let cities = VERTICAL_CITIES[v].map((c) => ({ ...c }));
  // Use the city from the address as the home city when we can read it, and propose nearby cities from the same state.
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
  const seed: Seed = {
    id, intake, ae, notify, status: "running", currentStep: 1, startedAt: localIso(),
    wordpress: !/squarespace|wix|weebly/i.test(intake.website), services: VERTICAL_SERVICES[v], cities,
    keywords: VERTICAL_KEYWORDS[v], extraKeywords: [], competitors: VERTICAL_COMPETITORS[v], rankProfile: "mixed",
    bottomLine: "Findings are written after the research completes.", findings: [],
    reviews: { rating: 4.7, reviews: 120, yelp: [4.1, 12], facebook: [null, 0] }, notListed: [], aiOthers: {},
  };
  const r = buildReport(seed);
  r.status = "running"; r.currentStep = 1;
  r.competitors = r.competitors.map((c) => ({ ...c, selected: false }));
  r.listings = r.listings.map((l) => ({ ...l, confirmed: l.source === "api" || l.match === "not-applicable" }));
  r.aiMode = r.aiMode.map((a) => ({ ...a, checked: false }));
  r.log = [{ time: now(), text: "Report created by Dulmini Dodawatte" }];
  s.reports.set(id, r);
  s.meta.set(id, { profile: "mixed", runningSince: Date.now() });
  syncSteps(r);
  return r;
}

export function approveKeywords(id: string, cityKeys: string[], keywords: string[]): Report | undefined {
  const r = getReport(id); if (!r) return;
  const m = store().meta.get(id)!;
  r.cities = r.cities.map((c) => ({ ...c, selected: cityKeys.includes(`${c.name}, ${c.state}`) }));
  const existing = new Set(r.keywords.map((k) => k.keyword));
  const opts: KeywordOption[] = r.keywords.map((k) => ({ ...k, selected: keywords.includes(k.keyword) }));
  for (const k of keywords) if (!existing.has(k)) opts.push({ keyword: k, selected: true, source: "added" });
  r.keywords = opts;
  const selected = opts.filter((k) => k.selected).map((k) => k.keyword);
  const cityCount = r.cities.filter((c) => c.selected).length;
  r.ranks = buildRanks(m.profile, id, selected, cityCount);
  for (const c of r.competitors) r.competitorRanks[c.id] = buildRanks("strong", id, selected, cityCount, c.name);
  r.aiMode = selected.map((k) => {
    const prev = r.aiMode.find((a) => a.keyword === k);
    return prev ?? { keyword: k, shows: false, others: r.competitors.slice(0, 3).map((c) => c.name), checked: false };
  });
  r.log.unshift({ time: now(), text: "Keywords and cities approved by Dulmini" });
  startRunning(r, 3);
  return r;
}

export function pickCompetitors(id: string, ids: string[]): Report | undefined {
  const r = getReport(id); if (!r) return;
  r.competitors = r.competitors.map((c) => ({ ...c, selected: ids.includes(c.id) }));
  r.log.unshift({ time: now(), text: `${ids.length} competitors confirmed by Dulmini` });
  startRunning(r, 9);
  return r;
}

export function confirmListings(id: string, urls: Record<string, string>, checkedKeywords: string[]): Report | undefined {
  const r = getReport(id); if (!r) return;
  r.listings = r.listings.map((l) => {
    const u = urls[l.platform]?.trim();
    if (l.match === "not-applicable") return { ...l, confirmed: true };
    if (u) return { ...l, url: u, match: l.match === "not-listed" ? "match" : l.match, name: l.name ?? r.intake.company, address: l.address ?? r.intake.address, phone: l.phone ?? r.intake.office, confirmed: true };
    return { ...l, confirmed: l.match !== "not-listed" ? true : l.confirmed };
  });
  r.aiMode = r.aiMode.map((a) => ({ ...a, checked: checkedKeywords.includes(a.keyword) || a.checked }));
  r.log.unshift({ time: now(), text: "Listings and AI Mode confirmed by Dulmini" });
  if (r.findings.length === 0) r.findings = draftFindings(r);
  startRunning(r, 11);
  return r;
}

export function approveReport(id: string, bottomLine: string, findings: Finding[], approvedBy: string): Report | undefined {
  const r = getReport(id); if (!r) return;
  r.bottomLine = bottomLine.trim() || r.bottomLine;
  r.findings = findings.filter((f) => f.text.trim());
  r.status = "sent";
  r.approvedBy = approvedBy;
  r.approvedAt = localIso();
  // Delivery is shown, not performed: the Sheet, notification and HubSpot write are connected later.
  r.delivery = { sheetUrl: "#", driveFolder: DRIVE_FOLDER, sentTo: r.ae, sentVia: r.notify, sentAt: r.approvedAt, aeApproval: "pending", hubspot: "not-connected" };
  r.log.unshift({ time: now(), text: `Approved by ${approvedBy}` });
  r.log.unshift({ time: now(), text: `Google Sheet created in ${DRIVE_FOLDER}` });
  r.log.unshift({ time: now(), text: `Link sent to ${r.ae} via ${r.notify}, awaiting AE approval` });
  syncSteps(r);
  return r;
}

export function sendBack(id: string): Report | undefined {
  const r = getReport(id); if (!r) return;
  r.status = "waiting"; r.currentStep = 10;
  const m = store().meta.get(id); if (m) m.runningSince = null;
  r.log.unshift({ time: now(), text: "Sent back to checkpoint 3 by Dulmini" });
  syncSteps(r);
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
