# MSM Studio

Web app that automates Dulmini's Marketing Strategy Review (MSM) report for EKWA.
Every research step runs live: website check, OpenAI keywords and findings, PageSpeed, Copyscape, and (through the rank worker on a PC) Google rankings, competitors, listings, reviews and AI Mode. On approval the report is created as a Google Sheet in the MSM Reports folder and written to the MSM Database sheet. Nothing is invented: a step without a source says "not run".

## Run it

Requirements: Node.js 20 or newer.

```bash
npm install
npm run build
npm run start        # http://localhost:3000
```

For development with hot reload use `npm run dev` instead of build + start.

## Deploy on Vercel

1. Push this folder to a GitHub repository.
2. In Vercel, click **Add New Project**, import the repository, keep the detected settings (Framework: Next.js, root directory: `/`).
3. Add every variable from `.env.local` under Project, Settings, Environment Variables. Paste the service account JSON as one value (no surrounding quotes needed on Vercel).
4. Deploy. Open `<your-vercel-url>/settings` and check every row says Connected.
5. On the worker PC, set `MSM_APP_URL` in `worker/.env` to the Vercel URL and start the worker.

State survives restarts: every report and worker job is saved to a `State` tab in the MSM Database sheet (created automatically) and reloaded when a server instance starts. Do not edit that tab.

Sign in with any `@ekwa.com` address and any 6-digit code (for example `dulmini@ekwa.com` / `123456`).

## The flow

1. **Sign in** with email and one-time code. Only allow-listed EKWA addresses get in.
2. **Reports** lists every report with its status: Running, Waiting for you, Ready to review, Sent.
3. **New report**: paste the intake details and choose the vertical. Click Start research.
4. **Checkpoint 1**: confirm exactly 3 cities and 10 keywords. Rank checks start only after Approve.
5. **Progress**: the 12 research steps run in the background and the page updates on its own.
6. **Checkpoint 2**: pick 2 to 4 competitors from the evidence-based shortlist.
7. **Checkpoint 3**: confirm the four search-found listing links and spot-check AI Mode.
8. **Review and approve**: every report tab is previewed. Edit the bottom line and findings, then Approve.
9. **Delivery**: on approval the report becomes a Google Sheet in the MSM Reports folder and the rows are written to the MSM Database sheet. The Sheet link shows on the report page and the Reports list. Excel download stays as a fallback. Slack post comes with the webhook.

## Users and roles

| User | Role | Can |
| --- | --- | --- |
| Dulmini Dodawatte | Reviewer | Generate, review and approve reports |
| Lila Stone | AE | Generate when the reviewer is unavailable, receive and approve report links |
| Chamika | Viewer | Open and search all reports, read only |

On the New report page, **Fill with the test client** loads Ever & Ever Vitality Studio, the real practice from the August 2026 report, for comparison testing. No other data is built in.

## What is live and what is sample

| Part | Status |
| --- | --- |
| Sign-in allow-list | Users tab of the MSM Database sheet when connected, built-in list otherwise |
| Step 1 website check | Live: fetches the site, detects WordPress, finds service pages. OpenAI lists service lines and suggests keywords |
| Step 4 PageSpeed | Live with the PageSpeed key. "Not run" if the API fails |
| Step 5 Copyscape | Live with the Copyscape API. "Not run" if credits or key fail |
| Step 11 findings | Live: OpenAI writes the bottom line and findings from the numbers |
| Step 3 rank checks, step 8 competitor shortlist, step 9 competitor positions, step 10 AI Mode | Live when the rank worker is running on a PC (see `worker/README.md`). The app hands step 3 to the worker and waits; positions, the domains that outrank the client and the AI Mode text come back. OpenAI reads the AI Mode text. Without the worker the step says "not run" and the cells show "-" |
| Steps 6 and 7 (listings and reviews) | Live with the worker: it opens Google, Bing, Yelp, Yellow Pages, and finds Facebook and Zocdoc through Google; OpenAI reads each page for name, address, phone, rating and review count. Step 9 reads Google reviews for the chosen competitors the same way |
| Approval | Live: Google Sheet created in the MSM Reports folder (Drive converts the generated Excel), rows written to Reports, Report Data and Log |
| Excel download | Live, generated from the report data |
| Slack post | Only when SLACK_WEBHOOK_URL is set (not built yet) |

The Reports list starts empty. Reports are saved to the State tab of the MSM Database sheet as they progress, so a restart or a new server instance does not lose them.

Set `MSM_DISABLE_LIVE=1` to switch every connection off (used by the automated test so no credits are spent); every step then reports "not run".

## Rank worker

Rank checks need a real browser, so they run on an office PC, not on the server. Set `WORKER_TOKEN` (any string of 16+ characters) in `.env.local` and in `worker/.env`, then follow `worker/README.md`. Settings shows the worker as Online while it runs. If Google shows a captcha, the report page says so; tick it in the worker's browser window and the searches continue.

For testing, set `RANK_TEST_MODE=1` in `.env.local`: the worker does 5 searches (home city, first 5 keywords) and 2 AI Mode reads. Everything not searched shows as "-" in the report. Remove it for real reports.

## Google account instead of the service account

The service account can create files only in a Shared Drive. If the MSM Reports folder is in someone's My Drive, Settings shows the folder row as an error and approval logs "Drive refused". Two ways out:

1. Move the folder to a Shared Drive (Google Workspace) and add the service account as Content manager. Nothing else changes.
2. Or let the app act as a real Google account: run `node scripts/google-oauth.mjs <client id> <client secret>` once (the script explains where the client id comes from), sign in with the account that owns the folder, and paste the three printed lines into `.env.local`. Report Sheets are then created by that account. Settings shows "signed in as <email>".

If the OAuth consent screen is left in "Testing" status, Google expires the sign-in after 7 days; set it to "In production" (no verification is needed for the team's own use) or use a Workspace "Internal" app.

## Copyscape spending guard

Copyscape is the only connection that costs credits (about 5 cents a page, 3 pages a report). The guard in `src/lib/guard.ts` enforces:

- One call per page, never retried. A failed page is reported as "Not run" with the reason.
- Pages already checked are cached for 30 days and reused free, so re-running the same client costs nothing.
- A daily cap, default 30 pages (10 reports). Change with `COPYSCAPE_DAILY_LIMIT`.
- Pages per report, default 3. Set `COPYSCAPE_PAGES=1` while testing so each client costs one page.
- The first error (bad key, no credits, request failure) pauses Copyscape for every report until an admin clicks Reset on Settings. A red alert shows at the top of every page.
- `MSM_DISABLE_COPYSCAPE=1` switches Copyscape off entirely for team testing; every other connection stays live.

Settings shows credits used today, the balance, and the pause status.

## Where things are

```
src/proxy.ts                     auth guard for every route
src/app/actions.ts               server actions: sign in, create report, checkpoints, approve
src/lib/store.ts                 report store, research pipeline (advance), approval
src/lib/env.ts                   connection settings from the environment
src/lib/google.ts                Sheets + Drive: users, database rows, report Sheet creation
src/lib/openai.ts                keywords, service lines, findings wording
src/lib/pagespeed.ts             PageSpeed API
src/lib/copyscape.ts             Copyscape API
src/lib/site.ts                  website fetch, WordPress check, service pages
src/lib/health.ts                live connection checks for Settings
src/lib/persist.ts               saves reports and jobs to the State tab, reloads on start
src/lib/guard.ts                 Copyscape spending guard and alerts
src/lib/worker.ts                rank jobs, ingest of worker results
src/app/api/worker/...           endpoints the rank worker calls (token auth)
worker/                          the rank worker program for a PC
src/lib/data.ts                  sample reports and builders
src/lib/types.ts                 data model
src/app/(app)/reports/...        screens
src/lib/excel.ts                 Excel report generator (6 tabs from report data)
src/lib/dbExport.ts              database snapshot in MSM Database layout
src/app/api/reports/[id]/excel   Excel download
src/app/api/database             database snapshot download
src/app/globals.css              design system
data/msm-template.xlsx           reference workbook layout
```

## Next steps

2. Slack post of the Sheet link to the assigned AE (webhook), with AE approval recorded.
3. Real email codes at sign-in (Gmail SMTP from an EKWA address).

## Version

0.2.0, 23 Sep 2026: live research through the rank worker, Google Sheet output, state saved to the MSM Database sheet, Copyscape guard. Ready for the first real-client test.
