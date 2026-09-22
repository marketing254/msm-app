import ExcelJS from "exceljs";
import { ALLOWED_USERS } from "./auth";
import { listReports } from "./store";
import { DRIVE_FOLDER } from "./data";
import type { Report } from "./types";

/**
 * Snapshot of what the MSM Database sheet will hold, built from the current in-memory state.
 * Same tabs and columns as MSM Database.xlsx: Users, Reports, Report Data, Log.
 * When the sheet is connected, the app writes these rows there instead.
 */

const NAVY = "FF1F3A5F";

function addTable(wb: ExcelJS.Workbook, name: string, columns: { header: string; width: number }[], rows: ExcelJS.CellValue[][]) {
  const ws = wb.addWorksheet(name, { views: [{ state: "frozen", ySplit: 1 }] });
  ws.columns = columns.map((c) => ({ header: c.header, width: c.width }));
  ws.getRow(1).eachCell((c) => {
    c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: NAVY } };
    c.font = { bold: true, color: { argb: "FFFFFFFF" } };
  });
  for (const r of rows) ws.addRow(r);
  ws.autoFilter = { from: { row: 1, column: 1 }, to: { row: Math.max(rows.length + 1, 2), column: columns.length } };
  return ws;
}

const STATUS_LABEL: Record<Report["status"], string> = { draft: "Draft", running: "Running", waiting: "Waiting for you", ready: "Ready to review", sent: "Sent" };

/** One Reports-tab row for a report, in the MSM Database column order. */
export function reportRow(r: Report): ExcelJS.CellValue[] {
  const home = r.cities.find((c) => c.home) ?? r.cities[0];
  return [`R${r.id}`, r.intake.company, r.intake.vertical, r.intake.website, home.name, home.state, r.ae, r.notify, STATUS_LABEL[r.status], r.currentStep, r.nextStepLabel,
    "Dulmini Dodawatte", r.startedAt.replace("T", " ").slice(0, 16), r.approvedBy ?? "", (r.approvedAt ?? "").replace("T", " ").slice(0, 16),
    r.delivery.sheetUrl && r.delivery.sheetUrl !== "#" ? r.delivery.sheetUrl : "",
    `${DRIVE_FOLDER}/${r.intake.company}`, { "not-sent": "Not sent", pending: "Pending", approved: "Approved" }[r.delivery.aeApproval], "",
    { "not-connected": "Not connected", pending: "Pending", written: "Written" }[r.delivery.hubspot], "", r.legacySite ? "Legacy site still live" : ""];
}

export function reportDataRows(r: Report): ExcelJS.CellValue[][] {
  const id = `R${r.id}`;
  const out: ExcelJS.CellValue[][] = [];
  const add = (section: string, key: string, value: string, link = "", by = "", at = "") => out.push([`D${String(out.length + 1).padStart(4, "0")}`, id, section, key, value, link, by, at]);
  const cities = r.cities.filter((c) => c.selected);
  for (const [k, v] of Object.entries(r.intake)) add("intake", k, String(v));
  add("site", "wordpress", r.wordpress ? "Yes" : "No");
  if (r.legacySite) add("site", "legacy_site", "Still live", r.legacySite);
  for (const s of r.services) add("site", "service", s);
  for (const c of r.cities) add("city", `${c.name}, ${c.state}`, `${c.selected ? "Yes" : "No"}${c.home ? " (home)" : ""} | pop ${c.population.toLocaleString()} | ${c.distanceMiles} mi`);
  for (const k of r.keywords) add("keyword", k.keyword, k.selected ? "Approved" : "Not selected");
  for (const k of r.keywords.filter((x) => x.selected)) cities.forEach((c, i) => { const v = r.ranks[k.keyword]?.[i]; add("rank", `${k.keyword} | ${c.name}`, v == null ? "Not on page 1" : `#${v}`); });
  for (const c of r.competitors) add("competitor", c.name, `${c.selected ? "Chosen" : "Not chosen"} | beats ${c.beats} | ${c.distanceMiles} mi | overlap ${c.overlapPct}% | Google ${c.rating} (${c.reviews}) | ${c.verified}`, c.website ? `https://${c.website}` : "");
  for (const p of r.pageSpeed) add("pagespeed", `${p.page} | ${p.device}`, `Performance ${p.performance ?? "Not run"} | Accessibility ${p.accessibility ?? "-"} | Best practices ${p.bestPractices ?? "-"} | SEO ${p.seo ?? "-"}`, `https://pagespeed.web.dev/analysis?url=${encodeURIComponent(p.url)}`);
  for (const c of r.copyscape) add("copyscape", c.url, `${c.foundPct}% found | ${c.allowedPct}% allowed | ${c.finding}`);
  for (const l of r.listings) add("listing", l.platform, `${l.match}${l.reason ? ` (${l.reason})` : ""} | found by ${l.source}${l.confirmed ? " | confirmed" : ""}`, l.url ?? "");
  for (const x of r.reviews) add("review", `${x.who} | ${x.platform}`, `${x.rating != null ? x.rating.toFixed(1) : "No rating yet"} | ${x.reviews ?? "-"} reviews${x.note ? ` | ${x.note}` : ""}`);
  for (const a of r.aiMode) add("ai_mode", a.keyword, a.shows ? "Yes" : `No | shows instead: ${a.others.join(", ")}`);
  add("summary", "bottom_line", r.bottomLine);
  for (const f of r.findings) add("finding", f.level.charAt(0).toUpperCase() + f.level.slice(1), f.text);
  return out;
}

export async function buildDatabaseSnapshot(): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  wb.creator = "MSM Studio"; wb.created = new Date();
  const reports = await listReports();

  addTable(wb, "Users", [
    { header: "user_id", width: 10 }, { header: "name", width: 22 }, { header: "email", width: 24 }, { header: "role", width: 12 }, { header: "team", width: 14 }, { header: "active", width: 9 },
  ], ALLOWED_USERS.map((u, i) => [`U${String(i + 1).padStart(3, "0")}`, u.name, u.email, u.role, u.team, "Yes"]));

  addTable(wb, "Reports", [
    { header: "report_id", width: 10 }, { header: "client_name", width: 28 }, { header: "vertical", width: 10 }, { header: "website", width: 30 }, { header: "home_city", width: 14 }, { header: "state", width: 7 },
    { header: "assigned_ae", width: 16 }, { header: "notify_via", width: 14 }, { header: "status", width: 16 }, { header: "current_step", width: 8 }, { header: "next_step", width: 32 },
    { header: "created_by", width: 18 }, { header: "created_at", width: 17 }, { header: "approved_by", width: 18 }, { header: "approved_at", width: 17 }, { header: "sheet_url", width: 40 },
    { header: "drive_folder", width: 42 }, { header: "ae_approval", width: 12 }, { header: "hubspot_status", width: 15 }, { header: "notes", width: 30 },
  ], reports.map((r) => { const row = reportRow(r); return [...row.slice(0, 18), row[19], row[21]]; }));

  addTable(wb, "Report Data", [
    { header: "row_id", width: 9 }, { header: "report_id", width: 10 }, { header: "section", width: 13 }, { header: "key", width: 40 }, { header: "value", width: 70 }, { header: "link", width: 50 }, { header: "confirmed_by", width: 18 }, { header: "confirmed_at", width: 17 },
  ], reports.flatMap(reportDataRows).map((row, i) => { row[0] = `D${String(i + 1).padStart(4, "0")}`; return row; }));

  const logRows: ExcelJS.CellValue[][] = [];
  for (const r of reports) for (const l of [...r.log].reverse()) logRows.push([`L${String(logRows.length + 1).padStart(4, "0")}`, `R${r.id}`, `${r.startedAt.slice(0, 10)} ${l.time}`, l.text.includes("by ") ? l.text.split("by ").pop() : "System", l.text]);
  addTable(wb, "Log", [
    { header: "log_id", width: 9 }, { header: "report_id", width: 10 }, { header: "time", width: 17 }, { header: "user", width: 20 }, { header: "action", width: 70 },
  ], logRows);

  const out = await wb.xlsx.writeBuffer();
  return Buffer.from(out as ArrayBuffer);
}
