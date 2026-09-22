import { fetchWithTimeout } from "./env";

export interface SiteInfo {
  ok: boolean;
  finalUrl: string;
  wordpress: boolean;
  title: string;
  text: string;
  links: string[];
  servicePages: string[];
  error?: string;
}

const SERVICE_HINT = /service|treatment|procedure|dental|implant|invisalign|botox|filler|laser|skin|facial|pediatric|derma|paralegal|immigration|divorce|notary|care|whitening|veneer/i;

/** Fetches the home page, detects WordPress and finds likely service pages. Reads only public HTML. */
export async function inspectSite(url: string): Promise<SiteInfo> {
  const info: SiteInfo = { ok: false, finalUrl: url, wordpress: false, title: "", text: "", links: [], servicePages: [] };
  try {
    const res = await fetchWithTimeout(url, { headers: { "User-Agent": "Mozilla/5.0 (compatible; MSMStudio/1.0)" }, redirect: "follow" }, 20000);
    info.finalUrl = res.url || url;
    const html = await res.text();
    info.ok = res.ok;
    info.wordpress = /wp-content|wp-includes|wp-json|generator" content="WordPress/i.test(html);
    info.title = (html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] ?? "").replace(/\s+/g, " ").trim();
    const origin = new URL(info.finalUrl).origin;
    const seen = new Set<string>();
    for (const m of html.matchAll(/<a[^>]+href=["']([^"'#?]+)["']/gi)) {
      let href = m[1].trim();
      if (href.startsWith("mailto:") || href.startsWith("tel:") || href.startsWith("javascript:")) continue;
      try { href = new URL(href, info.finalUrl).toString(); } catch { continue; }
      if (!href.startsWith(origin)) continue;
      href = href.replace(/\/$/, "");
      if (seen.has(href) || href === origin) continue;
      seen.add(href);
    }
    info.links = [...seen];
    info.servicePages = info.links.filter((l) => SERVICE_HINT.test(l.replace(origin, ""))).slice(0, 12);
    info.text = html
      .replace(/<script[\s\S]*?<\/script>/gi, " ").replace(/<style[\s\S]*?<\/style>/gi, " ").replace(/<[^>]+>/g, " ")
      .replace(/&nbsp;|&amp;|&#\d+;/g, " ").replace(/\s+/g, " ").trim();
  } catch (e) {
    info.error = e instanceof Error ? e.message : String(e);
  }
  return info;
}
