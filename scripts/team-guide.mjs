// Builds "MSM Studio - Team Guide.pdf" in D:\Dulmini - Sales. Run: node scripts/team-guide.mjs  (needs worker/node_modules for playwright)
import { writeFileSync, unlinkSync } from "node:fs";
import { createRequire } from "node:module";
const { chromium } = createRequire(new URL("../worker/package.json", import.meta.url))("playwright");

const OUT = "D:/Dulmini - Sales";
const CSS = `
@page{size:A4;margin:16mm 16mm 18mm}
body{font-family:"Segoe UI",system-ui,Arial,sans-serif;color:#1E2733;font-size:11.5px;line-height:1.55;margin:0}
h1{font-size:22px;color:#1F3A5F;margin:0 0 2px}
.sub{color:#6B7A8C;margin-bottom:14px}
h2{font-size:14px;color:#1F3A5F;margin:18px 0 6px;padding-bottom:4px;border-bottom:1px solid #DDE1E7}
ol,ul{margin:4px 0;padding-left:20px}li{margin:4px 0}
table{border-collapse:collapse;width:100%;font-size:11px;margin:6px 0}
th{text-align:left;color:#6B7A8C;font-size:10px;text-transform:uppercase;letter-spacing:.05em;padding:5px 8px;border-bottom:1px solid #DDE1E7}
td{padding:6px 8px;border-bottom:1px solid #EEF0F3;vertical-align:top}
b.k{color:#1F3A5F}
.box{border:1px solid #DDE1E7;border-radius:6px;padding:10px 12px;margin:8px 0;background:#F8F9FB}
.warn{border-color:#E7B416;background:#FBF0C9}
.pb{page-break-before:always}
code{background:#EEF0F3;padding:1px 5px;border-radius:3px;font-family:Consolas,monospace;font-size:11px}
`;

const html = `<!doctype html><html><head><meta charset="utf-8"><title>MSM Studio - Team Guide</title><style>${CSS}</style></head><body>
<h1>MSM Studio - team guide</h1>
<div class="sub">How the MSM report automation works, how to set it up, how to use it, and what to do when something goes wrong. Updated 26 Oct 2026.</div>

<h2>1. What it does</h2>
<p>You type in a new client's details. The system researches the client's online visibility the same way it was done by hand, pauses three times for you to check its choices, and produces the Marketing Strategy Review as a Google Sheet in the MSM Reports folder. About 25 minutes per client, of which you spend about 5.</p>

<div class="box"><b class="k">Two parts:</b><br>
<b>The app</b> at <b>https://msm-app-sigma.vercel.app</b>: where you create reports, make the checkpoint decisions and approve.<br>
<b>MSM Rank Helper</b>, a small Chrome extension on your computer: does the Google searches in your own Chrome, the way a person would. Chrome must be open while a report is being researched. The app's Settings page shows it as "Online" when it is.</div>

<h2>2. Signing in</h2>
<p>Open the app address, type your EKWA email and any 6-digit code (for example 123456). Only people listed on the Users tab of the MSM Database sheet can sign in. To add someone, add a row there with their email and role; it applies within a minute.</p>
<table><tr><th>Role</th><th>Can</th></tr>
<tr><td>Reviewer (Dulmini, Chamika, Lila)</td><td>Create reports, make the checkpoint decisions, approve</td></tr>
<tr><td>Admin (Fathima)</td><td>Everything, plus settings and connections</td></tr></table>
<p>Others can be added later on the Users tab.</p>

<h2>3. One-time setup: MSM Rank Helper in your Chrome (about 5 minutes)</h2>
<ol>
<li>Save <b>MSM Rank Helper.zip</b> to your Documents folder. Right-click it, <b>Extract All</b>. You get a folder called "extension". Keep it where it is; Chrome loads it from there.</li>
<li>In Chrome, type <code>chrome://extensions</code> in the address bar and press Enter.</li>
<li>Top right, switch on <b>Developer mode</b>.</li>
<li>Click <b>Load unpacked</b> and choose the "extension" folder. "MSM Rank Helper" appears in the list.</li>
<li>Its settings page opens by itself. Enter: the app address <code>https://msm-app-sigma.vercel.app</code>, the worker token (Fathima sends it to you on Slack), and a name for your computer. Click <b>Save and start</b>.</li>
<li>A pinned tab "MSM Rank Helper" opens and says "Online, waiting for a report". Leave it open whenever Chrome is open. Setup is done.</li>
</ol>
<p>Check: the app's Settings page, "Rank checks" row, says Online with your computer's name.</p>

<h2>4. Running a report, step by step</h2>
<ol>
<li><b class="k">Check the helper is on.</b> The pinned "MSM Rank Helper" tab says Online. If Chrome was closed, open it; the tab comes back by itself.</li>
<li><b class="k">New report.</b> Fill in the client details from the intake form: name, practice name, phone, email, website, address, vertical (Medical, Dental, Med spa or Legal). Click Start research.</li>
<li><b class="k">Wait about a minute.</b> The system reads the client's website and suggests keywords and cities. The page updates on its own.</li>
<li><b class="k">Checkpoint 1: cities and keywords.</b> The home city comes from the intake address; nearby cities are suggestions. Keep exactly 3 cities (home plus two nearby with 50,000+ people) and exactly 10 keywords. Untick any, or type your own city as "City, ST" or your own keyword and click Add. Click Approve. Nothing is searched until you do.</li>
<li><b class="k">Wait about 20 minutes.</b> A Google tab opens on your computer and does the 30 searches, the AI Mode reads and the listings, with a blue bar at the top showing progress. Do not use that tab; it closes by itself. You can leave the app and come back.</li>
<li><b class="k">Checkpoint 2: competitors.</b> A list of practices that outranked the client, with how often. Open a website if unsure. Tick 2 to 4 and confirm. If a competitor you know is missing, type its name and website in "Add a competitor you know".</li>
<li><b class="k">Checkpoint 3: listings and AI Mode.</b> The client's Google, Bing, Yelp and Yellow Pages listings are shown as read from each site. Facebook and Zocdoc need one tick each to confirm the link. If a platform shows "Not listed" and you know the page, paste its link: the page is opened and read, and its details and rating go into the report. Below, what Google's AI Mode names for each keyword. Confirm.</li>
<li><b class="k">Review.</b> The whole report is shown as it will appear in the Sheet, tab by tab. Edit the bottom line or any finding if the wording needs it.</li>
<li><b class="k">Approve and create Google Sheet.</b> The Sheet is created in MSM Reports, named "Client - Date MSM", and the link appears on the report page. Excel fallback is next to it if ever needed.</li>
</ol>

<h2 class="pb">5. What is in the report</h2>
<p>Example: Ever &amp; Ever Vitality Studio, a med spa in Charlotte.</p>
<table><tr><th>Term</th><th>Meaning</th><th>Example</th></tr>
<tr><td>Keyword</td><td>A service a patient or client would type into Google</td><td>"Botox", "Chemical peel"</td></tr>
<tr><td>City</td><td>Where the searcher is. Home city plus two nearby.</td><td>Charlotte, Concord, Huntersville</td></tr>
<tr><td>Position / rank</td><td>Where the client's website appears on Google's first page for that keyword in that city. 1 to 10, or "Not on P1" if not on page 1.</td><td>Botox in Charlotte: Not on P1</td></tr>
<tr><td>Green / yellow / red</td><td>Position 1 to 3 is green (good), 4 to 10 yellow (needs work), not on page 1 red (poor)</td><td></td></tr>
<tr><td>Top-3 rankings</td><td>How many of the 30 keyword-city pairs are green</td><td>0 / 30</td></tr>
<tr><td>Page-1 rankings</td><td>How many of the 30 appear anywhere on page 1</td><td>0 / 30</td></tr>
<tr><td>Competitor</td><td>A nearby practice with similar services that outranks the client</td><td>M2 Medical Spa, beats client in 18 of 30</td></tr>
<tr><td>Slots lost</td><td>Keyword-city pairs where a chosen competitor ranks above the client</td><td>30</td></tr>
<tr><td>PageSpeed</td><td>Google's score for how fast and well-built a page is, 0 to 100, for the home page and one service page, on mobile and desktop</td><td>Home page mobile: 59</td></tr>
<tr><td>Copyscape / % found</td><td>How much of a page's text also appears on other websites. Over 5% is flagged.</td><td>Products page: 26%</td></tr>
<tr><td>Listings / NAP</td><td>Whether the practice name, address and phone match on Google, Bing, Yelp, Facebook, Yellow Pages and Zocdoc</td><td>Yellow Pages: Not listed</td></tr>
<tr><td>Reviews</td><td>Star rating and number of reviews on Google, Yelp and Facebook, for the client and each competitor</td><td>Google 5.0, 42 reviews</td></tr>
<tr><td>AI Mode</td><td>Whether Google's AI answer names the practice for each keyword, and who it names instead</td><td>Botox: No. Names Carolina Facial Plastics</td></tr>
<tr><td>Bottom line and findings</td><td>A one-line summary and 3 to 5 plain-language findings, each marked Attention, Watch or Strength</td><td>"Zero page-1 visibility, anywhere, for anything."</td></tr>
<tr><td>Not checked / Not run / -</td><td>That part could not be researched (usually Chrome with the helper was closed). Nothing is ever guessed.</td><td></td></tr></table>

<h2>6. If something goes wrong</h2>
<table><tr><th>What you see</th><th>What it means</th><th>What to do</th></tr>
<tr><td>Report stuck at step 3, "Waiting for the rank worker"</td><td>Chrome with the MSM Rank Helper is not open on any computer</td><td>Open Chrome and check the pinned tab says Online. The report continues by itself.</td></tr>
<tr><td>Yellow message: Google is showing a captcha</td><td>Google wants a human tick</td><td>The Google tab comes to the front. Tick the box within 30 minutes; it continues. If nobody ticked it in time, the report says "Rank checks did not run": tick the captcha, then click <b>Run rank checks again</b> on the report page.</td></tr>
<tr><td>Yellow message: Google has blocked this connection (403)</td><td>Too many searches from that address</td><td>Nothing. It retries every 2 minutes for up to 45 minutes. If it fails, wait an hour and click <b>Run rank checks again</b>. Do not click it repeatedly; that makes the block longer.</td></tr>
<tr><td>Red bar: Copyscape stopped</td><td>Copyscape returned an error (credits or key)</td><td>Tell Fathima. Reports continue without Copyscape until it is reset on Settings.</td></tr>
<tr><td>Step 3 shows "not run", steps 6, 7, 10 "Not checked"</td><td>The search part did not finish (Chrome closed, captcha not ticked, Google block)</td><td>Check the pinned tab says Online, then click <b>Run rank checks again</b> on the report page. Keywords, cities, PageSpeed and Copyscape are kept; no credits are spent again.</td></tr>
<tr><td>"The Google Sheet was not created"</td><td>Google sign-in expired</td><td>Use Excel fallback for now and tell Fathima.</td></tr>
<tr><td>Cannot sign in</td><td>Email not on the Users tab</td><td>Add the row on the Users tab of the MSM Database sheet, wait a minute, try again.</td></tr></table>

<h2>7. Day to day with the helper</h2>
<ul>
<li>Keep Chrome open with the pinned "MSM Rank Helper" tab. If Chrome is closed, reports wait at step 3 and continue when Chrome is back. If the tab is closed by accident, it reopens within a minute.</li>
<li>When a report runs, a Google tab opens and the searches happen there, one every 20 to 30 seconds, with a blue bar showing "12 of 46". Do not use that tab. It closes by itself when done.</li>
<li>If Google asks for a captcha, that tab comes to the front. Tick the box; the searches continue.</li>
<li>To stop a run, click <b>Pause</b> on the blue bar or in the pinned tab. Click <b>Resume</b> in the pinned tab to carry on. The report simply waits.</li>
<li>The computer must be on and awake. If it sleeps, the report waits until it wakes.</li>
<li>If two people have the helper installed, whichever computer is free picks up the next report. Nothing to coordinate.</li></ul>

<h2>8. Files and places</h2>
<ul>
<li><b class="k">MSM Reports folder</b> in Drive: one Google Sheet per approved report.</li>
<li><b class="k">MSM Database sheet</b>: https://docs.google.com/spreadsheets/d/17WH1GNuNf5WFU6nrBV74Oq-czl2-sS5soA48KLRocso/edit<br>Tabs: Users (who can sign in), Reports and Report Data (everything approved), Log (who did what), State (the app's own memory, do not edit).</li>
<li><b class="k">Settings page</b> in the app: shows whether every connection is working, and Copyscape credits used.</li></ul>

<div class="box warn"><b class="k">Not built yet:</b> emailed sign-in codes, Slack notifications, and HubSpot. Reports are shared by opening the Sheet link or sending it by hand.</div>
</body></html>`;

const tmp = `${OUT}/MSM Studio - Team Guide.html`;
writeFileSync(tmp, html, "utf8");
const b = await chromium.launch(); const pg = await b.newPage();
await pg.goto("file:///" + tmp); await pg.waitForTimeout(200);
await pg.pdf({ path: `${OUT}/MSM Studio - Team Guide.pdf`, preferCSSPageSize: true, printBackground: true });
await b.close(); unlinkSync(tmp);
console.log("guide ok");
