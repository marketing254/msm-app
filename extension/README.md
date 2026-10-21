# MSM Rank Helper (Chrome extension)

Does the Google searches for MSM Studio reports inside a person's own Chrome, the way a person would. It replaces the
`worker/` program (kept as a backup). Nothing to install besides Chrome: no Node, no Playwright, no scripts.

## Install (once, about 3 minutes)

1. Copy this `extension` folder to the PC, for example to `Documents\MSM Rank Helper`. Keep it there; Chrome loads it from this folder.
2. In Chrome open `chrome://extensions`. Turn on **Developer mode** (top right).
3. Click **Load unpacked** and choose the folder. "MSM Rank Helper" appears in the list.
4. Its settings page opens by itself. Enter the MSM Studio address, the worker token (same as `WORKER_TOKEN` on Vercel) and a name for this computer. Click **Save and start**.
5. A pinned tab "MSM Rank Helper" opens and says "Online, waiting for a report". Leave it open. MSM Studio's Settings page shows the worker as Online with the name you typed.

Optional: click the puzzle-piece icon in Chrome's toolbar and pin MSM Rank Helper, so its status is one click away.

## Every day

- Keep Chrome open with the pinned tab. If Chrome is closed, nothing runs; reports wait at step 3 and continue when Chrome is back.
- When a report reaches its rank checks, a Google tab opens and the searches happen there, one every 20 to 30 seconds. Do not use that tab. It closes when the job is done.
- If Google asks for a captcha, the tab comes to the front. Tick the box; the searches continue.
- The pinned tab has a Pause button for when the laptop is needed for something else.

## Update

Replace the files in the folder with the new ones, then on `chrome://extensions` click the reload arrow on MSM Rank Helper.

## Why this instead of the worker program

The worker drove Chrome through an automation link, which Google can detect; after a day or two of use almost every search got a captcha. An extension in the person's normal Chrome has no such link, so Google sees ordinary searching. Captchas should be as rare as they are for a person doing the same searches by hand.
