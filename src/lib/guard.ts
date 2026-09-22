/**
 * Spending guard for paid connections (Copyscape today; the same shape works for any metered API).
 * Rules: one call per page, never retried; identical URLs are cached; a daily cap; first error stops all further calls
 * until someone resets it; every stop raises an alert shown at the top of every page.
 */

export interface Alert { at: string; level: "error" | "warn"; text: string }

interface CopyscapeGuard {
  day: string;
  usedToday: number;
  pausedReason: string | null;
  pausedAt: string | null;
  cache: Map<string, { at: number; result: unknown }>;
}

interface GuardState { copyscape: CopyscapeGuard; alerts: Alert[] }

declare global { var __msmGuard: GuardState | undefined }

function today(): string { return new Date().toISOString().slice(0, 10); }
function stamp(): string { return new Date().toTimeString().slice(0, 5); }

function state(): GuardState {
  if (!globalThis.__msmGuard) globalThis.__msmGuard = { copyscape: { day: today(), usedToday: 0, pausedReason: null, pausedAt: null, cache: new Map() }, alerts: [] };
  const g = globalThis.__msmGuard;
  if (g.copyscape.day !== today()) { g.copyscape.day = today(); g.copyscape.usedToday = 0; }
  return g;
}

/** Daily cap on Copyscape page checks. 30 pages = 10 reports. Override with COPYSCAPE_DAILY_LIMIT. */
export function copyscapeDailyLimit(): number {
  const n = Number(process.env.COPYSCAPE_DAILY_LIMIT ?? 30);
  return Number.isFinite(n) && n > 0 ? n : 30;
}

export function copyscapeSwitchedOff(): boolean { return (process.env.MSM_DISABLE_COPYSCAPE ?? "").trim() === "1"; }

const CACHE_MS = 30 * 24 * 60 * 60 * 1000;

export const guard = {
  alerts(): Alert[] { return state().alerts; },
  raise(level: Alert["level"], text: string) {
    const a = state().alerts;
    if (a.some((x) => x.text === text)) return;
    a.unshift({ at: stamp(), level, text });
    if (a.length > 10) a.length = 10;
  },
  clearAlerts() { state().alerts = []; },

  copyscape: {
    status() {
      const c = state().copyscape;
      return { usedToday: c.usedToday, limit: copyscapeDailyLimit(), paused: c.pausedReason, pausedAt: c.pausedAt, switchedOff: copyscapeSwitchedOff(), cached: c.cache.size };
    },
    /** Returns a reason string when a call must NOT be made, otherwise null. */
    blockReason(): string | null {
      const c = state().copyscape;
      if (copyscapeSwitchedOff()) return "Copyscape is switched off (MSM_DISABLE_COPYSCAPE=1)";
      if (c.pausedReason) return `Copyscape paused since ${c.pausedAt}: ${c.pausedReason}`;
      if (c.usedToday >= copyscapeDailyLimit()) return `Daily Copyscape limit reached (${copyscapeDailyLimit()} pages)`;
      return null;
    },
    cached<T>(url: string): T | undefined {
      const hit = state().copyscape.cache.get(url.replace(/\/$/, "").toLowerCase());
      if (!hit || Date.now() - hit.at > CACHE_MS) return undefined;
      return hit.result as T;
    },
    remember(url: string, result: unknown) { state().copyscape.cache.set(url.replace(/\/$/, "").toLowerCase(), { at: Date.now(), result }); },
    count() { state().copyscape.usedToday += 1; },
    /** Stops every further Copyscape call until reset. Raises a red alert. */
    pause(reason: string) {
      const c = state().copyscape;
      if (c.pausedReason) return;
      c.pausedReason = reason; c.pausedAt = stamp();
      guard.raise("error", `Copyscape stopped: ${reason}. No more credits will be used until an admin resets it on Settings.`);
    },
    reset() { const c = state().copyscape; c.pausedReason = null; c.pausedAt = null; state().alerts = state().alerts.filter((a) => !a.text.startsWith("Copyscape stopped")); },
  },
};
