// Vercel: allow up to 60 s for live research calls (PageSpeed, Copyscape, Sheet creation).
export const maxDuration = 60;

import { getSession } from "@/lib/auth";
import { advanceAll } from "@/lib/store";

/** Runs the next step of every running report. Called by the Reports list while anything is running. */
export async function POST() {
  const session = await getSession();
  if (!session) return Response.json({ error: "Sign in required" }, { status: 401 });
  await advanceAll();
  return Response.json({ ok: true });
}
