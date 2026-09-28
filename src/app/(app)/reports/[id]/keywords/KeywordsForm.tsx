"use client";

import { useState } from "react";
import Link from "next/link";
import { approveKeywords } from "@/app/actions";
import type { Report } from "@/lib/types";

export function KeywordsForm({ report: r }: { report: Report }) {
  const [cities, setCities] = useState<Set<string>>(new Set(r.cities.filter((c) => c.selected).map((c) => `${c.name}, ${c.state}`)));
  const [keywords, setKeywords] = useState<Set<string>>(new Set(r.keywords.filter((k) => k.selected).map((k) => k.keyword)));
  const [custom, setCustom] = useState<string[]>([]);
  const [draft, setDraft] = useState("");
  const [customCities, setCustomCities] = useState<string[]>([]);
  const [cityDraft, setCityDraft] = useState("");
  const homeState = r.cities.find((c) => c.home)?.state ?? r.cities[0]?.state ?? "";

  const toggleCity = (key: string) => setCities((s) => { const n = new Set(s); if (n.has(key)) n.delete(key); else n.add(key); return n; });
  const toggleKw = (key: string) => setKeywords((s) => { const n = new Set(s); if (n.has(key)) n.delete(key); else n.add(key); return n; });
  const addCustom = () => {
    const k = draft.trim();
    if (!k || keywords.has(k) || custom.includes(k)) { setDraft(""); return; }
    setCustom((c) => [...c, k]); setKeywords((s) => new Set(s).add(k)); setDraft("");
  };
  const addCity = () => {
    const raw = cityDraft.trim().replace(/\s+/g, " ");
    if (!raw) return;
    const m = raw.match(/^(.+?),?\s+([A-Za-z]{2})$/);
    const key = m ? `${m[1].replace(/,$/, "").trim()}, ${m[2].toUpperCase()}` : `${raw}, ${homeState}`;
    const known = r.cities.find((c) => `${c.name}, ${c.state}`.toLowerCase() === key.toLowerCase());
    const finalKey = known ? `${known.name}, ${known.state}` : key;
    if (!known && !customCities.some((c) => c.toLowerCase() === key.toLowerCase())) setCustomCities((c) => [...c, key]);
    setCities((s) => new Set(s).add(finalKey));
    setCityDraft("");
  };

  const cityOk = cities.size === 3;
  const kwOk = keywords.size === 10;
  const searches = cities.size * keywords.size;

  return (
    <form action={approveKeywords} className="stack">
      <input type="hidden" name="id" value={r.id} />
      {Array.from(cities).map((c) => <input key={c} type="hidden" name="city" value={c} />)}
      {Array.from(keywords).map((k) => <input key={k} type="hidden" name="keyword" value={k} />)}

      <div className="row">
        <div className="card grow">
          <h3>Target cities <span className="note">home + 2 nearby, 50,000+ people, within 20 miles</span></h3>
          <div className="table-wrap">
            <table>
              <thead><tr><th></th><th>City</th><th className="num">Population</th><th className="num">Distance</th></tr></thead>
              <tbody>
                {r.cities.map((c) => {
                  const key = `${c.name}, ${c.state}`;
                  return (
                    <tr key={key}>
                      <td style={{ width: 30 }}><input type="checkbox" checked={cities.has(key)} onChange={() => toggleCity(key)} aria-label={key} style={{ accentColor: "var(--navy)" }} /></td>
                      <td>{c.home ? <b>{key} (home)</b> : key}</td>
                      <td className="num">{c.population > 0 ? c.population.toLocaleString() : <span className="dim">-</span>}</td>
                      <td className="num">{c.home ? "0 mi" : c.distanceMiles >= 0 ? `${c.distanceMiles} mi` : <span className="dim">-</span>}</td>
                    </tr>
                  );
                })}
                {customCities.map((key) => (
                  <tr key={key}>
                    <td style={{ width: 30 }}><input type="checkbox" checked={cities.has(key)} onChange={() => toggleCity(key)} aria-label={key} style={{ accentColor: "var(--navy)" }} /></td>
                    <td>{key} <span className="note">(added)</span></td>
                    <td className="num"><span className="dim">-</span></td>
                    <td className="num"><span className="dim">-</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="field" style={{ marginTop: 12 }}>
            <label htmlFor="custom-city">Add a city</label>
            <div style={{ display: "flex", gap: 8 }}>
              <input id="custom-city" className="input" value={cityDraft} onChange={(e) => setCityDraft(e.target.value)} placeholder={`City, ${homeState || "ST"}`}
                onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addCity(); } }} />
              <button type="button" className="btn quiet" onClick={addCity}>Add</button>
            </div>
          </div>
          <p className="note" style={{ marginTop: 8 }}>
            Home city is read from the intake address. Nearby cities are suggestions; check them and add your own if needed.
          </p>
          <p className="note" style={{ marginTop: 8 }}>
            Website: {r.wordpress ? "WordPress detected." : "Not WordPress."}{r.legacySite ? ` Legacy site still live: ${r.legacySite.replace(/^https?:\/\//, "")} (will be flagged in the report).` : ""}
          </p>
        </div>

        <div className="card grow" style={{ flex: 1.2 }}>
          <h3>Keywords <span className="note">from the services found on the website</span></h3>
          <div className="check-grid">
            {r.keywords.map((k) => (
              <label key={k.keyword} className={`check${keywords.has(k.keyword) ? "" : " off"}`}>
                <input type="checkbox" checked={keywords.has(k.keyword)} onChange={() => toggleKw(k.keyword)} />{k.keyword}
              </label>
            ))}
            {custom.map((k) => (
              <label key={k} className={`check${keywords.has(k) ? "" : " off"}`}>
                <input type="checkbox" checked={keywords.has(k)} onChange={() => toggleKw(k)} />{k} <span className="note">(added)</span>
              </label>
            ))}
          </div>
          <div className="field" style={{ marginTop: 12 }}>
            <label htmlFor="custom">Add your own</label>
            <div style={{ display: "flex", gap: 8 }}>
              <input id="custom" className="input" value={draft} onChange={(e) => setDraft(e.target.value)} placeholder="Type a keyword and press Enter"
                onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addCustom(); } }} />
              <button type="button" className="btn quiet" onClick={addCustom}>Add</button>
            </div>
          </div>
        </div>
      </div>

      <div className="actions">
        <button className="btn success" type="submit" disabled={!cityOk || !kwOk}>Approve and run {searches} rank checks</button>
        <Link href={`/reports/${r.id}`} className="btn quiet">Back</Link>
        <span className="note">
          {!cityOk ? `Select exactly 3 cities (${cities.size} selected). ` : ""}
          {!kwOk ? `Select exactly 10 keywords (${keywords.size} selected). ` : ""}
          {cityOk && kwOk ? "Searches are run with the city as the searcher's location so results repeat." : ""}
        </span>
      </div>
    </form>
  );
}
