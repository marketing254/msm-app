// Vercel: allow up to 60 s for live research calls (PageSpeed, Copyscape, Sheet creation).
export const maxDuration = 60;

import { getSession } from "@/lib/auth";
import { advance } from "@/lib/store";

/** Runs the next research step of one report. Called by the progress page while the report is running. */
export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) return Response.json({ error: "Sign in required" }, { status: 401 });
  const { id } = await params;
  const r = await advance(id);
  if (!r) return Response.json({ error: "Not found" }, { status: 404 });
  return Response.json({ status: r.status, step: r.currentStep });
}
