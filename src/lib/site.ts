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
const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36 MSMStudio/1.0";

/** Fetches the home page, detects WordPress and finds likely service pages. Reads only public HTML. */
/**
 * The name a business calls itself on its own home page: og:site_name, else the brand part of the <title>.
 * Returns "" when the site cannot be read or nothing looks like a name.
 */
export async function siteName(domain: string): Promise<string> {
  try {
    const res = await fetchWithTimeout(`https://${domain}/`, { headers: { "User-Agent": UA, Accept: "text/html" }, redirect: "follow" }, 8000);
    if (!res.ok) return "";
    const html = (await res.text()).slice(0, 200_000);
    const meta = (prop: string) => {
      const m = html.match(new RegExp(`<meta[^>]+(?:property|name)=["']${prop}["'][^>]*content=["']([^"']+)`, "i")) || html.match(new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]*(?:property|name)=["']${prop}["']`, "i"));
      return m ? decode(m[1]).trim() : "";
    };
    const site = meta("og:site_name");
    if (site && site.length <= 60) return site;
    const title = decode((html.match(/<title[^>]*>([^<]+)<\/title>/i)?.[1] ?? "")).replace(/\s+/g, " ").trim();
    if (!title) return "";
    const pieces = title.split(/\s[|\-–—:·»]\s/).map((p) => p.trim()).filter((p) => p.length >= 3 && p.length <= 60);
    if (pieces.length === 1) return pieces[0];
    // Brand is usually the shortest piece without generic marketing words.
    const plain = pieces.filter((p) => !/\b(best|top|voted|award|#1|near me|prices?|home|welcome)\b/i.test(p));
    return (plain.length ? plain : pieces).sort((a, b) => a.length - b.length)[0] ?? "";
  } catch { return ""; }
}

function decode(s: string): string {
  return s.replace(/&amp;/g, "&").replace(/&#39;|&apos;/g, "'").replace(/&quot;/g, '"').replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n))).replace(/&nbsp;/g, " ");
}

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
