import Link from "next/link";
import type { Metadata } from "next";
import { listReports, reportHref } from "@/lib/store";
import { StatusPill, Tile, formatDate } from "@/components/ui";
import { AutoRefresh } from "@/components/AutoRefresh";

export const metadata: Metadata = { title: "Reports" };
export const dynamic = "force-dynamic";

export default function ReportsPage() {
  const reports = listReports();
  const count = (s: string) => reports.filter((r) => r.status === s).length;
  const monthStart = new Date(); monthStart.setDate(1); monthStart.setHours(0, 0, 0, 0);
  const sentThisMonth = reports.filter((r) => r.status === "sent" && new Date(r.approvedAt ?? r.startedAt) >= monthStart).length;
  const anyRunning = reports.some((r) => r.status === "running");
  const aes = Array.from(new Set(reports.map((r) => r.ae)));

  return (
    <>
      {anyRunning && <AutoRefresh seconds={3} />}
      <div className="topbar">
        <h1 className="h1">Reports<small>Every MSM report in one place. AEs can search and open any completed report here.</small></h1>
        <Link href="/reports/new" className="btn primary">+ New report</Link>
      </div>
      <div className="tiles">
        <Tile value={count("waiting")} label="Waiting for you" />
        <Tile value={count("running")} label="Running" />
        <Tile value={count("ready")} label="Ready to review" />
        <Tile value={sentThisMonth} label="Sent this month" />
      </div>
      <div className="card">
        <div className="filters">
          <input className="input" placeholder="Search by client, city or website" aria-label="Search reports" />
          <select className="select" aria-label="Status" defaultValue=""><option value="">All statuses</option><option>Waiting for you</option><option>Running</option><option>Ready to review</option><option>Sent</option></select>
          <select className="select" aria-label="Vertical" defaultValue=""><option value="">All verticals</option><option>Medical</option><option>Dental</option><option>Med spa</option><option>Legal</option></select>
          <select className="select" aria-label="AE" defaultValue=""><option value="">All AEs</option>{aes.map((a) => <option key={a}>{a}</option>)}</select>
          <span className="note">Search and filters connect with the database.</span>
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr><th>Client</th><th>Vertical</th><th>City</th><th>AE</th><th>Started</th><th>Status</th><th>Next step</th><th></th></tr>
            </thead>
            <tbody>
              {reports.map((r) => {
                const home = r.cities.find((c) => c.home) ?? r.cities[0];
                const href = reportHref(r);
                const primary = r.status === "waiting" || r.status === "ready";
                return (
                  <tr key={r.id} className="clickable">
                    <td><Link href={href}><b>{r.intake.company}</b></Link></td>
                    <td>{r.intake.vertical}</td>
                    <td>{home.name}, {home.state}</td>
                    <td>{r.ae}</td>
                    <td className="dim">{formatDate(r.startedAt)}</td>
                    <td><StatusPill status={r.status} /></td>
                    <td>{r.nextStepLabel}</td>
                    <td style={{ textAlign: "right", whiteSpace: "nowrap" }}>
                      {r.status === "sent"
                        ? <a className="btn sm" href={r.delivery.sheetUrl ?? "#"} title="Opens when Google Sheets is connected">Open Sheet</a>
                        : <Link className={`btn sm${primary ? "" : " quiet"}`} href={href}>{primary ? "Open" : "View"}</Link>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <p className="note" style={{ marginTop: 10 }}>Completed reports are also filed as Google Sheets in Shared drives / Sales / MSM Reports, one folder per client.</p>
      </div>
    </>
  );
}
