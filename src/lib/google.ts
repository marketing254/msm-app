import { google, type sheets_v4, type drive_v3 } from "googleapis";
import { Readable } from "node:stream";
import { env, has, sheetIdFromUrl } from "./env";
import type { Session } from "./auth";

/**
 * Google Sheets + Drive through the service account.
 * Used for: the MSM Database sheet (users, reports, data, log) and creating report Sheets in the MSM Reports folder.
 */

type AnyAuth = InstanceType<typeof google.auth.GoogleAuth> | InstanceType<typeof google.auth.OAuth2>;
let cachedUser: InstanceType<typeof google.auth.OAuth2> | null = null;
let cachedService: InstanceType<typeof google.auth.GoogleAuth> | null = null;

function hasServiceAccount(): boolean { return !!env.serviceAccountJson; }

/** The service account: never expires. Used for everything on the MSM Database sheet (users, reports, log, State). */
function serviceAuth(): AnyAuth {
  if (!hasServiceAccount()) return userAuth();
  if (!cachedService) {
    cachedService = new google.auth.GoogleAuth({
      credentials: JSON.parse(env.serviceAccountJson),
      scopes: ["https://www.googleapis.com/auth/spreadsheets", "https://www.googleapis.com/auth/drive"],
    });
  }
  return cachedService;
}

/**
 * A real Google account (OAuth refresh token). Only needed to create the report Sheets, because a service account
 * cannot own files in someone's My Drive. Falls back to the service account when no user sign-in is configured.
 */
function userAuth(): AnyAuth {
  if (!has.google()) throw new Error("Google is not configured");
  if (!has.googleUser()) return serviceAuth();
  if (!cachedUser) {
    cachedUser = new google.auth.OAuth2(env.oauthClientId, env.oauthClientSecret);
    cachedUser.setCredentials({ refresh_token: env.oauthRefreshToken });
  }
  return cachedUser;
}

/** Which sign-in creates the report Sheets. The Database sheet always uses the service account when one is set. */
export function authMode(): "user" | "service-account" | "none" {
  return has.googleUser() ? "user" : has.google() ? "service-account" : "none";
}
export function databaseAuthMode(): "user" | "service-account" | "none" {
  return hasServiceAccount() ? "service-account" : authMode();
}

export function serviceAccountEmail(): string {
  try { return JSON.parse(env.serviceAccountJson).client_email ?? ""; } catch { return ""; }
}

/** Email of the Google account in use (OAuth), for the Settings page. */
let signedInCache: { at: number; email: string } | null = null;
export async function signedInAs(): Promise<string> {
  if (!has.googleUser()) return "";
  if (signedInCache && Date.now() - signedInCache.at < 10 * 60_000) return signedInCache.email;
  try {
    const res = await google.oauth2({ version: "v2", auth: userAuth() }).userinfo.get();
    signedInCache = { at: Date.now(), email: res.data.email ?? "" };
    return signedInCache.email;
  } catch { return ""; }
}

/** Database sheet: service account (never expires). */
function sheets(): sheets_v4.Sheets { return google.sheets({ version: "v4", auth: serviceAuth() }); }
/** Report Sheets in the MSM Reports folder: the user sign-in when set. */
function drive(): drive_v3.Drive { return google.drive({ version: "v3", auth: userAuth() }); }

/* ---------------- MSM Database ---------------- */

export interface DbUser extends Session { team: string; active: boolean }

let usersCache: { at: number; users: DbUser[] } | null = null;

/** Users tab: user_id, name, email, role, team, active, added_on, added_by */
export async function readUsers(): Promise<DbUser[]> {
  if (usersCache && Date.now() - usersCache.at < 60_000) return usersCache.users;
  const res = await sheets().spreadsheets.values.get({ spreadsheetId: sheetIdFromUrl(env.databaseSheetUrl), range: "Users!A2:H" });
  const rows = res.data.values ?? [];
  const users: DbUser[] = rows
    .filter((r) => r[2])
    .map((r) => ({ name: String(r[1] ?? ""), email: String(r[2]).trim().toLowerCase(), role: (String(r[3] ?? "Viewer") as Session["role"]), team: String(r[4] ?? ""), active: String(r[5] ?? "Yes").toLowerCase() !== "no" }));
  usersCache = { at: Date.now(), users };
  return users;
}

async function nextId(tab: string, prefix: string, width: number): Promise<number> {
  const res = await sheets().spreadsheets.values.get({ spreadsheetId: sheetIdFromUrl(env.databaseSheetUrl), range: `${tab}!A2:A` });
  const rows = res.data.values ?? [];
  let max = 0;
  for (const r of rows) { const m = String(r[0] ?? "").match(new RegExp(`^${prefix}(\\d+)$`)); if (m) max = Math.max(max, Number(m[1])); }
  void width;
  return max + 1;
}

export async function appendRows(tab: string, rows: (string | number)[][]): Promise<void> {
  if (!rows.length) return;
  await sheets().spreadsheets.values.append({
    spreadsheetId: sheetIdFromUrl(env.databaseSheetUrl), range: `${tab}!A1`, valueInputOption: "USER_ENTERED", insertDataOption: "INSERT_ROWS",
    requestBody: { values: rows },
  });
}

/** Upsert a report row by report_id in the Reports tab. */
export async function upsertReportRow(reportId: string, row: (string | number)[]): Promise<void> {
  const id = sheetIdFromUrl(env.databaseSheetUrl);
  const res = await sheets().spreadsheets.values.get({ spreadsheetId: id, range: "Reports!A2:A" });
  const rows = res.data.values ?? [];
  const idx = rows.findIndex((r) => String(r[0] ?? "") === reportId);
  if (idx >= 0) {
    await sheets().spreadsheets.values.update({ spreadsheetId: id, range: `Reports!A${idx + 2}`, valueInputOption: "USER_ENTERED", requestBody: { values: [row] } });
  } else {
    await appendRows("Reports", [row]);
  }
}

export async function nextLogId(): Promise<string> { return `L${String(await nextId("Log", "L", 4)).padStart(4, "0")}`; }
export async function nextDataId(): Promise<number> { return nextId("Report Data", "D", 4); }

/* ---------------- State tab: reports in progress and worker jobs, so a server restart loses nothing ---------------- */

const STATE_TAB = "State";
const CHUNK = 45000; // a Sheets cell holds 50,000 characters
const STATE_COLS = 12; // A id, B updated, C..L json chunks (up to 450 KB)
let stateRows: Map<string, number> | null = null;
let stateTabChecked = false;

async function ensureStateTab(): Promise<void> {
  if (stateTabChecked) return;
  const id = sheetIdFromUrl(env.databaseSheetUrl);
  const meta = await sheets().spreadsheets.get({ spreadsheetId: id, fields: "sheets.properties.title" });
  const has_ = (meta.data.sheets ?? []).some((s) => s.properties?.title === STATE_TAB);
  if (!has_) {
    await sheets().spreadsheets.batchUpdate({ spreadsheetId: id, requestBody: { requests: [{ addSheet: { properties: { title: STATE_TAB, gridProperties: { frozenRowCount: 1 } } } }] } });
    await sheets().spreadsheets.values.update({ spreadsheetId: id, range: `${STATE_TAB}!A1`, valueInputOption: "RAW", requestBody: { values: [["id", "updated_at", "json (app state, do not edit)"]] } });
  }
  stateTabChecked = true;
}

/** All saved state: id -> { json, at }. `at` is the save stamp in column B. */
export async function stateLoad(): Promise<Record<string, { json: string; at: string }>> {
  await ensureStateTab();
  const res = await sheets().spreadsheets.values.get({ spreadsheetId: sheetIdFromUrl(env.databaseSheetUrl), range: `${STATE_TAB}!A2:L` });
  const rows = res.data.values ?? [];
  stateRows = new Map();
  const out: Record<string, { json: string; at: string }> = {};
  rows.forEach((r, i) => { const id = String(r[0] ?? ""); if (!id) return; stateRows!.set(id, i + 2); out[id] = { json: r.slice(2).map(String).join(""), at: String(r[1] ?? "") }; });
  return out;
}

/** Just the ids and save stamps (columns A and B): cheap enough to poll. */
export async function stateIndex(): Promise<Record<string, string>> {
  await ensureStateTab();
  const res = await sheets().spreadsheets.values.get({ spreadsheetId: sheetIdFromUrl(env.databaseSheetUrl), range: `${STATE_TAB}!A2:B` });
  const rows = res.data.values ?? [];
  stateRows = new Map();
  const out: Record<string, string> = {};
  rows.forEach((r, i) => { const id = String(r[0] ?? ""); if (!id) return; stateRows!.set(id, i + 2); out[id] = String(r[1] ?? ""); });
  return out;
}

/** Full rows for the given ids (after stateIndex). */
export async function stateGet(ids: string[]): Promise<Record<string, { json: string; at: string }>> {
  const out: Record<string, { json: string; at: string }> = {};
  if (!ids.length) return out;
  if (!stateRows) await stateIndex();
  const ranges = ids.map((id) => stateRows!.get(id)).filter((n): n is number => !!n).map((n) => `${STATE_TAB}!A${n}:L${n}`);
  if (!ranges.length) return out;
  const res = await sheets().spreadsheets.values.batchGet({ spreadsheetId: sheetIdFromUrl(env.databaseSheetUrl), ranges });
  for (const vr of res.data.valueRanges ?? []) {
    const r = vr.values?.[0]; if (!r) continue;
    const id = String(r[0] ?? ""); if (!id) continue;
    out[id] = { json: r.slice(2).map(String).join(""), at: String(r[1] ?? "") };
  }
  return out;
}

/** Saves one row and returns the stamp written to column B. */
export async function stateSave(id: string, json: string): Promise<string> {
  await ensureStateTab();
  if (!stateRows) await stateIndex();
  const chunks: string[] = [];
  for (let i = 0; i < json.length; i += CHUNK) chunks.push(json.slice(i, i + CHUNK));
  if (chunks.length > STATE_COLS - 2) throw new Error(`State for ${id} is too large to save (${json.length} chars)`);
  while (chunks.length < STATE_COLS - 2) chunks.push("");
  const at = new Date().toISOString();
  const row = [id, at, ...chunks];
  const sid = sheetIdFromUrl(env.databaseSheetUrl);
  const rowIndex = stateRows!.get(id);
  if (rowIndex) {
    await sheets().spreadsheets.values.update({ spreadsheetId: sid, range: `${STATE_TAB}!A${rowIndex}`, valueInputOption: "RAW", requestBody: { values: [row] } });
  } else {
    const res = await sheets().spreadsheets.values.append({ spreadsheetId: sid, range: `${STATE_TAB}!A1`, valueInputOption: "RAW", insertDataOption: "INSERT_ROWS", requestBody: { values: [row] } });
    const m = res.data.updates?.updatedRange?.match(/!A(\d+)/);
    if (m) stateRows!.set(id, Number(m[1]));
    else stateRows = null; // unknown position: reload the index next time
  }
  return at;
}

/** Deletes the State rows for the given ids (used to remove test reports and their jobs). */
export async function stateDelete(ids: string[]): Promise<number> {
  await ensureStateTab();
  const index = await stateIndex();
  const sid = sheetIdFromUrl(env.databaseSheetUrl);
  const meta = await sheets().spreadsheets.get({ spreadsheetId: sid, fields: "sheets.properties" });
  const sheetId = (meta.data.sheets ?? []).find((s) => s.properties?.title === STATE_TAB)?.properties?.sheetId;
  if (sheetId == null) return 0;
  const rows = ids.filter((id) => id in index).map((id) => stateRows!.get(id)!).filter(Boolean).sort((a, b) => b - a);
  if (!rows.length) return 0;
  // Delete from the bottom up so earlier row numbers stay valid.
  await sheets().spreadsheets.batchUpdate({ spreadsheetId: sid, requestBody: { requests: rows.map((r) => ({ deleteDimension: { range: { sheetId, dimension: "ROWS", startIndex: r - 1, endIndex: r } } })) } });
  stateRows = null;
  return rows.length;
}

/* ---------------- Report Sheet in the MSM Reports folder ---------------- */

/** Uploads an .xlsx and lets Drive convert it to a Google Sheet inside the reports folder. Returns the Sheet URL. */
export async function createReportSheet(name: string, xlsx: Buffer): Promise<{ id: string; url: string }> {
  if (!has.reportsFolder()) throw new Error("MSM Reports folder is not configured");
  const res = await drive().files.create({
    supportsAllDrives: true,
    requestBody: { name, mimeType: "application/vnd.google-apps.spreadsheet", parents: [env.reportsFolderId] },
    media: { mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", body: Readable.from(xlsx) },
    fields: "id, webViewLink",
  });
  const id = res.data.id ?? "";
  return { id, url: res.data.webViewLink ?? `https://docs.google.com/spreadsheets/d/${id}` };
}

/* ---------------- Health checks ---------------- */

export async function checkDatabase(): Promise<{ ok: boolean; detail: string }> {
  try {
    const res = await sheets().spreadsheets.get({ spreadsheetId: sheetIdFromUrl(env.databaseSheetUrl), fields: "properties.title,sheets.properties.title" });
    const tabs = (res.data.sheets ?? []).map((s) => s.properties?.title ?? "");
    const need = ["Users", "Reports", "Report Data", "Log"];
    const missing = need.filter((t) => !tabs.includes(t));
    if (missing.length) return { ok: false, detail: `Sheet "${res.data.properties?.title}" opened but tabs missing: ${missing.join(", ")}` };
    const users = await readUsers();
    return { ok: true, detail: `"${res.data.properties?.title}" with ${users.length} users${databaseAuthMode() === "service-account" ? " (service account, does not expire)" : ""}` };
  } catch (e) {
    return { ok: false, detail: friendly(e, databaseAuthMode()) };
  }
}

export async function checkReportsFolder(): Promise<{ ok: boolean; detail: string }> {
  try {
    const res = await drive().files.get({ fileId: env.reportsFolderId, supportsAllDrives: true, fields: "name, mimeType, capabilities/canAddChildren, driveId" });
    if (res.data.mimeType !== "application/vnd.google-apps.folder") return { ok: false, detail: `"${res.data.name}" is not a folder` };
    if (!res.data.capabilities?.canAddChildren) return { ok: false, detail: `Folder "${res.data.name}" found but this account cannot create files in it. Share it as Editor.` };
    if (!res.data.driveId && authMode() === "service-account") {
      return { ok: false, detail: `Folder "${res.data.name}" is in My Drive. A service account cannot own files there, so Sheet creation will fail. Either move the folder to a Shared Drive, or connect a Google account (README, "Google account instead of service account").` };
    }
    return { ok: true, detail: `Folder "${res.data.name}"${res.data.driveId ? " (shared drive)" : " (My Drive, signed in as a user)"}` };
  } catch (e) {
    return { ok: false, detail: friendly(e) };
  }
}

function friendly(e: unknown, mode: "user" | "service-account" | "none" = authMode()): string {
  const msg = e instanceof Error ? e.message : String(e);
  if (/not found/i.test(msg)) return "Not found or not shared with the service account " + serviceAccountEmail();
  if (/permission|forbidden|403/i.test(msg)) return "No permission. Share it with " + serviceAccountEmail() + " as Editor";
  if (/invalid_grant|unauthorized_client|invalid JWT/i.test(msg)) return mode === "user" ? "Google sign-in expired or revoked. Run scripts/google-oauth.mjs again and update GOOGLE_OAUTH_REFRESH_TOKEN. Reports still save; only new report Sheets cannot be created until then." : "Service account key is not valid";
  if (/storage quota/i.test(msg)) return "Drive refused: a service account cannot own files in My Drive. Use a Shared Drive folder or connect a Google account (README).";
  return msg.slice(0, 200);
}
