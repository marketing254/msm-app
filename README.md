# MSM Studio

Web app that automates Dulmini's Marketing Strategy Review (MSM) report for EKWA.
This version shows the full flow with sample data. No external data source is connected yet.

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
3. Deploy. No environment variables are needed for this version.

State is in memory, so each Vercel deployment and each cold start begins from the same six sample reports. That is expected until the database is connected.

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
9. **Delivery**: on approval the report becomes a Google Sheet in Shared drives / Sales / MSM Reports, the link is sent to the assigned AE by Slack and/or email for their approval, and the link is written to the client's HubSpot record. Excel download stays as a fallback.

## Users and roles

| User | Role | Can |
| --- | --- | --- |
| Dulmini Dodawatte | Reviewer | Generate, review and approve reports |
| Lila Stone | AE | Generate when the reviewer is unavailable, receive and approve report links |
| Chamika | Viewer | Open and search all reports, read only |
| Naren | Admin | Manage users and connections |

## What is real and what is sample

| Part | Status |
| --- | --- |
| Screens, navigation, checkpoints, approval log | Real |
| Sign-in guard (proxy + httpOnly cookie) | Real, mock identity. Swap for Supabase Auth |
| Research steps | Simulated: one step every 2.5 seconds |
| Rankings, PageSpeed, Copyscape, listings, reviews | Sample data from the August 2026 Ever & Ever report and generated values |
| Google Sheet, Slack/email notification, AE approval, HubSpot link | Shown on screen only. Nothing is sent or written yet |
| Excel fallback download | Serves the master-format workbook from `data/msm-template.xlsx` named for the client |
| Search and filters on Reports | UI only, connected with the database |

State lives in memory and resets when the server restarts.

## Where things are

```
src/proxy.ts                     auth guard for every route
src/app/actions.ts               server actions: sign in, create report, checkpoints, approve
src/lib/store.ts                 in-memory store + step simulation (becomes the database layer)
src/lib/data.ts                  sample reports and builders
src/lib/types.ts                 data model
src/app/(app)/reports/...        screens
src/app/api/reports/[id]/excel   Excel download
src/app/globals.css              design system
data/msm-template.xlsx           master workbook layout
```

## Next steps to make it live

1. Replace `lib/auth.ts` with Supabase Auth (email OTP) and the allow-list table.
2. Replace `lib/store.ts` with Postgres tables: reports, steps, listings, competitors, findings, audit log.
3. Implement each research step as a background job: rank-check API, PageSpeed API, Copyscape API, Google Places, Yelp Fusion, browser run for AI Mode and the other listings.
4. Google Sheets + Drive: create the Sheet from the report data in the MSM Reports folder (service account). Fill `data/msm-template.xlsx` for the Excel fallback.
5. Slack and email notification to the assigned AE, with an approve link.
6. HubSpot: write the Sheet link and date to the MSM Report Link property on the matching company record (private app token). Being tested.
