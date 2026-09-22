// One-time helper: sign in with a Google account so the app can create report Sheets in that account's Drive.
// Use this when the MSM Reports folder is in My Drive (no Shared Drive available).
//
// 1. In Google Cloud (same project as the other keys): APIs & Services > Credentials > Create credentials > OAuth client ID.
//    Application type: Desktop app. Copy the client ID and client secret.
//    Under "OAuth consent screen", add the Google account you will sign in with as a test user, or publish the app.
// 2. Run:   node scripts/google-oauth.mjs <client id> <client secret>
// 3. A browser opens. Sign in with the account that owns the MSM Reports folder and allow Drive and Sheets access.
// 4. Paste the three lines it prints into .env.local (and into Vercel's environment variables).

import http from "node:http";
import { exec } from "node:child_process";

const [clientId, clientSecret] = process.argv.slice(2);
if (!clientId || !clientSecret) { console.error("Usage: node scripts/google-oauth.mjs <client id> <client secret>"); process.exit(1); }

const PORT = 53682;
const redirect = `http://127.0.0.1:${PORT}/`;
const scopes = ["https://www.googleapis.com/auth/drive", "https://www.googleapis.com/auth/spreadsheets", "https://www.googleapis.com/auth/userinfo.email"];
const url = "https://accounts.google.com/o/oauth2/v2/auth?" + new URLSearchParams({
  client_id: clientId, redirect_uri: redirect, response_type: "code", access_type: "offline", prompt: "consent", scope: scopes.join(" "),
});

const server = http.createServer(async (req, res) => {
  const code = new URL(req.url, redirect).searchParams.get("code");
  if (!code) { res.end("No code in the request. Close this tab and try again."); return; }
  const tok = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ code, client_id: clientId, client_secret: clientSecret, redirect_uri: redirect, grant_type: "authorization_code" }),
  }).then((r) => r.json());
  if (!tok.refresh_token) { res.end("Google did not return a refresh token. Remove the app's access at myaccount.google.com/permissions and run this again."); console.error(tok); server.close(); return; }
  res.end("Done. You can close this tab and go back to the terminal.");
  console.log("\nAdd these lines to .env.local:\n");
  console.log(`GOOGLE_OAUTH_CLIENT_ID=${clientId}`);
  console.log(`GOOGLE_OAUTH_CLIENT_SECRET=${clientSecret}`);
  console.log(`GOOGLE_OAUTH_REFRESH_TOKEN=${tok.refresh_token}\n`);
  console.log("Keep GOOGLE_SERVICE_ACCOUNT_JSON as well if you like; the account sign-in takes priority.");
  server.close();
});
server.listen(PORT, () => {
  console.log("Opening the Google sign-in page. If it does not open, copy this whole line into a browser:\n\n" + url + "\n");
  // Quoted argument: & inside the quotes needs no escaping.
  const cmd = process.platform === "win32" ? `start "" "${url}"` : process.platform === "darwin" ? `open "${url}"` : `xdg-open "${url}"`;
  exec(cmd);
});
