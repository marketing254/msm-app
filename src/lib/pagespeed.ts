import { env, fetchWithTimeout, has } from "./env";
import type { PageSpeedRow } from "./types";

/** Google PageSpeed Insights API v5. Free. Returns the four category scores, or nulls ("Not run") on failure. */
export async function runPageSpeed(page: string, url: string, device: "Mobile" | "Desktop"): Promise<PageSpeedRow> {
  const row: PageSpeedRow = { page, url, device, performance: null, accessibility: null, bestPractices: null, seo: null };
  if (!has.pagespeed()) return row;
  const q = new URLSearchParams({ url, strategy: device === "Mobile" ? "mobile" : "desktop", key: env.pagespeedKey });
  for (const c of ["performance", "accessibility", "best-practices", "seo"]) q.append("category", c);
  try {
    const res = await fetchWithTimeout(`https://www.googleapis.com/pagespeedonline/v5/runPagespeed?${q}`, {}, 60000);
    if (!res.ok) return row;
    const json = await res.json();
    const cats = json?.lighthouseResult?.categories ?? {};
    const score = (k: string) => (typeof cats[k]?.score === "number" ? Math.round(cats[k].score * 100) : null);
    row.performance = score("performance"); row.accessibility = score("accessibility"); row.bestPractices = score("best-practices"); row.seo = score("seo");
  } catch { /* leave as Not run */ }
  return row;
}

export async function checkPageSpeed(): Promise<{ ok: boolean; detail: string }> {
  if (!has.pagespeed()) return { ok: false, detail: "No key" };
  try {
    const q = new URLSearchParams({ url: "https://example.com/", strategy: "mobile", category: "seo", key: env.pagespeedKey });
    const res = await fetchWithTimeout(`https://www.googleapis.com/pagespeedonline/v5/runPagespeed?${q}`, {}, 45000);
    if (res.ok) return { ok: true, detail: "Key accepted" };
    const j = await res.json().catch(() => ({}));
    return { ok: false, detail: j?.error?.message?.slice(0, 160) ?? `HTTP ${res.status}` };
  } catch (e) { return { ok: false, detail: e instanceof Error ? e.message : String(e) }; }
}
