import { notFound, redirect } from "next/navigation";
import { getReport, reportHref } from "@/lib/store";
import { ReportHeader } from "@/components/ui";
import { KeywordsForm } from "./KeywordsForm";

export const dynamic = "force-dynamic";
export const metadata = { title: "Checkpoint 1" };

export default async function KeywordsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const r = getReport(id);
  if (!r) notFound();
  if (!(r.status === "waiting" && r.currentStep === 2)) redirect(reportHref(r));

  return (
    <>
      <ReportHeader report={r} subtitle="Checkpoint 1 of 3: confirm cities and keywords" />
      <KeywordsForm report={r} />
    </>
  );
}
