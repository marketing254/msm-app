import { env, has } from "@/lib/env";
import { heartbeat, pendingJobs } from "@/lib/worker";
import { ensureLoaded } from "@/lib/store";

function authorized(req: Request): boolean {
  const h = req.headers.get("authorization") ?? "";
  return has.worker() && h === `Bearer ${env.workerToken}`;
}

/** Worker: list pending jobs. Also counts as a heartbeat. */
export async function GET(req: Request) {
  if (!authorized(req)) return Response.json({ error: "Unauthorized" }, { status: 401 });
  await ensureLoaded();
  heartbeat(req.headers.get("x-machine") ?? "worker");
  const jobs = pendingJobs().map((j) => ({ ...j, result: undefined }));
  return Response.json({ jobs });
}
