"use client";

import { useState } from "react";
import Link from "next/link";
import { pickCompetitors } from "@/app/actions";
import type { Report } from "@/lib/types";

export function CompetitorsForm({ report: r, total }: { report: Report; total: number }) {
  const [picked, setPicked] = useState<Set<string>>(new Set(r.competitors.filter((c) => c.selected).map((c) => c.id)));
  const toggle = (id: string) => setPicked((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  const none = r.competitors.length === 0;
  const ok = none || (picked.size >= 2 && picked.size <= 4);
  const sorted = [...r.competitors].sort((a, b) => (a.verified === "verified" ? 0 : 1) - (b.verified === "verified" ? 0 : 1) || b.beats - a.beats);

  return (
    <form action={pickCompetitors} className="stack">
      <input type="hidden" name="id" value={r.id} />
      {Array.from(picked).map((id) => <input key={id} type="hidden" name="competitor" value={id} />)}
      <div className="card">
        <h3>Shortlist <span className="note">practices that outrank the client, sorted by how often they beat it</span></h3>
        <div className="table-wrap">
          <table>
            <thead>
              <tr><th></th><th>Practice</th><th className="num">Beats client in</th><th className="num">Distance</th><th className="num">Services overlap</th><th className="num">Google reviews</th><th>Website</th><th>Check</th></tr>
            </thead>
            <tbody>
              {none && <tr><td colSpan={8} className="dim">No competitor data. The rank worker was not running for this report, so no site was seen outranking the client. Continue, or start the report again with the worker online.</td></tr>}
              {sorted.map((c) => {
                const on = picked.has(c.id);
                const disabled = c.verified === "manual";
                return (
                  <tr key={c.id} style={{ opacity: c.verified === "verified" ? 1 : 0.85 }}>
                    <td style={{ width: 30 }}><input type="checkbox" checked={on} disabled={disabled} onChange={() => toggle(c.id)} aria-label={c.name} style={{ accentColor: "var(--navy)" }} /></td>
                    <td>{c.verified === "verified" ? <b>{c.name}</b> : c.name}</td>
                    <td className="num">{c.beats} of {total}</td>
                    <td className="num">{c.dataKnown === false ? <span className="dim">-</span> : `${c.distanceMiles.toFixed(1)} mi`}</td>
                    <td className="num">{c.dataKnown === false ? <span className="dim">-</span> : `${c.overlapPct}%`}</td>
                    <td className="num">{c.dataKnown === false ? <span className="dim">-</span> : `${c.rating.toFixed(1)} (${c.reviews})`}</td>
                    <td>{c.website ? <a className="link" href={`https://${c.website}`} target="_blank" rel="noreferrer">{c.website}</a> : <span className="note">two possible domains</span>}</td>
                    <td>
                      {c.verified === "verified" && <span className="pill done">Verified</span>}
                      {c.verified === "manual" && <span className="pill flag">Needs manual check</span>}
                      {c.verified === "low-overlap" && <span className="note">Low overlap</span>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
      <div className="actions">
        <button className="btn success" type="submit" disabled={!ok}>{none ? "Continue without competitors" : `Confirm ${picked.size} competitor${picked.size === 1 ? "" : "s"} and pull their data`}</button>
        <Link href={`/reports/${r.id}`} className="btn quiet">Back</Link>
        <span className="note">{r.competitors.some((c) => c.dataKnown === false) ? "From the live rank checks: these domains outrank the client. Distance, overlap and reviews are not read yet, so check the website before picking." : "Rule: within 20 miles, similar services (50%+ overlap), more Google reviews than the client. Unverified websites are flagged, never guessed."}{!ok ? ` Pick 2 to 4 (${picked.size} picked).` : ""}</span>
      </div>
    </form>
  );
}
