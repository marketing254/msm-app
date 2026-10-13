import { notFound, redirect } from "next/navigation";
import { getReport, reportHref, reportJob } from "@/lib/store";
import { ReportHeader } from "@/components/ui";
import { ListingsForm } from "./ListingsForm";
import { readAiMode } from "@/app/actions";

export const dynamic = "force-dynamic";
export const metadata = { title: "Checkpoint 3" };

export default async function ListingsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const r = await getReport(id);
  if (!r) notFound();
  if (!(r.status === "waiting" && r.currentStep === 10)) redirect(reportHref(r));

  const captured = (reportJob(r)?.result?.aiMode ?? []).filter((a) => a.text?.trim()).length;
  const read = r.aiMode.filter((a) => a.shows || a.others.length).length;

  return (
    <>
      <ReportHeader report={r} subtitle="Checkpoint 3 of 3: confirm listing links and AI Mode" />
      {captured > 0 && read === 0 && (
        <div className="banner waiting">
          The worker captured {captured} AI Mode answer{captured === 1 ? "" : "s"} but the names have not been read yet.
          <form action={readAiMode}><input type="hidden" name="id" value={r.id} /><button className="btn primary" type="submit">Read AI Mode answers</button></form>
        </div>
      )}
      {captured === 0 && <div className="banner waiting">No AI Mode answers were captured for this report (worker off or test mode). The table below stays empty; use Re-run to check by hand.</div>}
      <ListingsForm report={r} />
    </>
  );
}
