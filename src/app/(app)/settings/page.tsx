import type { Metadata } from "next";
import { ALLOWED_USERS, ROLE_DESCRIPTION } from "@/lib/auth";
import { DRIVE_FOLDER } from "@/lib/data";

export const metadata: Metadata = { title: "Settings" };

const RESEARCH_SOURCES = [
  { name: "Rank-check API", use: "30 local searches, competitor positions" },
  { name: "Google PageSpeed", use: "Scores for 2 pages, mobile and desktop" },
  { name: "Copyscape", use: "Content originality for 3 pages" },
  { name: "Google Places", use: "Google listing and reviews" },
  { name: "Yelp Fusion", use: "Yelp listing and reviews" },
  { name: "Browser run", use: "Google AI Mode, Facebook, Bing, Yellow Pages, Zocdoc" },
];

const DELIVERY = [
  { name: "Google Sheets + Drive", use: `Creates the report as a Sheet in ${DRIVE_FOLDER}`, status: "todo", label: "Not connected yet" },
  { name: "Slack", use: "Sends the Sheet link to the assigned AE", status: "todo", label: "Not connected yet" },
  { name: "Email", use: "Sends the Sheet link to the assigned AE", status: "todo", label: "Not connected yet" },
  { name: "HubSpot CRM", use: "Writes the link and date to the MSM Report Link property on the client record", status: "waiting", label: "Feasible, being tested" },
  { name: "Database (Postgres)", use: "Stores every report, its data and the approval log", status: "todo", label: "Not connected yet" },
];

export default function SettingsPage() {
  return (
    <>
      <div className="topbar">
        <h1 className="h1">Settings<small>Who can sign in, where reports go, and where the data comes from</small></h1>
      </div>

      <div className="card">
        <h3>Users <span className="note">allow-list, EKWA addresses only</span></h3>
        <div className="table-wrap">
          <table>
            <thead><tr><th>Name</th><th>Email</th><th>Team</th><th>Role</th><th>Can</th></tr></thead>
            <tbody>
              {ALLOWED_USERS.map((u) => (
                <tr key={u.email}>
                  <td><b>{u.name}</b></td><td>{u.email}</td><td>{u.team}</td>
                  <td><span className={`pill ${u.role === "Admin" ? "sent" : u.role === "Reviewer" ? "running" : u.role === "AE" ? "waiting" : "todo"}`}>{u.role}</span></td>
                  <td className="dim">{ROLE_DESCRIPTION[u.role]}</td>
                </tr>
              ))}
              <tr><td colSpan={5}><button className="btn quiet sm" type="button" disabled>+ Add user</button> <span className="note">Admin only. Enabled when sign-in moves to Supabase.</span></td></tr>
            </tbody>
          </table>
        </div>
      </div>

      <div className="row">
        <div className="card grow">
          <h3>Report delivery</h3>
          <div className="table-wrap">
            <table>
              <thead><tr><th>Connection</th><th>Used for</th><th>Status</th></tr></thead>
              <tbody>
                {DELIVERY.map((s) => <tr key={s.name}><td>{s.name}</td><td className="dim">{s.use}</td><td><span className={`pill ${s.status}`}>{s.label}</span></td></tr>)}
              </tbody>
            </table>
          </div>
          <p className="note" style={{ marginTop: 8 }}>Output format is a Google Sheet. Excel download stays available as a fallback.</p>
        </div>
        <div className="card grow">
          <h3>Research data sources</h3>
          <div className="table-wrap">
            <table>
              <thead><tr><th>Source</th><th>Used for</th><th>Status</th></tr></thead>
              <tbody>
                {RESEARCH_SOURCES.map((s) => <tr key={s.name}><td>{s.name}</td><td className="dim">{s.use}</td><td><span className="pill todo">Not connected yet</span></td></tr>)}
              </tbody>
            </table>
          </div>
          <p className="note" style={{ marginTop: 8 }}>Keys are stored server-side only and never shown after saving.</p>
        </div>
      </div>

      <div className="row">
        <div className="card grow">
          <h3>Report repository</h3>
          <div className="kv">
            <div><b>Database</b>Every report, its research data, checkpoints and approval log. Searchable from the Reports page.</div>
            <div><b>Drive folder</b>{DRIVE_FOLDER}, one folder per client, one Sheet per report.</div>
            <div><b>Naming</b>&lt;Client&gt; - &lt;Date&gt; MSM</div>
            <div><b>Who can open</b>Everyone on the allow-list. Viewers and AEs are read only.</div>
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
