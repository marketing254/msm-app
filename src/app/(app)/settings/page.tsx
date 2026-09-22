import type { Metadata } from "next";
import { allowedUsers, ROLE_DESCRIPTION } from "@/lib/auth";
import { DRIVE_FOLDER } from "@/lib/data";
import { authMode, checkAll, liveDisabled, serviceAccount, signedInAs } from "@/lib/health";
import { guard } from "@/lib/guard";
import { env } from "@/lib/env";
import { resetCopyscape } from "@/app/actions";

export const metadata: Metadata = { title: "Settings" };
export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const [{ users, source }, health] = await Promise.all([allowedUsers(), checkAll()]);
  const sa = serviceAccount();
  const userEmail = authMode() === "user" ? await signedInAs() : "";
  const cs = guard.copyscape.status();

  return (
    <>
      <div className="topbar">
        <h1 className="h1">Settings<small>Who can sign in, and whether each connection is working right now</small></h1>
      </div>

      {liveDisabled() && <div className="banner waiting">Live connections are switched off (MSM_DISABLE_LIVE=1). Every step reports &ldquo;not run&rdquo;.</div>}

      <div className="card">
        <h3>Connections <span className="note">checked live when this page opens</span></h3>
        <div className="table-wrap">
          <table>
            <thead><tr><th>Connection</th><th>Used for</th><th>Status</th><th>Detail</th></tr></thead>
            <tbody>
              {health.map((h) => (
                <tr key={h.name}>
                  <td><b>{h.name}</b></td>
                  <td className="dim">{h.use}</td>
                  <td>{h.ok ? <span className="pill done">Connected</span> : h.configured ? <span className="pill flag">Error</span> : <span className="pill todo">Not connected</span>}</td>
                  <td className="dim">{h.detail}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="card" style={{ marginTop: 12, background: cs.paused ? "var(--red-100)" : "var(--bg)" }}>
          <h3>Copyscape spending guard</h3>
          <div className="kv">
            <div><b>Cost</b>About 5 cents a page, {env.copyscapePages} page{env.copyscapePages === 1 ? "" : "s"} a report (COPYSCAPE_PAGES). One call per page, never retried.</div>
            <div><b>Used today</b>{cs.usedToday} of {cs.limit} pages {cs.cached ? `(${cs.cached} pages cached, reused free for 30 days)` : ""}</div>
            <div><b>Status</b>{cs.switchedOff ? <span className="pill todo">Switched off for testing (MSM_DISABLE_COPYSCAPE=1)</span> : cs.paused ? <span className="pill flag">Paused since {cs.pausedAt}: {cs.paused}</span> : <span className="pill done">Active</span>}</div>
            {cs.paused && <div><form action={resetCopyscape}><button className="btn quiet sm" type="submit">Reset after fixing the cause</button></form></div>}
          </div>
        </div>
        {sa && <p className="note" style={{ marginTop: 8 }}>Google access: service account <code>{sa}</code>. Share the MSM Reports folder (in a Shared Drive) and the MSM Database sheet with this address as Editor.</p>}
        {userEmail && <p className="note" style={{ marginTop: 8 }}>Google access: signed in as <code>{userEmail}</code>. Report Sheets are created in that account&rsquo;s Drive, in the MSM Reports folder.</p>}
        <p className="note" style={{ marginTop: 4 }}>Keys live in the server environment and are never shown here.</p>
      </div>

      <div className="card">
        <h3>Users <span className="note">{source === "sheet" ? "read from the Users tab of the MSM Database sheet" : "built-in list, sheet not connected"}</span></h3>
        <div className="table-wrap">
          <table>
            <thead><tr><th>Name</th><th>Email</th><th>Team</th><th>Role</th><th>Can</th></tr></thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.email}>
                  <td><b>{u.name}</b></td><td>{u.email}</td><td>{u.team}</td>
                  <td><span className={`pill ${u.role === "Admin" ? "sent" : u.role === "Reviewer" ? "running" : u.role === "AE" ? "waiting" : "todo"}`}>{u.role}</span></td>
                  <td className="dim">{ROLE_DESCRIPTION[u.role] ?? ""}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="note" style={{ marginTop: 8 }}>To add or remove a person, edit the Users tab of the MSM Database sheet. Changes apply within a minute.</p>
      </div>

      <div className="row">
        <div className="card grow">
          <h3>Report repository</h3>
          <div className="kv">
            <div><b>Database</b>Every approved report, its research data and the log are written to the MSM Database sheet.</div>
            <div><b>Snapshot</b><a className="btn quiet sm" href="/api/database">Download database snapshot</a> <span className="note">What the app holds right now, in the same layout.</span></div>
            <div><b>Drive folder</b>{DRIVE_FOLDER}. One Google Sheet per approved report.</div>
            <div><b>Naming</b>&lt;Client&gt; - &lt;Date&gt; MSM</div>
          </div>
        </div>
        <div className="card grow">
          <h3>Report template</h3>
          <div className="kv">
            <div><b>Master layout</b>Ever &amp; Ever Vitality Studio MSM, August 2026</div>
            <div><b>Tabs</b>Summary, Client Basic Information, Practice Name Google Search, Nearby Competition Review, Google AI Overview, Services &amp; Notes</div>
            <div><b>Colour rule</b><span className="rank good">#1-#3</span> Green &nbsp; <span className="rank mid">#4-#10</span> Yellow &nbsp; <span className="rank poor">Not P1</span> Red</div>
            <div><b>Cities</b>Home city + 2 nearby, 50,000+ people, within 20 miles</div>
            <div><b>Competitors</b>2 to 4, within 20 miles, 50%+ service overlap, more Google reviews than the client</div>
          </div>
        </div>
      </div>
    </>
  );
}
