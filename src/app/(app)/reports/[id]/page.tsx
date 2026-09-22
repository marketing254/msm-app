// Vercel: allow up to 60 s for live research calls (PageSpeed, Copyscape, Sheet creation).
export const maxDuration = 60;

import Link from "next/link";
import { notFound } from "next/navigation";
import { getReport, reportHref, reportJob } from "@/lib/store";
import { CHECKPOINTS } from "@/lib/data";
import { ReportHeader, StatusPill, formatDate } from "@/components/ui";
import { AutoRefresh } from "@/components/AutoRefresh";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return { title: (await getReport(id))?.intake.company ?? "Report" };
}

export default async function ReportPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ approved?: string }> }) {
  const { id } = await params;
  const { approved } = await searchParams;
  const r = await getReport(id);
  if (!r) notFound();

  const done = r.steps.filter((s) => s.state === "done").length;
  const pct = Math.round((done / 12) * 100);
  const home = r.cities.find((c) => c.home) ?? r.cities[0];
  const cp = CHECKPOINTS[r.currentStep];
  const href = reportHref(r);
  const job = reportJob(r);

  return (
    <>
      {r.status === "running" && <AutoRefresh seconds={2} advanceUrl={`/api/reports/${r.id}/advance`} />}
      <ReportHeader report={r} subtitle={`Started ${formatDate(r.startedAt).replace(/^(Today|Yesterday)/, (m) => m.toLowerCase())} · ${r.intake.vertical} · ${home.name}, ${home.state}`} />

      {r.status === "sent" && (
        <div className="banner ready">
          {r.delivery.sheetUrl && r.delivery.sheetUrl !== "#"
            ? (approved ? `Approved. Google Sheet created in ${r.delivery.driveFolder}. Assigned to ${r.delivery.sentTo}.` : `Approved by ${r.approvedBy} on ${formatDate(r.approvedAt ?? r.startedAt)}. Assigned to ${r.delivery.sentTo}.`)
            : `Approved by ${r.approvedBy ?? "reviewer"}. The Google Sheet was not created; see the log. Excel fallback is available.`}
          {r.delivery.sheetUrl && r.delivery.sheetUrl !== "#"
            ? <a className="btn success" href={r.delivery.sheetUrl} target="_blank" rel="noreferrer">Open Google Sheet</a>
            : <span className="btn quiet" title="Drive folder not connected or the Sheet could not be created" style={{ opacity: 0.6, cursor: "default" }}>No Google Sheet</span>}
          <a className="btn quiet" href={`/api/reports/${r.id}/excel`} style={{ marginLeft: 0 }}>Excel fallback</a>
        </div>
      )}
      {r.status === "ready" && (
        <div className="banner ready">Research is complete. Review every tab before it goes to the client.<Link className="btn success" href={href}>Review and approve</Link></div>
      )}
      {r.status === "waiting" && cp && (
        <div className="banner waiting">
          Step {r.currentStep} is waiting for you: {r.nextStepLabel.replace(/^Checkpoint \d: /, "")}.
          <Link className="btn primary" href={href}>Open checkpoint {cp}</Link>
        </div>
      )}
      {r.status === "running" && job && job.status === "captcha" && (
        <div className="banner waiting">Google is showing a captcha on the worker PC. Open the worker&rsquo;s browser window, tick the box, and the searches continue on their own.</div>
      )}
      {r.status === "running" && job && job.status !== "captcha" && job.status !== "done" && (
        <div className="banner running">Rank checks are running in the browser worker: {job.message}. About 15 seconds per search.</div>
      )}
      {r.status === "running" && !(job && job.status !== "done") && (
        <div className="banner running">Research is running. This page updates on its own; you can leave and come back.</div>
      )}

      <div className="progress"><i style={{ width: `${pct}%` }} /></div>

      <div className="row">
        <div className="grow" style={{ flex: 1.5 }}>
          <div className="steps">
            {r.steps.map((s) => (
              <div key={s.id} className={`step ${s.state}`}>
                <span className="n">{s.id}</span>
                <span className="t">
                  {s.title}{CHECKPOINTS[s.id] ? <span className="note"> · checkpoint {CHECKPOINTS[s.id]}</span> : null}
                  {s.state === "done" && r.provenance[s.id] === "live" && <span className="tag strength" style={{ marginLeft: 8 }}>live</span>}
                  {s.state === "done" && false}
                  {s.state === "done" && r.provenance[s.id] === "not run" && <span className="tag attention" style={{ marginLeft: 8 }}>not run</span>}
                </span>
                <span className="m">{s.state === "waiting" ? "Waiting for you" : s.state === "running" ? (s.id === 3 && job && job.status !== "done" ? job.message : "Running") : s.detail}</span>
              </div>
            ))}
          </div>
        </div>
        <div className="grow stack">
          <div className="card">
            <h3>Client</h3>
            <div className="kv">
              <div><b>Website</b><a className="link" href={r.intake.website} target="_blank" rel="noreferrer">{r.intake.website.replace(/^https?:\/\//, "")}</a></div>
              <div><b>Platform</b>{r.wordpress ? "WordPress" : "Not WordPress"}</div>
              {r.legacySite && <div><b>Legacy site</b><span style={{ color: "var(--red)" }}>Still live: {r.legacySite.replace(/^https?:\/\//, "")}</span></div>}
              <div><b>Address</b>{r.intake.address}</div>
              <div><b>Phone</b>{r.intake.office}</div>
              <div><b>Status</b><StatusPill status={r.status} /></div>
            </div>
          </div>
          <div className="card">
            <h3>Delivery</h3>
            <div className="kv">
              <div><b>Output</b>Google Sheet in {r.delivery.driveFolder}</div>
              <div><b>Assigned AE</b>{r.ae}</div>
              <div><b>Send link via</b>{r.notify}</div>
              <div><b>Google Sheet</b>{r.delivery.sheetUrl && r.delivery.sheetUrl !== "#" ? <a className="link" href={r.delivery.sheetUrl} target="_blank" rel="noreferrer">{r.delivery.sheetUrl.replace(/^https?:\/\//, "").slice(0, 48)}...</a> : r.status === "sent" ? <span className="dim">Not created (see log)</span> : <span className="dim">Created on approval</span>}</div>
              <div><b>AE approval</b>
                {r.delivery.aeApproval === "approved" && <span className="pill done">Approved by {r.delivery.sentTo}</span>}
                {r.delivery.aeApproval === "pending" && <span className="pill waiting">Awaiting {r.delivery.sentTo}</span>}
                {r.delivery.aeApproval === "not-sent" && <span className="pill todo">Not sent yet</span>}
              </div>
              <div><b>HubSpot record</b>
                {r.delivery.hubspot === "written" ? <span className="pill done">Link written</span> : r.delivery.hubspot === "pending" ? <span className="pill waiting">Pending</span> : <span className="pill todo">Not connected yet</span>}
              </div>
              <div className="note">The Sheet link and date will be written to the MSM Report Link property on the client&rsquo;s HubSpot record.</div>
            </div>
          </div>
          <div className="card">
            <h3>Log</h3>
            <div className="log">
              {r.log.slice(0, 8).map((l, i) => <div key={i}><b>{l.time}</b>{l.text}</div>)}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
