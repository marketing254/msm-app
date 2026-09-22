import { getSession } from "@/lib/auth";
import { buildDatabaseSnapshot } from "@/lib/dbExport";

/** Downloads a snapshot of the MSM Database as it stands right now. */
export async function GET() {
  const session = await getSession();
  if (!session) return new Response("Sign in required", { status: 401 });
  const file = await buildDatabaseSnapshot();
  const stamp = new Date().toISOString().slice(0, 16).replace("T", " ").replace(":", "");
  return new Response(new Uint8Array(file), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="MSM Database snapshot ${stamp}.xlsx"`,
      "Cache-Control": "no-store",
    },
  });
}
