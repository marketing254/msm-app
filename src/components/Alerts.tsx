import { guard } from "@/lib/guard";

/** Red or yellow strip at the top of every page while an alert is open. Server component. */
export function Alerts() {
  const alerts = guard.alerts();
  if (!alerts.length) return null;
  return (
    <div className="stack" style={{ gap: 8 }}>
      {alerts.map((a, i) => (
        <div key={i} className={`banner ${a.level === "error" ? "waiting" : "running"}`} style={a.level === "error" ? { background: "var(--red-100)", color: "var(--red)" } : undefined}>
          <b style={{ marginRight: 8 }}>{a.at}</b>{a.text}
        </div>
      ))}
    </div>
  );
}
