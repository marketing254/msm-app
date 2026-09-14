import Link from "next/link";
import type { Report, ReportStatus } from "@/lib/types";

export function StatusPill({ status }: { status: ReportStatus }) {
  const label: Record<ReportStatus, string> = { draft: "Draft", running: "Running", waiting: "Waiting for you", ready: "Ready to review", sent: "Sent" };
  return <span className={`pill ${status}`}>{label[status]}</span>;
}

export function RankBadge({ value }: { value: number | null | undefined }) {
  if (value === undefined) return <span className="rank none">-</span>;
  if (value === null) return <span className="rank poor">Not P1</span>;
  if (value <= 3) return <span className="rank good">#{value}</span>;
  return <span className="rank mid">#{value}</span>;
}

export function LevelTag({ level }: { level: "attention" | "watch" | "strength" }) {
  const label = { attention: "Attention", watch: "Watch", strength: "Strength" }[level];
  return <span className={`tag ${level}`}>{label}</span>;
}

export function Tile({ value, label, sub, warn }: { value: React.ReactNode; label: string; sub?: string; warn?: boolean }) {
  return (
    <div className={`tile${warn ? " warn" : ""}`}>
      <div className="v">{value}</div>
      <div className="l">{label}</div>
      {sub && <div className="s">{sub}</div>}
    </div>
  );
}

export function ReportHeader({ report, subtitle, right }: { report: Report; subtitle: string; right?: React.ReactNode }) {
  return (
    <div>
      <div className="crumb"><Link href="/reports">Reports</Link> / {report.intake.company}</div>
      <div className="topbar">
        <h1 className="h1">{report.intake.company}<small>{subtitle}</small></h1>
        <div className="actions">{right ?? <StatusPill status={report.status} />}</div>
      </div>
    </div>
  );
}

export function formatDate(iso: string): string {
  const d = new Date(iso);
  const today = new Date();
  const sameDay = d.toDateString() === today.toDateString();
  const y = new Date(today); y.setDate(y.getDate() - 1);
  const time = d.toTimeString().slice(0, 5);
  if (sameDay) return `Today ${time}`;
  if (d.toDateString() === y.toDateString()) return `Yesterday ${time}`;
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "short" }) + " " + time;
}

export function longDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
}

/** Summary numbers used by the Reports list, Review screen and Excel. */
export function summarise(r: Report) {
  const sel = r.keywords.filter((k) => k.selected).map((k) => k.keyword);
  const cities = r.cities.filter((c) => c.selected);
  const total = sel.length * cities.length;
  let top3 = 0, p1 = 0, lost = 0;
  const chosen = r.competitors.filter((c) => c.selected);
  for (const k of sel) {
    const mine = r.ranks[k] ?? [];
    mine.forEach((v, i) => {
      if (v != null) p1++;
      if (v != null && v <= 3) top3++;
      const best = Math.min(...chosen.map((c) => r.competitorRanks[c.id]?.[k]?.[i] ?? 99));
      if (best < (v ?? 99)) lost++;
    });
  }
  const google = r.reviews.find((x) => x.who.endsWith("(YOU)") && x.platform === "Google");
  const fb = r.reviews.find((x) => x.who.endsWith("(YOU)") && x.platform === "Facebook");
  const compAvg = chosen.length ? Math.round(chosen.reduce((n, c) => n + c.reviews, 0) / chosen.length) : null;
  const facebook = Boolean(fb) && !/no page|not found/i.test(fb?.note ?? "");
  return { total, top3, p1, lost, cities, keywords: sel, rating: google?.rating ?? null, reviews: google?.reviews ?? null, facebook, compAvg, chosen };
}
