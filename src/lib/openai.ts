import { env, fetchWithTimeout, has } from "./env";
import type { Finding, Report, Vertical } from "./types";
import { VERTICAL_WORD } from "./data";

/** Small wrapper over the OpenAI chat API that returns parsed JSON. */
async function ask<T>(system: string, user: string, schemaHint: string): Promise<T | null> {
  if (!has.openai()) return null;
  try {
    const res = await fetchWithTimeout("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${env.openaiKey}` },
      body: JSON.stringify({
        model: "gpt-4o-mini", temperature: 0.2, response_format: { type: "json_object" },
        messages: [{ role: "system", content: `${system}\nReply with JSON only, shaped exactly like: ${schemaHint}` }, { role: "user", content: user }],
      }),
    }, 45000);
    if (!res.ok) return null;
    const json = await res.json();
    const text = json?.choices?.[0]?.message?.content;
    return text ? (JSON.parse(text) as T) : null;
  } catch { return null; }
}

export async function checkOpenAI(): Promise<{ ok: boolean; detail: string }> {
  if (!has.openai()) return { ok: false, detail: "No key" };
  try {
    const res = await fetchWithTimeout("https://api.openai.com/v1/models/gpt-4o-mini", { headers: { Authorization: `Bearer ${env.openaiKey}` } }, 20000);
    if (res.ok) return { ok: true, detail: "Key accepted, gpt-4o-mini available" };
    const j = await res.json().catch(() => ({}));
    return { ok: false, detail: j?.error?.message?.slice(0, 160) ?? `HTTP ${res.status}` };
  } catch (e) { return { ok: false, detail: e instanceof Error ? e.message : String(e) }; }
}

/** From page text, list the service lines and suggest 10 keywords a patient/client would type. */
export async function servicesAndKeywords(company: string, vertical: Vertical, pageText: string, links: string[]): Promise<{ services: string[]; keywords: string[]; extra: string[] } | null> {
  const who = VERTICAL_WORD[vertical];
  return ask(
    `You help prepare a local Google visibility report for a ${vertical} practice. Be concrete and use the words a ${who} would type into Google.`,
    `Business: ${company}\nWebsite text (trimmed):\n${pageText.slice(0, 6000)}\n\nPage links:\n${links.slice(0, 60).join("\n")}\n\nList the core service lines offered (4 to 8, short names). Then give exactly 10 primary search keywords covering those services (2 to 4 words each, no city names, no brand name), plus 2 extra optional keywords.`,
    `{"services":["..."],"keywords":["10 items"],"extra":["2 items"]}`,
  );
}

/** Reads the text of a Google AI Mode page and says whether the practice is named and who is. */
export async function aiModeNames(clientName: string, clientDomain: string, keyword: string, text: string): Promise<{ shows: boolean; others: string[] } | null> {
  if (!text.trim()) return null;
  return ask(
    "You read the text of a Google AI Mode answer for a local search and list the business names it recommends.",
    `Search: ${keyword}\nOur practice: ${clientName} (${clientDomain})\n\nPage text:\n${text.slice(0, 5000)}\n\nDoes the answer name our practice? List up to 4 other businesses it names (exact names as written, no descriptions).`,
    `{"shows":true|false,"others":["..."]}`,
  );
}

export interface ListingRead {
  found: boolean;
  name: string | null;
  address: string | null;
  phone: string | null;
  url: string | null;
  rating: number | null;
  reviews: number | null;
  /** whether name, address and phone agree with the on-file record (minor formatting differences are fine) */
  matches: boolean;
  note: string;
}

/** Reads a platform page (Google, Bing, Yelp, Facebook, Yellow Pages, Zocdoc) and pulls out the business listing. */
export async function readListing(platform: string, onFile: { name: string; address: string; phone: string }, pageUrl: string, text: string): Promise<ListingRead | null> {
  if (!text.trim()) return null;
  return ask<ListingRead>(
    `You read the text of a ${platform} page and find the listing for one specific business. Suite numbers, abbreviations like Rd/Road and phone formatting do not count as differences. If the business is not on the page, found is false and every other field is null.`,
    `Business on file:\nName: ${onFile.name}\nAddress: ${onFile.address}\nPhone: ${onFile.phone}\n\nPage URL: ${pageUrl}\n\nPage text:\n${text.slice(0, 7000)}\n\nReturn the listing exactly as shown on the page, the star rating and review count if shown, and whether the name, address and phone agree with the record on file. In note, say in one short sentence what differs, or "Match".`,
    `{"found":true|false,"name":"...|null","address":"...|null","phone":"...|null","url":"...|null","rating":4.8|null,"reviews":123|null,"matches":true|false,"note":"..."}`,
  );
}

/** Google rating and review count for a competitor, from its Google search page text. */
export async function readGoogleReviews(name: string, text: string): Promise<{ found: boolean; rating: number | null; reviews: number | null; address: string | null; phone: string | null } | null> {
  if (!text.trim()) return null;
  return ask(
    "You read the text of a Google search page and find the Google Business Profile panel for one business.",
    `Business: ${name}\n\nPage text:\n${text.slice(0, 6000)}\n\nGive the star rating, the number of Google reviews, the address and phone from the business panel. If there is no panel for this business, found is false.`,
    `{"found":true|false,"rating":4.7|null,"reviews":312|null,"address":"...|null","phone":"...|null"}`,
  );
}

/** Bottom line and 3 to 5 findings from the numbers. */
export async function writeFindings(r: Report, s: { total: number; top3: number; p1: number; lost: number; reviews: number | null; rating: number | null; compAvg: number | null }): Promise<{ bottomLine: string; findings: Finding[] } | null> {
  const who = VERTICAL_WORD[r.intake.vertical];
  const facts = [
    `Keyword/city slots: ${s.total}. Top-3: ${s.top3}. Page-1: ${s.p1}. Slots where a competitor ranks above: ${s.lost}.`,
    `Google rating ${s.rating ?? "none"} with ${s.reviews ?? 0} reviews; chosen competitors average ${s.compAvg ?? "n/a"} reviews.`,
    `PageSpeed: ${r.pageSpeed.map((p) => `${p.page} ${p.device} performance ${p.performance ?? "not run"}`).join("; ")}.`,
    `Copyscape: ${r.copyscape.map((c) => `${c.url} ${c.foundPct}% found`).join("; ")} (5% allowed).`,
    `Listings: ${r.listings.map((l) => `${l.platform} ${l.match}`).join(", ")}.`,
    `Website platform: ${r.wordpress ? "WordPress" : "not WordPress"}.${r.legacySite ? ` Legacy site still live: ${r.legacySite}.` : ""}`,
    `AI Mode names the practice for ${r.aiMode.filter((a) => a.shows).length} of ${r.aiMode.length} keywords.`,
  ].join("\n");
  const out = await ask<{ bottomLine: string; findings: { level: string; text: string }[] }>(
    `You write short, plain findings for a local marketing review of a ${r.intake.vertical} practice. Use the word "${who}" not "customer". No hype, no jargon, no exclamation marks. Each finding is one or two sentences with the number that proves it.`,
    `Practice: ${r.intake.company}\nFacts:\n${facts}\n\nWrite a one-sentence bottom line (max 12 words) and 3 to 5 findings. Level is "attention" for the biggest problems, "watch" for things to fix, "strength" for what is working.`,
    `{"bottomLine":"...","findings":[{"level":"attention|watch|strength","text":"..."}]}`,
  );
  if (!out) return null;
  const lv = (x: string): Finding["level"] => (x === "attention" || x === "strength" ? x : "watch");
  return { bottomLine: out.bottomLine, findings: out.findings.slice(0, 5).map((f) => ({ level: lv(f.level), text: f.text })) };
}
