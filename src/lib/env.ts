/** Reads connection settings from the environment. Values never leave the server. */

function clean(v: string | undefined): string { return (v ?? "").trim().replace(/^['"]|['"]$/g, ""); }

export const env = {
  openaiKey: clean(process.env.OPENAI_API_KEY),
  pagespeedKey: clean(process.env.PAGESPEED_API_KEY),
  copyscapeUser: clean(process.env.COPYSCAPE_USERNAME),
  copyscapeKey: clean(process.env.COPYSCAPE_API_KEY),
  serviceAccountJson: clean(process.env.GOOGLE_SERVICE_ACCOUNT_JSON),
  /** Optional: act as a real Google account instead of the service account, so files can live in My Drive. See scripts/google-oauth.mjs */
  oauthClientId: clean(process.env.GOOGLE_OAUTH_CLIENT_ID),
  oauthClientSecret: clean(process.env.GOOGLE_OAUTH_CLIENT_SECRET),
  oauthRefreshToken: clean(process.env.GOOGLE_OAUTH_REFRESH_TOKEN),
  databaseSheetUrl: clean(process.env.MSM_DATABASE_SHEET_URL),
  reportsFolderId: clean(process.env.MSM_REPORTS_FOLDER_ID),
  slackWebhook: clean(process.env.SLACK_WEBHOOK_URL),
  workerToken: clean(process.env.WORKER_TOKEN),
  /** COPYSCAPE_PAGES: pages checked per report, 1 to 3 (default 3). Set 1 while testing so a report costs one page. */
  copyscapePages: Math.min(3, Math.max(1, Number(clean(process.env.COPYSCAPE_PAGES) || 3) || 3)),
  /** RANK_TEST_MODE=1: the worker does 5 searches (home city, first 5 keywords) and reads 2 AI Mode answers. */
  rankTestMode: clean(process.env.RANK_TEST_MODE) === "1",
  /** Set MSM_DISABLE_LIVE=1 to force sample data even when keys exist (used by automated tests). */
  liveDisabled: clean(process.env.MSM_DISABLE_LIVE) === "1",
};

export const has = {
  openai: () => !env.liveDisabled && env.openaiKey.length > 10,
  pagespeed: () => !env.liveDisabled && env.pagespeedKey.length > 10,
  copyscape: () => !env.liveDisabled && env.copyscapeUser.length > 0 && env.copyscapeKey.length > 5,
  googleUser: () => !env.liveDisabled && env.oauthClientId.length > 10 && env.oauthClientSecret.length > 5 && env.oauthRefreshToken.length > 10,
  google: () => !env.liveDisabled && (env.serviceAccountJson.startsWith("{") || has.googleUser()),
  database: () => has.google() && env.databaseSheetUrl.includes("/spreadsheets/d/"),
  reportsFolder: () => has.google() && env.reportsFolderId.length > 10,
  slack: () => !env.liveDisabled && env.slackWebhook.startsWith("https://hooks.slack.com/"),
  /** The browser worker is enabled when a shared token of at least 16 characters is set. */
  worker: () => !env.liveDisabled && env.workerToken.length >= 16,
};

export function sheetIdFromUrl(url: string): string {
  const m = url.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
  return m ? m[1] : url;
}

/** Fetch with a hard timeout so a slow provider never hangs a step. */
export async function fetchWithTimeout(url: string, init: RequestInit = {}, ms = 20000): Promise<Response> {
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), ms);
  try { return await fetch(url, { ...init, signal: ctl.signal }); }
  finally { clearTimeout(t); }
}
