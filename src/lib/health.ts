import { has, env } from "./env";
import { checkOpenAI } from "./openai";
import { checkPageSpeed } from "./pagespeed";
import { checkCopyscape } from "./copyscape";
import { authMode, checkDatabase, checkReportsFolder, serviceAccountEmail, signedInAs } from "./google";
import { workerOnline } from "./worker";
import { ensureLoaded } from "./store";

export interface Health { name: string; use: string; configured: boolean; ok: boolean; detail: string }

declare global { var __msmHealth: { at: number; items: Health[] } | undefined }
const HEALTH_TTL_MS = 10 * 60_000;

/** When the external checks were last run, for the Settings note. Null when never on this instance. */
export function checkedAt(): number | null { return globalThis.__msmHealth?.at ?? null; }
/** Minutes since the external checks last ran on this instance (0 when just now). */
export function checkedMinutesAgo(): number { const at = checkedAt(); return at ? Math.round((Date.now() - at) / 60000) : 0; }

/**
 * Checks every connection. The external calls (OpenAI, PageSpeed, Copyscape, Google) are slow and count against
 * quotas, so their results are kept for 10 minutes; the worker row is always current. `force` runs them again.
 */
export async function checkAll(force = false): Promise<Health[]> {
  await ensureLoaded();
  const workerRow = (): Health => {
    const w = workerOnline();
    const configured = has.worker();
    const detail = !configured ? "No WORKER_TOKEN set. Rank checks say not run."
      : w.online ? `Online on ${w.machine}, last seen ${w.secondsAgo}s ago`
      : w.secondsAgo == null ? "Token set. Worker has not connected yet; start it on the PC." : `Worker offline, last seen ${Math.round((w.secondsAgo ?? 0) / 60)} min ago`;
    return { name: "Rank checks (browser worker)", use: "30 local searches, competitors, AI Mode", configured, ok: configured && w.online, detail };
  };
  const cached = globalThis.__msmHealth;
  if (!force && cached && Date.now() - cached.at < HEALTH_TTL_MS) return cached.items.map((h) => (h.name.startsWith("Rank checks") ? workerRow() : h));

  const items: Promise<Health>[] = [
    (async () => ({ name: "OpenAI", use: "Keywords, service lines, findings wording", configured: has.openai(), ...(has.openai() ? await checkOpenAI() : { ok: false, detail: "No key" }) }))(),
    (async () => ({ name: "Google PageSpeed", use: "Scores for 2 pages, mobile and desktop", configured: has.pagespeed(), ...(has.pagespeed() ? await checkPageSpeed() : { ok: false, detail: "No key" }) }))(),
    (async () => ({ name: "Copyscape", use: "Content originality for 3 pages", configured: has.copyscape(), ...(has.copyscape() ? await checkCopyscape() : { ok: false, detail: "No username or key" }) }))(),
    (async () => ({ name: "MSM Database (Google Sheet)", use: "Users, reports, data and log", configured: has.database(), ...(has.database() ? await checkDatabase() : { ok: false, detail: has.google() ? "No sheet URL" : "No service account" }) }))(),
    (async () => ({ name: "MSM Reports folder (Drive)", use: "Where each report Sheet is created", configured: has.reportsFolder(), ...(has.reportsFolder() ? await checkReportsFolder() : { ok: false, detail: has.google() ? "No folder id" : "No service account" }) }))(),
    (async () => workerRow())(),
    (async () => ({ name: "Slack", use: "Posts the Sheet link to the AE", configured: has.slack(), ok: has.slack(), detail: has.slack() ? "Webhook set" : "No webhook" }))(),
  ];
  const result = await Promise.all(items);
  globalThis.__msmHealth = { at: Date.now(), items: result };
  return result;
}

export function serviceAccount(): string { return has.google() && !has.googleUser() ? serviceAccountEmail() : ""; }
export { authMode, signedInAs };
export function liveDisabled(): boolean { return env.liveDisabled; }
