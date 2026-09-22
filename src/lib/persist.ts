import { has } from "./env";
import { stateLoad, stateSave } from "./google";

/**
 * Saves app state to the State tab of the MSM Database sheet so a server restart (or a new Vercel instance)
 * picks up reports in progress and worker jobs. Saves are queued per id so writes never overlap.
 */
const queues = new Map<string, Promise<void>>();
const lastSaved = new Map<string, string>();

export function persistEnabled(): boolean { return has.database(); }

export function persist(id: string, value: unknown): void {
  if (!persistEnabled()) return;
  const json = JSON.stringify(value);
  if (lastSaved.get(id) === json) return;
  lastSaved.set(id, json);
  const prev = queues.get(id) ?? Promise.resolve();
  const next = prev.then(() => stateSave(id, json)).catch((e) => { console.error(`[persist] ${id}: ${e instanceof Error ? e.message : String(e)}`); });
  queues.set(id, next);
}

/** Waits for any pending save of this id (used before a redirect so the next request sees the change). */
export async function flushed(id: string): Promise<void> { await (queues.get(id) ?? Promise.resolve()); }

export async function loadAll(): Promise<Record<string, unknown>> {
  if (!persistEnabled()) return {};
  const rows = await stateLoad();
  const out: Record<string, unknown> = {};
  for (const [id, json] of Object.entries(rows)) {
    try { out[id] = JSON.parse(json); lastSaved.set(id, json); } catch { /* skip a bad row */ }
  }
  return out;
}
