import { env, has } from "@/lib/env";
import { getJob, heartbeat, updateJob } from "@/lib/worker";
import { ensureLoaded } from "@/lib/store";
import type { RankJob, RankJobResult } from "@/lib/types";

function authorized(req: Request): boolean {
  const h = req.headers.get("authorization") ?? "";
  return has.worker() && h === `Bearer ${env.workerToken}`;
}

/** Worker: report progress ({status, message}) or the final result ({status:"done", result}). */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!authorized(req)) return Response.json({ error: "Unauthorized" }, { status: 401 });
  await ensureLoaded();
  heartbeat(req.headers.get("x-machine") ?? "worker");
  const { id } = await params;
  if (!getJob(id)) return Response.json({ error: "Job not found" }, { status: 404 });
  const body = (await req.json().catch(() => ({}))) as { status?: RankJob["status"]; message?: string; result?: RankJobResult };
  const allowed: RankJob["status"][] = ["running", "captcha", "done", "failed"];
  if (!body.status || !allowed.includes(body.status)) return Response.json({ error: "Bad status" }, { status: 400 });
  if (body.status === "done" && (!body.result || !Array.isArray(body.result.searches))) return Response.json({ error: "Result missing" }, { status: 400 });
  const job = updateJob(id, { status: body.status, message: body.message ?? "", result: body.result });
  return Response.json({ ok: true, status: job?.status });
}
