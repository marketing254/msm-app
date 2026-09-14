import Link from "next/link";
import { notFound } from "next/navigation";
import { getReport, reportHref } from "@/lib/store";
import { CHECKPOINTS } from "@/lib/data";
import { ReportHeader, StatusPill, formatDate } from "@/components/ui";
import { AutoRefresh } from "@/components/AutoRefresh";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return { title: getReport(id)?.intake.company ?? "Report" };
}

export default async function ReportPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ approved?: string }> }) {
  const { id } = await params;
  const { approved } = await searchParams;
  const r = getReport(id);
  if (!r) notFound();

  const done = r.steps.filter((s) => s.state === "done").length;
  const pct = Math.round((done / 12) * 100);
  const home = r.cities.find((c) => c.home) ?? r.cities[0];
  const cp = CHECKPOINTS[r.currentStep];
  const href = reportHref(r);

  return (
    <>
      {r.status === "running" && <AutoRefresh seconds={2} />}
      <ReportHeader report={r} subtitle={`Started ${formatDate(r.startedAt).replace(/^(Today|Yesterday)/, (m) => m.toLowerCase())} · ${r.intake.vertical} · ${home.name}, ${home.state}`} />

      {r.status === "sent" && (
        <div className="banner ready">
          {approved
            ? `Approved. Google Sheet created and the link sent to ${r.delivery.sentTo} via ${r.delivery.sentVia}.`
            : `Approved by ${r.approvedBy} on ${formatDate(r.approvedAt ?? r.startedAt)}. Sent to ${r.delivery.sentTo}.`}
          <a className="btn success" href={r.delivery.sheetUrl ?? "#"} title="Opens when Google Sheets is connected">Open Google Sheet</a>
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
      {r.status === "running" && (
        <div className="banner running">Research is running. This page updates on its own; you can leave and come back.</div>
      )}

      <div className="progress"><i style={{ width: `${pct}%` }} /></div>

      <div className="row">
        <div className="grow" style={{ flex: 1.5 }}>
          <div className="steps">
            {r.steps.map((s) => (
              <div key={s.id} className={`step ${s.state}`}>
                <span className="n">{s.id}</span>
                <span className="t">{s.title}{CHECKPOINTS[s.id] ? <span className="note"> · checkpoint {CHECKPOINTS[s.id]}</span> : null}</span>
                <span className="m">{s.state === "waiting" ? "Waiting for you" : s.state === "running" ? "Running" : s.detail}</span>
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
              <div><b>Google Sheet</b>{r.delivery.sheetUrl ? <a className="link" href={r.delivery.sheetUrl} title="Opens when Google Sheets is connected">Open sheet</a> : <span className="dim">Created on approval</span>}</div>
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
