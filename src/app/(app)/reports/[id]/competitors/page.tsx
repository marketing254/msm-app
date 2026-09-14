import { notFound, redirect } from "next/navigation";
import { getReport, reportHref } from "@/lib/store";
import { ReportHeader } from "@/components/ui";
import { CompetitorsForm } from "./CompetitorsForm";

export const dynamic = "force-dynamic";
export const metadata = { title: "Checkpoint 2" };

export default async function CompetitorsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const r = getReport(id);
  if (!r) notFound();
  if (!(r.status === "waiting" && r.currentStep === 8)) redirect(reportHref(r));
  const total = r.keywords.filter((k) => k.selected).length * r.cities.filter((c) => c.selected).length;

  return (
    <>
      <ReportHeader report={r} subtitle="Checkpoint 2 of 3: pick 2 to 4 competitors" />
      <CompetitorsForm report={r} total={total} />
    </>
  );
}
