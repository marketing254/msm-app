"use client";

import { useState } from "react";
import Link from "next/link";
import { confirmListings } from "@/app/actions";
import type { Report } from "@/lib/types";

function short(url: string) { return url.replace(/^https?:\/\/(www\.)?/, "").slice(0, 40) + (url.length > 48 ? "..." : ""); }

export function ListingsForm({ report: r }: { report: Report }) {
  const needConfirm = r.listings.filter((l) => l.source === "search" && l.match !== "not-applicable");
  const [confirmed, setConfirmed] = useState<Set<string>>(new Set(needConfirm.filter((l) => l.confirmed).map((l) => l.platform)));
  const [urls, setUrls] = useState<Record<string, string>>({});
  const [checked, setChecked] = useState<Set<string>>(new Set(r.aiMode.filter((a) => a.checked).map((a) => a.keyword)));

  const toggleC = (p: string) => setConfirmed((s) => { const n = new Set(s); if (n.has(p)) n.delete(p); else n.add(p); return n; });
  const toggleA = (k: string) => setChecked((s) => { const n = new Set(s); if (n.has(k)) n.delete(k); else n.add(k); return n; });

  const pending = needConfirm.filter((l) => l.match !== "not-listed" && l.match !== "not-checked" && !confirmed.has(l.platform)).length;
  const ok = pending === 0;
  const home = r.cities.find((c) => c.home) ?? r.cities[0];

  return (
    <form action={confirmListings} className="stack">
      <input type="hidden" name="id" value={r.id} />
      {Object.entries(urls).map(([p, u]) => <input key={p} type="hidden" name={`url:${p}`} value={u} />)}
      {Array.from(checked).map((k) => <input key={k} type="hidden" name="ai" value={k} />)}

      <div className="card">
        <h3>Listings (NAP) <span className="note">on file: {r.intake.company}, {r.intake.address}, {r.intake.office}</span></h3>
        <div className="table-wrap">
          <table>
            <thead><tr><th>Platform</th><th>Name found</th><th>Address found</th><th>Phone</th><th>Link</th><th>Match</th><th>Your action</th></tr></thead>
            <tbody>
              {r.listings.map((l) => (
                <tr key={l.platform}>
                  <td><b>{l.platform}</b></td>
                  {l.match === "not-applicable" ? (
                    <>
                      <td colSpan={3} className="dim">Not applicable: {l.reason}</td><td className="dim">-</td>
                      <td><span className="tag watch">N/A</span></td><td className="note">Marked in the report with the reason</td>
                    </>
                  ) : l.match === "not-checked" ? (
                    <>
                      <td colSpan={3} className="dim">Not checked: the rank worker was not running for this report</td><td className="dim">-</td>
                      <td><span className="tag watch">Not checked</span></td>
                      <td><input className="input" style={{ minWidth: 200 }} placeholder="Paste the listing link if you have it" value={urls[l.platform] ?? ""} onChange={(e) => setUrls((u) => ({ ...u, [l.platform]: e.target.value }))} /></td>
                    </>
                  ) : l.match === "not-listed" ? (
                    <>
                      <td colSpan={3} className="dim">No listing found</td><td className="dim">-</td>
                      <td><span className="tag attention">Not listed</span></td>
                      <td><input className="input" style={{ minWidth: 200 }} placeholder="Paste link if you find one" value={urls[l.platform] ?? ""} onChange={(e) => setUrls((u) => ({ ...u, [l.platform]: e.target.value }))} /></td>
                    </>
                  ) : (
                    <>
                      <td>{l.name}</td>
                      <td style={{ color: l.match === "mismatch" && l.address !== r.intake.address ? "var(--red)" : undefined }}>{l.address}</td>
                      <td style={{ color: l.match === "mismatch" && l.phone !== r.intake.office ? "var(--red)" : undefined }}>{l.phone}</td>
                      <td>{l.url && <a className="link" href={l.url} target="_blank" rel="noreferrer">{short(l.url)}</a>}</td>
                      <td>{l.match === "match" ? <span className="tag strength">Match</span> : <span className="tag attention">Mismatch</span>}</td>
                      <td>
                        {l.source === "api"
                          ? <span className="note">Verified by API</span>
                          : l.source === "worker"
                            ? <span className="note">Read from the {l.platform} page{l.reason && l.reason !== "Match" ? `: ${l.reason}` : ""}</span>
                            : <label className="check"><input type="checkbox" checked={confirmed.has(l.platform)} onChange={() => toggleC(l.platform)} />Confirm link</label>}
                      </td>
                    </>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="card">
        <h3>Google AI Mode <span className="note">spot check, searched from {home.name}, {home.state}</span></h3>
        <div className="table-wrap">
          <table>
            <thead><tr><th>Keyword</th><th>Do we show up?</th><th>Who shows up instead</th><th>Your action</th></tr></thead>
            <tbody>
              {r.aiMode.map((a) => (
                <tr key={a.keyword}>
                  <td>{a.keyword}</td>
                  <td>{a.shows ? <span className="tag strength">Yes</span> : <span className="tag attention">No</span>}</td>
                  <td>{a.shows ? <span className="dim">-</span> : a.others.join(", ")}</td>
                  <td style={{ whiteSpace: "nowrap" }}>
                    <label className="check"><input type="checkbox" checked={checked.has(a.keyword)} onChange={() => toggleA(a.keyword)} />Looks right</label>
                    <a className="link" style={{ marginLeft: 14, fontSize: 12.5 }} href={`https://www.google.com/search?q=${encodeURIComponent(`${a.keyword} ${home.name} ${home.state}`)}&udm=50`} target="_blank" rel="noreferrer">Re-run</a>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="actions">
        <button className="btn success" type="submit" disabled={!ok}>Confirm and build the report</button>
        <Link href={`/reports/${r.id}`} className="btn quiet">Back</Link>
        <span className="note">{ok ? "Unchecked AI rows are kept as found; you can still edit wording on the review screen." : `${pending} listing link${pending === 1 ? "" : "s"} still to confirm.`}</span>
      </div>
    </form>
  );
}
