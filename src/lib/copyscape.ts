import { env, fetchWithTimeout, has } from "./env";
import { guard } from "./guard";
import type { CopyscapeRow } from "./types";

/**
 * Copyscape Premium API (XML). o=csearch checks one URL against the web.
 * Each call costs credits (about 5 cents a page), so every call goes through the spending guard:
 * cached pages are never re-checked, there is a daily cap, and the first error pauses Copyscape entirely.
 */
function base(o: string) {
  return `https://www.copyscape.com/api/?u=${encodeURIComponent(env.copyscapeUser)}&k=${encodeURIComponent(env.copyscapeKey)}&o=${o}`;
}

function tag(xml: string, name: string): string | null {
  const m = xml.match(new RegExp(`<${name}>([\\s\\S]*?)</${name}>`));
  return m ? m[1].trim() : null;
}

/** Free call. Used by the Settings check only. */
export async function checkCopyscape(): Promise<{ ok: boolean; detail: string }> {
  if (!has.copyscape()) return { ok: false, detail: "No username or key" };
  try {
    const res = await fetchWithTimeout(base("balance"), {}, 20000);
    const xml = await res.text();
    const err = tag(xml, "error");
    if (err) return { ok: false, detail: err };
    const value = tag(xml, "value"); const total = tag(xml, "total");
    const st = guard.copyscape.status();
    const extra = st.paused ? ` | PAUSED: ${st.paused}` : st.switchedOff ? " | switched off for testing" : ` | used today ${st.usedToday} of ${st.limit} pages`;
    return { ok: !st.paused, detail: (value ? `Balance ${value} credits, about ${total ?? "?"} pages` : "Key accepted") + extra };
  } catch (e) { return { ok: false, detail: e instanceof Error ? e.message : String(e) }; }
}

export type CopyscapeResult = CopyscapeRow & { link?: string; ran: boolean; fromCache?: boolean };

/** One paid call per page, never retried. Returns "Not run" with the reason whenever the guard says no. */
export async function runCopyscape(url: string): Promise<CopyscapeResult> {
  const row: CopyscapeResult = { url, allowedPct: 5, foundPct: 0, finding: "Not run", ran: false };
  if (!has.copyscape()) { row.finding = "Not run: Copyscape not connected"; return row; }

  const cached = guard.copyscape.cached<CopyscapeResult>(url);
  if (cached) return { ...cached, fromCache: true };

  const blocked = guard.copyscape.blockReason();
  if (blocked) { row.finding = `Not run: ${blocked}`; return row; }

  guard.copyscape.count();
  try {
    // c=1: full-text comparison on the top match only, the cheapest way to get a percentage.
    const res = await fetchWithTimeout(`${base("csearch")}&q=${encodeURIComponent(url)}&c=1`, {}, 60000);
    const xml = await res.text();
    const err = tag(xml, "error");
    if (err) {
      row.finding = `Not run: ${err}`;
      guard.copyscape.pause(err);
      return row;
    }
    row.ran = true;
    const count = Number(tag(xml, "count") ?? 0);
    if (!count) { row.finding = "No meaningful matches."; guard.copyscape.remember(url, row); return row; }
    const first = xml.match(/<result>([\s\S]*?)<\/result>/)?.[1] ?? "";
    const pct = Number(tag(first, "percentmatched") ?? 0);
    const words = tag(first, "minwordsmatched");
    const link = tag(first, "url") ?? undefined;
    const title = tag(first, "title") ?? link ?? "another page";
    row.foundPct = Math.round(pct);
    row.link = link;
    row.finding = pct > 5 ? `${Math.round(pct)}% of the page text also appears on ${title}${words ? ` (${words} words)` : ""}.` : `Small overlap with ${title}${words ? ` (${words} words)` : ""}.`;
    guard.copyscape.remember(url, row);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    row.finding = "Not run: " + msg;
    guard.copyscape.pause(`request failed (${msg.slice(0, 80)})`);
  }
  return row;
}
