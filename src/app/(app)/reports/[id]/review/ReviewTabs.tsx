"use client";

import { useState } from "react";
import Link from "next/link";
import { approveReport, sendBack } from "@/app/actions";
import { LevelTag, RankBadge, Tile, longDate, summarise } from "@/components/ui";
import { VERTICAL_WORD } from "@/lib/data";
import type { Finding, Report } from "@/lib/types";

const TABS = ["Summary", "Client Basic Information", "Practice Name Google Search", "Nearby Competition Review", "Google AI Overview", "Services & Notes"];

export function ReviewTabs({ report: r }: { report: Report }) {
  const [tab, setTab] = useState(0);
  const [bottomLine, setBottomLine] = useState(r.bottomLine);
  const [findings, setFindings] = useState<Finding[]>(r.findings);
  const readOnly = r.status === "sent";
  const s = summarise(r);
  const word = VERTICAL_WORD[r.intake.vertical];

  return (
    <div className="stack">
      <div className="tabs">
        {TABS.map((t, i) => <button key={t} type="button" className={i === tab ? "on" : ""} onClick={() => setTab(i)}>{t}</button>)}
      </div>

      {tab === 0 && (
        <>
          <div className="card">
            <h3>Bottom line <span className="note">{readOnly ? "" : "(editable)"}</span></h3>
            {readOnly ? <div>{bottomLine}</div> : <input className="input" value={bottomLine} onChange={(e) => setBottomLine(e.target.value)} />}
          </div>
          <div className="tiles">
            <Tile value={`${s.top3} / ${s.total}`} label="Top-3 rankings" sub={`Searches where you rank in Google's top 3`} warn={s.top3 === 0} />
            <Tile value={`${s.p1} / ${s.total}`} label="Page-1 rankings" sub={`${Math.round((s.p1 / Math.max(s.total, 1)) * 100)}% of targets reach page 1`} warn={s.p1 === 0} />
            <Tile value={s.reviews ?? "-"} label="Google reviews" sub={s.compAvg != null ? `vs. competitor average of ~${s.compAvg}` : "No competitors chosen"} />
            <Tile value={s.rating != null ? s.rating.toFixed(1) : "-"} label="Your rating" sub="Reputation strength" />
            <Tile value={s.facebook ? "Yes" : "No"} label="Facebook page" sub={s.facebook ? "Active page" : "No active page"} />
            <Tile value={s.lost} label="Keyword/city slots lost" sub="Where a competitor ranks above you" />
          </div>
          <div className="card">
            <h3>Top findings <span className="note">{readOnly ? "" : "(edit wording here)"}</span></h3>
            <div className="table-wrap">
              <table>
                <tbody>
                  {findings.map((f, i) => (
                    <tr key={i}>
                      <td style={{ width: 150 }}>
                        {readOnly ? <LevelTag level={f.level} /> : (
                          <select className="select" value={f.level} onChange={(e) => setFindings((fs) => fs.map((x, j) => j === i ? { ...x, level: e.target.value as Finding["level"] } : x))}>
                            <option value="attention">Attention</option><option value="watch">Watch</option><option value="strength">Strength</option>
                          </select>
                        )}
                      </td>
                      <td>{readOnly ? f.text : <textarea className="textarea inline" value={f.text} onChange={(e) => setFindings((fs) => fs.map((x, j) => j === i ? { ...x, text: e.target.value } : x))} />}</td>
                      {!readOnly && <td style={{ width: 70 }}><button type="button" className="btn quiet sm" onClick={() => setFindings((fs) => fs.filter((_, j) => j !== i))}>Remove</button></td>}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {!readOnly && <button type="button" className="btn quiet sm" style={{ marginTop: 10 }} onClick={() => setFindings((fs) => [...fs, { level: "watch", text: "" }])}>+ Add finding</button>}
          </div>
        </>
      )}

      {tab === 1 && (
        <div className="card">
          <h3>Client basic information <span className="note">confirmed at intake; everything else was researched</span></h3>
          <div className="kv">
            <div><b>Date prepared</b>{longDate(r.startedAt)}</div>
            <div><b>Owner / Doctor</b>{r.intake.name || "-"}</div>
            <div><b>Practice name</b>{r.intake.company}</div>
            <div><b>Website</b>{r.intake.website}</div>
            {r.legacySite && <div><b>Legacy website</b><span style={{ color: "var(--red)" }}>{r.legacySite} (still live)</span></div>}
            <div><b>Address</b>{r.intake.address}</div>
            <div><b>Office number</b>{r.intake.office || "-"}</div>
            <div><b>Cell number</b>{r.intake.cell || "-"}</div>
            <div><b>Email address</b>{r.intake.email || "-"}</div>
            <div><b>Website platform / CMS</b>{r.wordpress ? "WordPress" : "Not WordPress"}</div>
            <div><b>Service lines</b>{r.services.join(", ")}</div>
            <div><b>How did you find us?</b>{r.intake.referral || "-"}</div>
            <div><b>Comments</b>{r.intake.comments || "-"}</div>
          </div>
        </div>
      )}

      {tab === 2 && (
        <>
          <div className="card">
            <h3>Keyword rankings <span className="note">Google organic position for each service in each city. Where {word}s find you, or don&rsquo;t.</span></h3>
            <div className="table-wrap">
              <table>
                <thead><tr><th>Service keyword</th>{s.cities.map((c) => <th key={c.name}>{c.name}, {c.state}</th>)}<th>Who ranks top 3 instead (home city)</th></tr></thead>
                <tbody>
                  {s.keywords.map((k) => (
                    <tr key={k}>
                      <td>{k}</td>
                      {s.cities.map((_, i) => <td key={i}><RankBadge value={r.ranks[k]?.[i]} /></td>)}
                      <td className="dim">{r.aiMode.find((a) => a.keyword === k)?.others.slice(0, 2).join("; ") || "-"}</td>
                    </tr>
                  ))}
                  <tr><td><b>Page-1 presence</b></td>{s.cities.map((_, i) => <td key={i}><b>{s.keywords.filter((k) => r.ranks[k]?.[i] != null).length} of {s.keywords.length}</b></td>)}<td className="dim">Overall: {s.p1} / {s.total} page-1 · {s.top3} top-3</td></tr>
                </tbody>
              </table>
            </div>
            <p className="note" style={{ marginTop: 8 }}>Legend: <span className="rank good">#1-#3</span> Top 3 (Good) &nbsp; <span className="rank mid">#4-#10</span> Page 1 (Needs work) &nbsp; <span className="rank poor">Not P1</span> Not on page 1 (Poor)</p>
          </div>
          <div className="row">
            <div className="card grow">
              <h3>Google PageSpeed <span className="note">home page and a key service page</span></h3>
              <div className="table-wrap">
                <table>
                  <thead><tr><th>Page</th><th>Device</th><th className="num">Performance</th><th className="num">Accessibility</th><th className="num">Best practices</th><th className="num">SEO</th><th></th></tr></thead>
                  <tbody>
                    {r.pageSpeed.map((p, i) => (
                      <tr key={i}>
                        <td>{p.page}</td><td>{p.device}</td>
                        <td className="num" style={{ color: (p.performance ?? 100) < 50 ? "var(--red)" : (p.performance ?? 100) < 90 ? "var(--amber)" : "var(--green)", fontWeight: 600 }}>{p.performance ?? "Not run"}</td>
                        <td className="num">{p.accessibility ?? "-"}</td><td className="num">{p.bestPractices ?? "-"}</td><td className="num">{p.seo ?? "-"}</td>
                        <td><a className="link" href={`https://pagespeed.web.dev/analysis?url=${encodeURIComponent(p.url)}`} target="_blank" rel="noreferrer">Run</a></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
            <div className="card grow">
              <h3>Content originality <span className="note">Copyscape, 5% allowed</span></h3>
              <div className="table-wrap">
                <table>
                  <thead><tr><th>Page</th><th className="num">% Found</th><th>Finding</th></tr></thead>
                  <tbody>
                    {r.copyscape.map((c, i) => (
                      <tr key={i}>
                        <td className="dim">{c.url.replace(/^https?:\/\//, "")}</td>
                        <td className="num" style={{ color: c.foundPct > c.allowedPct ? "var(--red)" : "var(--green)", fontWeight: 600 }}>{c.foundPct}%</td>
                        <td>{c.finding}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
          <div className="card">
            <h3>NAP consistency <span className="note">name, address, phone across listings, checked against the on-file record</span></h3>
            <div className="table-wrap">
              <table>
                <thead><tr><th>Field</th><th>On file</th>{r.listings.map((l) => <th key={l.platform}>{l.platform}</th>)}</tr></thead>
                <tbody>
                  {(["name", "address", "phone"] as const).map((f) => (
                    <tr key={f}>
                      <td><b>{f === "name" ? "Business name" : f === "address" ? "Street address" : "Phone"}</b></td>
                      <td>{f === "name" ? r.intake.company : f === "address" ? r.intake.address : r.intake.office}</td>
                      {r.listings.map((l) => {
                        const v = l[f];
                        const onFile = f === "name" ? r.intake.company : f === "address" ? r.intake.address : r.intake.office;
                        const bad = l.match === "mismatch" && v !== onFile;
                        return <td key={l.platform} style={{ color: bad ? "var(--red)" : l.match === "match" ? "var(--green)" : "var(--muted)" }}>{l.match === "not-listed" ? "Not listed" : l.match === "not-applicable" ? "N/A" : l.match === "not-checked" ? "Not checked" : `${bad ? "✗" : "✓"} ${v}`}</td>;
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {tab === 3 && (
        <>
          <div className="card">
            <h3>Competition <span className="note">who outranks you, and where. Organic Google search only, side by side.</span></h3>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr><th rowSpan={2} style={{ verticalAlign: "bottom" }}>Service keyword</th><th colSpan={s.cities.length} style={{ borderLeft: "1px solid var(--rule)" }}>{r.intake.company} (YOU)</th>{s.chosen.map((c) => <th key={c.id} colSpan={s.cities.length} style={{ borderLeft: "1px solid var(--rule)" }}>{c.name}</th>)}</tr>
                  <tr>{[null, ...s.chosen].map((c, ci) => s.cities.map((city, i) => <th key={`${ci}-${i}`} style={{ borderLeft: i === 0 ? "1px solid var(--rule)" : undefined, fontWeight: 400, textTransform: "none" }}>{city.name}</th>))}</tr>
                </thead>
                <tbody>
                  {s.keywords.map((k) => (
                    <tr key={k}>
                      <td>{k}</td>
                      {s.cities.map((_, i) => <td key={`y${i}`} style={{ borderLeft: i === 0 ? "1px solid var(--rule)" : undefined }}><RankBadge value={r.ranks[k]?.[i]} /></td>)}
                      {s.chosen.map((c) => s.cities.map((_, i) => <td key={`${c.id}${i}`} style={{ borderLeft: i === 0 ? "1px solid var(--rule)" : undefined }}><RankBadge value={r.competitorRanks[c.id]?.[k]?.[i]} /></td>))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {s.chosen.length === 0 && <p className="note" style={{ marginTop: 8 }}>No competitors were chosen at checkpoint 2.</p>}
          </div>
          <div className="card">
            <h3>Reviews and reputation</h3>
            <div className="table-wrap">
              <table>
                <thead><tr><th>Practice / competitor</th><th>Platform</th><th className="num">Rating</th><th className="num"># Reviews</th><th>Finding</th></tr></thead>
                <tbody>
                  {r.reviews.map((x, i) => (
                    <tr key={i}>
                      <td>{x.who.endsWith("(YOU)") ? <b>{x.who}</b> : x.who}</td><td>{x.platform}</td>
                      <td className="num">{x.rating != null ? `${x.rating.toFixed(1)}/5.0` : <span className="dim">No rating yet</span>}</td>
                      <td className="num">{x.reviews ?? <span className="dim">-</span>}</td>
                      <td className="dim">{x.note || "-"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {tab === 4 && (
        <div className="card">
          <h3>Google AI Overview / AI Mode <span className="note">whether Google&rsquo;s AI answer names the practice, for all 10 keywords</span></h3>
          <div className="table-wrap">
            <table>
              <thead><tr><th>Keyword</th><th>Do we show up?</th><th>Who shows up instead</th></tr></thead>
              <tbody>
                {r.aiMode.map((a) => (
                  <tr key={a.keyword}>
                    <td>{a.keyword}</td>
                    <td>{a.shows ? <span className="tag strength">Yes</span> : <span className="tag attention">No</span>}</td>
                    <td>{a.shows ? <span className="dim">-</span> : a.others.join(", ")}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="note" style={{ marginTop: 8 }}>Searches use the home city and state. Rows marked &ldquo;Looks right&rdquo; at checkpoint 3: {r.aiMode.filter((a) => a.checked).length} of {r.aiMode.length}.</p>
        </div>
      )}

      {tab === 5 && (
        <div className="row">
          <div className="card grow">
            <h3>Service lines</h3>
            <ul style={{ margin: 0, paddingLeft: 18 }}>{r.services.map((x) => <li key={x}>{x}</li>)}</ul>
          </div>
          <div className="card grow">
            <h3>Notes</h3>
            <p>{s.p1 === 0
              ? `The visibility gap is total, not partial: across all ${s.keywords.length} tracked services and ${s.cities.length} cities, the practice does not reach page 1 once.`
              : `The practice reaches page 1 in ${s.p1} of ${s.total} keyword/city slots and the top 3 in ${s.top3}. The widest gaps are outside the home city.`}</p>
            <p className="note" style={{ marginTop: 8 }}>Wording uses &ldquo;{word}&rdquo; for this vertical.</p>
          </div>
        </div>
      )}

      {readOnly ? (
        <div className="actions">
          {r.delivery.sheetUrl && r.delivery.sheetUrl !== "#"
            ? <a className="btn success" href={r.delivery.sheetUrl} target="_blank" rel="noreferrer">Open Google Sheet</a>
            : <span className="btn quiet" style={{ opacity: 0.6, cursor: "default" }}>No Google Sheet</span>}
          <a className="btn quiet" href={`/api/reports/${r.id}/excel`}>Excel fallback</a>
          <Link href={`/reports/${r.id}`} className="btn quiet">Back to report</Link>
          <span className="note">Approved by {r.approvedBy}. Sent to {r.delivery.sentTo} via {r.delivery.sentVia}.</span>
        </div>
      ) : (
        <div className="actions">
          <form action={approveReport} style={{ display: "contents" }}>
            <input type="hidden" name="id" value={r.id} />
            <input type="hidden" name="bottomLine" value={bottomLine} />
            {findings.map((f, i) => <span key={i} style={{ display: "contents" }}><input type="hidden" name="level" value={f.level} /><input type="hidden" name="finding" value={f.text} /></span>)}
            <button className="btn success" type="submit">Approve and create Google Sheet</button>
          </form>
          <a className="btn" href={`/api/reports/${r.id}/excel?draft=1`}>Excel draft (fallback)</a>
          <form action={sendBack} style={{ display: "contents" }}>
            <input type="hidden" name="id" value={r.id} />
            <button className="btn quiet" type="submit">Send back to research</button>
          </form>
          <span className="note">On approve: the Sheet is created in MSM Reports, the link goes to {r.ae} via {r.notify}, and your name and time are logged.</span>
        </div>
      )}
    </div>
  );
}
