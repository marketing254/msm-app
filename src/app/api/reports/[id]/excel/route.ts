import { readFile } from "node:fs/promises";
import path from "node:path";
import { getSession } from "@/lib/auth";
import { getReport } from "@/lib/store";

/**
 * Serves the MSM workbook for a report.
 * Demo version: returns the master-format workbook (Ever & Ever layout) named for the client.
 * The real version fills the same template from the report data before returning it.
 */
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) return new Response("Sign in required", { status: 401 });
  const { id } = await params;
  const r = getReport(id);
  if (!r) return new Response("Not found", { status: 404 });
  const draft = new URL(request.url).searchParams.get("draft") === "1";
  if (r.status !== "sent" && !draft) return new Response("Report is not approved yet", { status: 409 });

  const file = await readFile(path.join(process.cwd(), "data", "msm-template.xlsx"));
  const date = new Date(r.approvedAt ?? r.startedAt).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
  const safe = r.intake.company.replace(/[\\/:*?"<>|]/g, "");
  const name = `${safe} - ${date}${draft ? " DRAFT" : ""} MSM.xlsx`;
  return new Response(new Uint8Array(file), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${name}"`,
      "Cache-Control": "no-store",
    },
  });
}
