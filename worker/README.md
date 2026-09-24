# MSM rank worker

Runs the Google rank checks and AI Mode reads for MSM Studio in a real browser on an office PC. Free, no search service involved.

## One-time setup on the PC

1. Install Node.js 20 or newer (nodejs.org) and make sure Google Chrome is installed.
2. Copy this `worker` folder to the PC (or clone the whole repo).
3. Copy `.env.example` to `.env` and fill in the two values: the app's Vercel URL and the shared WORKER_TOKEN.

## Run it

Double-click **Start MSM Worker.bat**. The first run installs what it needs (about a minute). Leave the window open; close it or press Ctrl+C to stop.

Or from a terminal in the folder: `npm install`, `npm run setup` once, then `npm start`.

### Run it in the background with no window (recommended)

Double-click **Start MSM Worker (hidden).vbs** instead. Nothing appears on screen; the worker runs in the background and writes to `worker.log` in this folder. To have it start whenever the PC is switched on: press Win+R, type `shell:startup`, Enter, and put a shortcut to the .vbs file in the folder that opens.

To stop it, double-click **Stop MSM Worker.bat**.

A Chrome window opens when a job arrives and closes when it is done. The app's Settings page shows "Online on <PC name>" while the worker runs.

## What it does per report

- 10 keywords x 3 cities = 30 Google searches, typed the way a person would (keyword, city, state), 15 to 20 seconds apart.
- 10 AI Mode reads for the home city.
- The client's listing on Google, Bing, Yelp, Yellow Pages, plus Facebook and Zocdoc through a Google site search: 6 more page loads.
- After checkpoint 2, one Google search per chosen competitor for its rating and review count.
- Posts progress after every search so the report page shows "Search 12 of 30".
- If Google shows a captcha, the report page tells you. Tick the box in the browser window and it continues.

About 12 minutes per report, with a 30-second rest after every 10 searches. In test mode (RANK_TEST_MODE=1 on the app) it is 5 searches and 2 AI Mode reads, about 2 minutes. Nothing about the client is stored on the PC.

The browser is the Google Chrome installed on the PC, started with its normal security settings and no extra switches.

## If something goes wrong

- "App not reachable": check MSM_APP_URL and that the app is running.
- "HTTP 401": the token does not match the app's WORKER_TOKEN.
- Google "403 ... does not have permission": the office address is blocked for a while after too many searches. The worker waits and retries every 2 minutes for up to 45 minutes; the report page shows the message. If it lasts longer, stop the worker, delete the `profile` folder, wait an hour and start the report again.
- A job marked failed: the report shows "-" for every position and says "not run" on step 3. Fix the cause and start the report again.
