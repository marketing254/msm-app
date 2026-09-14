import { notFound, redirect } from "next/navigation";
import { getReport, reportHref } from "@/lib/store";
import { ReportHeader } from "@/components/ui";
import { ReviewTabs } from "./ReviewTabs";

export const dynamic = "force-dynamic";
export const metadata = { title: "Review and approve" };

export default async function ReviewPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const r = getReport(id);
  if (!r) notFound();
  if (r.status !== "ready" && r.status !== "sent") redirect(reportHref(r));

  return (
    <>
      <ReportHeader report={r} subtitle={r.status === "sent" ? "Approved report, read-only" : "Review and approve. This is what the Excel will contain."} />
      <ReviewTabs report={r} />
    </>
  );
}
