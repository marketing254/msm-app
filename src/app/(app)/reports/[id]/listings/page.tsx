import { notFound, redirect } from "next/navigation";
import { getReport, reportHref } from "@/lib/store";
import { ReportHeader } from "@/components/ui";
import { ListingsForm } from "./ListingsForm";

export const dynamic = "force-dynamic";
export const metadata = { title: "Checkpoint 3" };

export default async function ListingsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const r = getReport(id);
  if (!r) notFound();
  if (!(r.status === "waiting" && r.currentStep === 10)) redirect(reportHref(r));

  return (
    <>
      <ReportHeader report={r} subtitle="Checkpoint 3 of 3: confirm listing links and AI Mode" />
      <ListingsForm report={r} />
    </>
  );
}
