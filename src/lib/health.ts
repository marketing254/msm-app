import { has, env } from "./env";
import { checkOpenAI } from "./openai";
import { checkPageSpeed } from "./pagespeed";
import { checkCopyscape } from "./copyscape";
import { authMode, checkDatabase, checkReportsFolder, serviceAccountEmail, signedInAs } from "./google";
import { workerOnline } from "./worker";
import { ensureLoaded } from "./store";

export interface Health { name: string; use: string; configured: boolean; ok: boolean; detail: string }

/** Live check of every connection. Called from the Settings page; each check has its own timeout. */
export async function checkAll(): Promise<Health[]> {
  await ensureLoaded();
  const items: Promise<Health>[] = [
    (async () => ({ name: "OpenAI", use: "Keywords, service lines, findings wording", configured: has.openai(), ...(has.openai() ? await checkOpenAI() : { ok: false, detail: "No key" }) }))(),
    (async () => ({ name: "Google PageSpeed", use: "Scores for 2 pages, mobile and desktop", configured: has.pagespeed(), ...(has.pagespeed() ? await checkPageSpeed() : { ok: false, detail: "No key" }) }))(),
    (async () => ({ name: "Copyscape", use: "Content originality for 3 pages", configured: has.copyscape(), ...(has.copyscape() ? await checkCopyscape() : { ok: false, detail: "No username or key" }) }))(),
    (async () => ({ name: "MSM Database (Google Sheet)", use: "Users, reports, data and log", configured: has.database(), ...(has.database() ? await checkDatabase() : { ok: false, detail: has.google() ? "No sheet URL" : "No service account" }) }))(),
    (async () => ({ name: "MSM Reports folder (Drive)", use: "Where each report Sheet is created", configured: has.reportsFolder(), ...(has.reportsFolder() ? await checkReportsFolder() : { ok: false, detail: has.google() ? "No folder id" : "No service account" }) }))(),
    (async () => {
      const w = workerOnline();
      const configured = has.worker();
      const detail = !configured ? "No WORKER_TOKEN set. Rank checks say not run."
        : w.online ? `Online on ${w.machine}, last seen ${w.secondsAgo}s ago`
        : w.secondsAgo == null ? "Token set. Worker has not connected yet; start it on the PC." : `Worker offline, last seen ${Math.round((w.secondsAgo ?? 0) / 60)} min ago`;
      return { name: "Rank checks (browser worker)", use: "30 local searches, competitors, AI Mode", configured, ok: configured && w.online, detail };
    })(),
    (async () => ({ name: "Slack", use: "Posts the Sheet link to the AE", configured: has.slack(), ok: has.slack(), detail: has.slack() ? "Webhook set" : "No webhook" }))(),
  ];
  return Promise.all(items);
}

export function serviceAccount(): string { return has.google() && !has.googleUser() ? serviceAccountEmail() : ""; }
export { authMode, signedInAs };
export function liveDisabled(): boolean { return env.liveDisabled; }
