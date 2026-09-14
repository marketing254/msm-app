"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import { createReport, type ActionState } from "@/app/actions";
import { VERTICAL_WORD } from "@/lib/data";
import type { Vertical } from "@/lib/types";

const VERTICALS: Vertical[] = ["Medical", "Dental", "Med spa", "Legal"];

export function NewReportForm({ aeList }: { aeList: string[] }) {
  const [state, action, pending] = useActionState<ActionState, FormData>(createReport, {});
  const [vertical, setVertical] = useState<Vertical>("Dental");

  return (
    <form action={action} className="stack">
      <div className="card">
        <h3>Client intake</h3>
        <div className="form-grid">
          <div className="field"><label htmlFor="name">Name</label><input id="name" name="name" className="input" placeholder="Dr. Jane Smith" /></div>
          <div className="field"><label htmlFor="company">Firm or company name</label><input id="company" name="company" className="input" placeholder="Smith Family Dental" required /></div>
          <div className="field"><label htmlFor="cell">Cell number</label><input id="cell" name="cell" className="input" placeholder="(555) 555-0100" /></div>
          <div className="field"><label htmlFor="office">Office number</label><input id="office" name="office" className="input" placeholder="(555) 555-0101" /></div>
          <div className="field"><label htmlFor="email">Email address</label><input id="email" name="email" className="input" type="email" placeholder="office@practice.com" /></div>
          <div className="field"><label htmlFor="website">Website</label><input id="website" name="website" className="input" placeholder="www.practice.com" required /></div>
          <div className="field span2"><label htmlFor="address">All location addresses</label><input id="address" name="address" className="input" placeholder="123 Main St, Suite 100, City, ST 00000" required /></div>
          <div className="field">
            <label htmlFor="referral">How did you find out about us?</label>
            <select id="referral" name="referral" className="select" defaultValue="Referral">
              <option>Referral</option><option>Google search</option><option>Webinar</option><option>Conference</option><option>Podcast</option><option>Other</option>
            </select>
          </div>
          <div className="field">
            <label htmlFor="vertical">Vertical</label>
            <select id="vertical" name="vertical" className="select" value={vertical} onChange={(e) => setVertical(e.target.value as Vertical)}>
              {VERTICALS.map((v) => <option key={v}>{v}</option>)}
            </select>
            <span className="hint">Wording in the report: &ldquo;{VERTICAL_WORD[vertical]}&rdquo;. {vertical === "Legal" ? "Zocdoc will be marked not applicable." : "All six listing platforms apply."}</span>
          </div>
          <div className="field span2"><label htmlFor="comments">Additional questions / comments</label><textarea id="comments" name="comments" className="textarea" placeholder="Optional" /></div>
        </div>
      </div>
      <div className="card">
        <h3>Delivery <span className="note">where the finished report goes</span></h3>
        <div className="form-grid">
          <div className="field">
            <label htmlFor="ae">Assigned AE</label>
            <select id="ae" name="ae" className="select" defaultValue={aeList[0]}>
              {aeList.map((a) => <option key={a}>{a}</option>)}
            </select>
            <span className="hint">Receives the Google Sheet link after approval and gives the final AE approval.</span>
          </div>
          <div className="field">
            <label htmlFor="notify">Send the link via</label>
            <select id="notify" name="notify" className="select" defaultValue="Slack + Email">
              <option>Slack + Email</option><option>Slack</option><option>Email</option>
            </select>
            <span className="hint">Output is a Google Sheet in Shared drives / Sales / MSM Reports. Excel download stays as a fallback.</span>
          </div>
        </div>
      </div>
      {state.error && <div className="error">{state.error}</div>}
      <div className="actions">
        <button className="btn primary" type="submit" disabled={pending}>{pending ? "Starting..." : "Start research"}</button>
        <Link href="/reports" className="btn quiet">Cancel</Link>
        <span className="note">Takes about a minute to propose cities and keywords. You approve them before the 30 searches run.</span>
      </div>
    </form>
  );
}
