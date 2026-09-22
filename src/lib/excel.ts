import ExcelJS from "exceljs";
import type { Report } from "./types";
import { VERTICAL_WORD } from "./data";
import { summarise, longDate } from "@/components/ui";

/**
 * Builds the MSM workbook in the Ever & Ever layout from a report's data.
 * Six tabs: Summary, Client Basic Information, Practice Name Google Search,
 * Nearby Competition Review, Google AI Overview, Services & Notes.
 */

const NAVY = "FF1F3A5F";
const GREEN = "FF2DC937";
const YELLOW = "FFE7B416";
const RED = "FFCC3232";
const SOFT = "FFF1EFE9";
const RULE = "FFDDE1E7";
const RED_100 = "FFF7D9CF";
const AMBER_100 = "FFFBF0C9";
const GREEN_100 = "FFDCEFD9";

type Cell = ExcelJS.Cell;
const thin: Partial<ExcelJS.Borders> = {
  top: { style: "thin", color: { argb: RULE } }, bottom: { style: "thin", color: { argb: RULE } },
  left: { style: "thin", color: { argb: RULE } }, right: { style: "thin", color: { argb: RULE } },
};

function title(ws: ExcelJS.Worksheet, row: number, text: string, sub?: string) {
  const c = ws.getCell(row, 2); c.value = text; c.font = { bold: true, size: 14, color: { argb: NAVY } };
  if (sub) { const s = ws.getCell(row + 1, 2); s.value = sub; s.font = { italic: true, size: 10, color: { argb: "FF666666" } }; }
}
function header(ws: ExcelJS.Worksheet, row: number, startCol: number, labels: string[]) {
  labels.forEach((l, i) => {
    const c = ws.getCell(row, startCol + i); c.value = l;
    c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: NAVY } };
    c.font = { bold: true, color: { argb: "FFFFFFFF" }, size: 10 };
    c.alignment = { vertical: "middle", horizontal: "center", wrapText: true }; c.border = thin;
  });
}
function body(c: Cell, value: ExcelJS.CellValue, opts: { bold?: boolean; wrap?: boolean; center?: boolean; color?: string } = {}) {
  c.value = value; c.border = thin;
  c.font = { size: 10, bold: opts.bold, color: opts.color ? { argb: opts.color } : undefined };
  c.alignment = { vertical: "top", wrapText: opts.wrap !== false, horizontal: opts.center ? "center" : "left" };
}
function link(c: Cell, text: string, url: string) {
  c.value = { text, hyperlink: url }; c.font = { size: 10, color: { argb: NAVY }, underline: true }; c.border = thin;
}
function rankCell(c: Cell, v: number | null | undefined) {
  const label = v === undefined ? "-" : v === null ? "Not on P1" : `#${v}`;
  const color = v === undefined ? RULE : v === null ? RED : v <= 3 ? GREEN : YELLOW;
  c.value = label; c.border = thin;
  c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: color } };
  c.font = { bold: true, size: 10, color: { argb: v === undefined ? "FF666666" : "FFFFFFFF" } };
  c.alignment = { horizontal: "center", vertical: "middle" };
}
function tile(ws: ExcelJS.Worksheet, row: number, col: number, value: string, label: string, sub: string, warn = false) {
  const v = ws.getCell(row, col); v.value = value; v.font = { bold: true, size: 20, color: { argb: warn ? RED : NAVY } };
  v.alignment = { horizontal: "left", vertical: "middle" };
  const l = ws.getCell(row + 1, col); l.value = label.toUpperCase(); l.font = { bold: true, size: 9, color: { argb: "FF6B7A8C" } };
  const s = ws.getCell(row + 2, col); s.value = sub; s.font = { size: 9, color: { argb: "FF8A94A0" } }; s.alignment = { wrapText: true, vertical: "top" };
  for (const r of [row, row + 1, row + 2]) ws.getCell(r, col).fill = { type: "pattern", pattern: "solid", fgColor: { argb: SOFT } };
}
function levelCell(c: Cell, level: "attention" | "watch" | "strength") {
  const map = { attention: ["ATTENTION", RED_100, "FF9B2C1C"], watch: ["WATCH", AMBER_100, "FF7A5A00"], strength: ["STRENGTH", GREEN_100, "FF1E7B34"] } as const;
  const [t, bg, fg] = map[level];
  c.value = t; c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: bg } }; c.font = { bold: true, size: 9, color: { argb: fg } };
  c.alignment = { horizontal: "center", vertical: "middle" }; c.border = thin;
}

export async function buildWorkbook(r: Report, draft = false): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  wb.creator = "MSM Studio"; wb.created = new Date();
  const s = summarise(r);
  const word = VERTICAL_WORD[r.intake.vertical];
  const you = r.intake.company;
  const cities = s.cities;
  const dateText = longDate(r.approvedAt ?? r.startedAt);
  const pct = (n: number, d: number) => (d ? Math.round((n / d) * 100) : 0);

  /* ---------------- Summary ---------------- */
  {
    const ws = wb.addWorksheet("Summary", { views: [{ showGridLines: false }] });
    ws.columns = [{ width: 3 }, { width: 30 }, { width: 3 }, { width: 30 }, { width: 3 }, { width: 30 }, { width: 3 }];
    ws.getCell(2, 2).value = you.toUpperCase(); ws.getCell(2, 2).font = { bold: true, size: 18, color: { argb: NAVY } };
    ws.getCell(3, 2).value = `Marketing Strategy Review (MSM)  |  ${r.intake.name || you}  |  ${dateText}${draft ? "  |  DRAFT" : ""}`;
    ws.getCell(3, 2).font = { size: 10, color: { argb: "FF666666" } };
    ws.getCell(5, 2).value = "BOTTOM LINE"; ws.getCell(5, 2).font = { bold: true, size: 10, color: { argb: NAVY } };
    ws.getCell(5, 4).value = r.bottomLine; ws.getCell(5, 4).font = { bold: true, size: 12 }; ws.mergeCells(5, 4, 5, 6);
    ws.getCell(7, 2).value = "SNAPSHOT - WHERE YOU STAND TODAY"; ws.getCell(7, 2).font = { bold: true, size: 10, color: { argb: NAVY } };
    tile(ws, 8, 2, `${s.top3} / ${s.total}`, "Top-3 rankings", "Searches where you rank in Google's top 3", s.top3 === 0);
    tile(ws, 8, 4, `${s.p1} / ${s.total}`, "Page-1 rankings", `${pct(s.p1, s.total)}% of targets reach page 1`, s.p1 === 0);
    tile(ws, 8, 6, s.reviews != null ? String(s.reviews) : "-", "Google reviews", s.compAvg != null ? `vs. competitor average of ~${s.compAvg}` : "No competitors chosen");
    tile(ws, 12, 2, s.rating != null ? `${s.rating.toFixed(1)}★` : "-", "Your rating", "Reputation strength");
    tile(ws, 12, 4, s.facebook ? "Yes" : "No", "Facebook page", s.facebook ? "Active page" : "No active page");
    tile(ws, 12, 6, String(s.lost), "Keyword/city slots lost", "Where a competitor ranks above you");
    ws.getCell(16, 2).value = "TOP FINDINGS"; ws.getCell(16, 2).font = { bold: true, size: 10, color: { argb: NAVY } };
    let row = 17;
    for (const f of r.findings) {
      levelCell(ws.getCell(row, 2), f.level);
      const c = ws.getCell(row, 4); body(c, f.text); ws.mergeCells(row, 4, row, 6);
      ws.getRow(row).height = Math.max(18, Math.ceil(f.text.length / 70) * 14);
      row++;
    }
    ws.getRow(8).height = 26; ws.getRow(12).height = 26; ws.getRow(10).height = 26; ws.getRow(14).height = 26;
  }

  /* ---------------- Client Basic Information ---------------- */
  {
    const ws = wb.addWorksheet("Client Basic Information", { views: [{ showGridLines: false }] });
    ws.columns = [{ width: 3 }, { width: 30 }, { width: 80 }];
    title(ws, 2, "CLIENT BASIC INFORMATION", "Confirmed at intake; everything else in this workbook was researched.");
    const rows: [string, string, string?][] = [
      ["Date Prepared", dateText], ["Owner / Doctor", r.intake.name || "-"], ["Practice Name", you], ["Website", r.intake.website],
    ];
    if (r.legacySite) rows.push(["Legacy website (still live)", r.legacySite, "red"]);
    rows.push([you, r.intake.address], ["Office Number", r.intake.office || "-"], ["Email Address", r.intake.email || "-"], ["Cell Number", r.intake.cell || "-"],
      ["Website Platform / CMS", r.wordpress ? "WordPress" : "Not WordPress"], ["Service Lines", r.services.join(", ")],
      ["How did you find out about us?", r.intake.referral || "-"], ["Additional Questions / Comments", r.intake.comments || "-"], ["Assigned AE", r.ae]);
    let row = 4;
    for (const [k, v, flag] of rows) {
      body(ws.getCell(row, 2), k, { bold: true }); ws.getCell(row, 2).fill = { type: "pattern", pattern: "solid", fgColor: { argb: SOFT } };
      body(ws.getCell(row, 3), v, { color: flag === "red" ? "FFC00000" : undefined }); row++;
    }
  }

  /* ---------------- Practice Name Google Search ---------------- */
  {
    const ws = wb.addWorksheet("Practice Name Google Search", { views: [{ showGridLines: false }] });
    ws.columns = [{ width: 3 }, { width: 28 }, { width: 18 }, { width: 18 }, { width: 18 }, { width: 18 }, { width: 18 }, { width: 18 }, { width: 18 }];
    title(ws, 2, "PRACTICE NAME GOOGLE SEARCH", "Practice name & URL, keyword rankings, PageSpeed, content originality, NAP consistency.");
    body(ws.getCell(4, 2), "Practice Name", { bold: true }); body(ws.getCell(4, 3), you); ws.mergeCells(4, 3, 4, 5);
    body(ws.getCell(5, 2), "Practice URL", { bold: true }); link(ws.getCell(5, 3), r.intake.website, r.intake.website); ws.mergeCells(5, 3, 5, 5);

    let row = 7;
    ws.getCell(row, 2).value = `KEYWORD RANKINGS - WHERE ${word.toUpperCase()}S FIND YOU (OR DON'T)`; ws.getCell(row, 2).font = { bold: true, size: 11, color: { argb: NAVY } }; row++;
    ws.getCell(row, 2).value = "Google organic position for each service in each city. Green = top 3, yellow = page 1 below #3, red = not on page 1."; ws.getCell(row, 2).font = { italic: true, size: 9, color: { argb: "FF666666" } }; row += 2;
    cities.forEach((c, i) => {
      const onP1 = s.keywords.filter((k) => r.ranks[k]?.[i] != null).length;
      const cell = ws.getCell(row, 2 + i * 2);
      cell.value = `${c.name.toUpperCase()} · pop ${c.population.toLocaleString()}\n${onP1} / ${s.keywords.length} on page 1`;
      cell.font = { bold: true, size: 10, color: { argb: NAVY } }; cell.alignment = { wrapText: true, vertical: "middle" };
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: SOFT } }; ws.mergeCells(row, 2 + i * 2, row, 3 + i * 2);
    });
    ws.getRow(row).height = 32; row += 2;
    header(ws, row, 2, ["Service Keyword", ...cities.map((c) => `${c.name}, ${c.state}`), "Who ranks top 3 instead (home city)"]);
    ws.mergeCells(row, 3 + cities.length, row, 5 + cities.length); row++;
    for (const k of s.keywords) {
      body(ws.getCell(row, 2), k);
      cities.forEach((_, i) => rankCell(ws.getCell(row, 3 + i), r.ranks[k]?.[i]));
      const who = r.aiMode.find((a) => a.keyword === k)?.others.slice(0, 2).join("; ") || "-";
      body(ws.getCell(row, 3 + cities.length), who); ws.mergeCells(row, 3 + cities.length, row, 5 + cities.length); row++;
    }
    body(ws.getCell(row, 2), "Page-1 presence", { bold: true });
    cities.forEach((_, i) => body(ws.getCell(row, 3 + i), `${s.keywords.filter((k) => r.ranks[k]?.[i] != null).length} of ${s.keywords.length}`, { bold: true, center: true }));
    body(ws.getCell(row, 3 + cities.length), `Overall: ${s.p1} / ${s.total} page-1 · ${s.top3} top-3`); ws.mergeCells(row, 3 + cities.length, row, 5 + cities.length); row += 2;

    ws.getCell(row, 2).value = "GOOGLE PAGESPEED - HOME PAGE & A KEY SERVICE PAGE"; ws.getCell(row, 2).font = { bold: true, size: 11, color: { argb: NAVY } }; row++;
    ws.getCell(row, 2).value = "Run at pagespeed.web.dev. Mobile and desktop, both pages."; ws.getCell(row, 2).font = { italic: true, size: 9, color: { argb: "FF666666" } }; row++;
    header(ws, row, 2, ["Page", "Device", "Performance", "Accessibility", "Best Practices", "SEO", "Link"]); row++;
    for (const p of r.pageSpeed) {
      body(ws.getCell(row, 2), `${p.page} — ${p.url}`); body(ws.getCell(row, 3), p.device, { center: true });
      const perf = ws.getCell(row, 4); body(perf, p.performance ?? "Not run", { bold: true, center: true, color: (p.performance ?? 100) < 50 ? "FFC00000" : (p.performance ?? 100) < 90 ? "FF7A5A00" : "FF1E7B34" });
      body(ws.getCell(row, 5), p.accessibility ?? "-", { center: true }); body(ws.getCell(row, 6), p.bestPractices ?? "-", { center: true }); body(ws.getCell(row, 7), p.seo ?? "-", { center: true });
      link(ws.getCell(row, 8), "Run ↗", `https://pagespeed.web.dev/analysis?url=${encodeURIComponent(p.url)}`); row++;
    }
    row++;
    ws.getCell(row, 2).value = "CONTENT ORIGINALITY (COPYSCAPE)"; ws.getCell(row, 2).font = { bold: true, size: 11, color: { argb: NAVY } }; row++;
    header(ws, row, 2, ["Page", "% Allowed", "% Found", "Finding", "", "", "Link"]); ws.mergeCells(row, 5, row, 7); row++;
    for (const c of r.copyscape) {
      body(ws.getCell(row, 2), c.url); body(ws.getCell(row, 3), `${c.allowedPct}%`, { center: true });
      body(ws.getCell(row, 4), `${c.foundPct}%`, { bold: true, center: true, color: c.foundPct > c.allowedPct ? "FFC00000" : "FF1E7B34" });
      body(ws.getCell(row, 5), c.finding); ws.mergeCells(row, 5, row, 7); link(ws.getCell(row, 8), "View match ↗", "https://www.copyscape.com/"); row++;
    }
    row++;
    ws.getCell(row, 2).value = "NAP CONSISTENCY - NAME · ADDRESS · PHONE ACROSS LISTINGS"; ws.getCell(row, 2).font = { bold: true, size: 11, color: { argb: NAVY } }; row++;
    ws.getCell(row, 2).value = "A 6-platform sweep, checked against the on-file record. Green = match, red = mismatch."; ws.getCell(row, 2).font = { italic: true, size: 9, color: { argb: "FF666666" } }; row++;
    header(ws, row, 2, ["Field", "On file (source of truth)", ...r.listings.map((l) => l.platform)]); row++;
    const fields: ["name" | "address" | "phone", string, string][] = [["name", "Business Name", you], ["address", "Street Address", r.intake.address], ["phone", "Phone", r.intake.office]];
    for (const [f, label, onFile] of fields) {
      body(ws.getCell(row, 2), label, { bold: true }); body(ws.getCell(row, 3), onFile);
      r.listings.forEach((l, i) => {
        const c = ws.getCell(row, 4 + i);
        if (l.match === "not-listed") body(c, "Not listed", { color: "FF9B2C1C" });
        else if (l.match === "not-checked") body(c, "Not checked", { color: "FF666666" });
        else if (l.match === "not-applicable") body(c, `N/A: ${l.reason ?? ""}`, { color: "FF666666" });
        else { const bad = l.match === "mismatch" && l[f] !== onFile; body(c, `${bad ? "✗" : "✓"} ${l[f] ?? ""}`, { color: bad ? "FFC00000" : "FF1E7B34" }); }
      });
      row++;
    }
    body(ws.getCell(row, 2), "Link", { bold: true }); body(ws.getCell(row, 3), "");
    r.listings.forEach((l, i) => { const c = ws.getCell(row, 4 + i); if (l.url) link(c, "Listing ↗", l.url); else body(c, "-"); });
  }

  /* ---------------- Nearby Competition Review ---------------- */
  {
    const ws = wb.addWorksheet("Nearby Competition Review", { views: [{ showGridLines: false }] });
    const chosen = s.chosen;
    const cols: Partial<ExcelJS.Column>[] = [{ width: 3 }, { width: 26 }];
    for (let i = 0; i < (1 + chosen.length) * cities.length; i++) cols.push({ width: 13 });
    ws.columns = cols;
    title(ws, 2, "COMPETITION - WHO OUTRANKS YOU, AND WHERE", "Organic Google search only, side by side. Review counts are in the Reviews table below.");
    let row = 4;
    header(ws, row, 2, ["Service Keyword"]);
    [{ name: `${you} (YOU)` }, ...chosen].forEach((c, ci) => {
      const start = 3 + ci * cities.length; header(ws, row, start, [c.name]); if (cities.length > 1) ws.mergeCells(row, start, row, start + cities.length - 1);
    });
    row++;
    header(ws, row, 2, [""]);
    [null, ...chosen].forEach((_, ci) => cities.forEach((city, i) => header(ws, row, 3 + ci * cities.length + i, [city.name])));
    row++;
    for (const k of s.keywords) {
      body(ws.getCell(row, 2), k);
      cities.forEach((_, i) => rankCell(ws.getCell(row, 3 + i), r.ranks[k]?.[i]));
      chosen.forEach((c, ci) => cities.forEach((_, i) => rankCell(ws.getCell(row, 3 + (ci + 1) * cities.length + i), r.competitorRanks[c.id]?.[k]?.[i])));
      row++;
    }
    row++;
    ws.getCell(row, 2).value = "LEGEND"; ws.getCell(row, 2).font = { bold: true, size: 10, color: { argb: NAVY } }; row++;
    rankCell(ws.getCell(row, 2), 1); ws.getCell(row, 2).value = "Top 3"; row++;
    rankCell(ws.getCell(row, 2), 5); ws.getCell(row, 2).value = "Page 1, below #3"; row++;
    rankCell(ws.getCell(row, 2), null); row += 2;

    ws.getCell(row, 2).value = "PROOF & SOURCES"; ws.getCell(row, 2).font = { bold: true, size: 11, color: { argb: NAVY } }; row++;
    for (const c of chosen) {
      let leads = 0;
      for (const k of s.keywords) cities.forEach((_, i) => { const mine = r.ranks[k]?.[i] ?? 99; const theirs = r.competitorRanks[c.id]?.[k]?.[i] ?? 99; if (theirs < mine) leads++; });
      body(ws.getCell(row, 2), c.name, { bold: true });
      if (c.website) link(ws.getCell(row, 3), "Website ↗", `https://${c.website}`); else body(ws.getCell(row, 3), "Needs manual check");
      link(ws.getCell(row, 4), "Google listing ↗", `https://www.google.com/maps/search/${encodeURIComponent(c.name)}`);
      body(ws.getCell(row, 5), `${leads} keyword/city leads`); ws.mergeCells(row, 5, row, 6); row++;
    }
    row++;
    ws.getCell(row, 2).value = "REVIEWS & REPUTATION"; ws.getCell(row, 2).font = { bold: true, size: 11, color: { argb: NAVY } }; row++;
    header(ws, row, 2, ["Practice / Competitor", "Platform", "Rating", "# Reviews", "Finding"]); ws.mergeCells(row, 6, row, 8); row++;
    for (const x of r.reviews) {
      body(ws.getCell(row, 2), x.who, { bold: x.who.endsWith("(YOU)") }); body(ws.getCell(row, 3), x.platform, { center: true });
      body(ws.getCell(row, 4), x.rating != null ? `${x.rating.toFixed(1)}/5.0` : "No rating yet", { center: true });
      body(ws.getCell(row, 5), x.reviews ?? "-", { center: true }); body(ws.getCell(row, 6), x.note || "—"); ws.mergeCells(row, 6, row, 8); row++;
    }
  }

  /* ---------------- Google AI Overview ---------------- */
  {
    const ws = wb.addWorksheet("Google AI Overview", { views: [{ showGridLines: false }] });
    ws.columns = [{ width: 3 }, { width: 26 }, { width: 16 }, { width: 90 }];
    title(ws, 2, "GOOGLE AI OVERVIEW / AI MODE", `Whether Google's AI-generated answer names the practice, for all ${r.aiMode.length} chosen keywords.`);
    header(ws, 4, 2, ["Keyword", "Do We Show Up?", "Who Shows Up Instead"]);
    let row = 5;
    for (const a of r.aiMode) {
      body(ws.getCell(row, 2), a.keyword);
      const c = ws.getCell(row, 3); body(c, a.shows ? "Yes" : "No", { bold: true, center: true, color: a.shows ? "FF1E7B34" : "FF9B2C1C" });
      c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: a.shows ? GREEN_100 : RED_100 } };
      body(ws.getCell(row, 4), a.shows ? "—" : a.others.join(", ")); row++;
    }
    row++;
    const home = cities[0];
    ws.getCell(row, 2).value = `Verification searches use the home city and state (${home?.name}, ${home?.state}). Rows spot-checked at checkpoint 3: ${r.aiMode.filter((a) => a.checked).length} of ${r.aiMode.length}.`;
    ws.getCell(row, 2).font = { italic: true, size: 9, color: { argb: "FF666666" } };
  }

  /* ---------------- Services & Notes ---------------- */
  {
    const ws = wb.addWorksheet("Services & Notes", { views: [{ showGridLines: false }] });
    ws.columns = [{ width: 3 }, { width: 100 }];
    title(ws, 2, "SERVICES & NOTES", "Core service lines and where the search gap is widest.");
    let row = 4;
    ws.getCell(row, 2).value = "Service Lines"; ws.getCell(row, 2).font = { bold: true, size: 10, color: { argb: NAVY } }; row++;
    for (const x of r.services) { ws.getCell(row, 2).value = `• ${x}`; row++; }
    row++;
    ws.getCell(row, 2).value = "Notes"; ws.getCell(row, 2).font = { bold: true, size: 10, color: { argb: NAVY } }; row++;
    const note = s.p1 === 0
      ? `The visibility gap is total, not partial: across all ${s.keywords.length} tracked services and ${cities.length} cities, the practice does not reach page 1 once.`
      : `The practice reaches page 1 in ${s.p1} of ${s.total} keyword/city slots and the top 3 in ${s.top3}. The widest gaps are outside the home city.`;
    ws.getCell(row, 2).value = note; ws.getCell(row, 2).alignment = { wrapText: true, vertical: "top" }; row += 2;
    ws.getCell(row, 2).value = `Wording uses "${word}" for the ${r.intake.vertical} vertical. Assigned AE: ${r.ae}. ${r.approvedBy ? `Approved by ${r.approvedBy} on ${dateText}.` : "Not yet approved."}`;
    ws.getCell(row, 2).font = { italic: true, size: 9, color: { argb: "FF666666" } };
  }

  const out = await wb.xlsx.writeBuffer();
  return Buffer.from(out as ArrayBuffer);
}
