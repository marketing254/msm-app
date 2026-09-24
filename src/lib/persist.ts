import { has } from "./env";
import { stateGet, stateIndex, stateLoad, stateSave } from "./google";

/**
 * Saves app state to the State tab of the MSM Database sheet so a server restart (or a new Vercel instance)
 * picks up reports in progress and worker jobs. Saves are queued per id so writes never overlap.
 */
const queues = new Map<string, Promise<void>>();
const lastSaved = new Map<string, string>();
const stamps = new Map<string, string>();   // column B stamp this instance last wrote or loaded
const pending = new Set<string>();         // ids with a save still in flight

export function persistEnabled(): boolean { return has.database(); }

export function persist(id: string, value: unknown): void {
  if (!persistEnabled()) return;
  const json = JSON.stringify(value);
  if (lastSaved.get(id) === json) return;
  lastSaved.set(id, json);
  pending.add(id);
  const prev = queues.get(id) ?? Promise.resolve();
  const next: Promise<void> = prev
    .then(async () => { stamps.set(id, await stateSave(id, json)); })
    .catch((e) => { console.error(`[persist] ${id}: ${e instanceof Error ? e.message : String(e)}`); })
    .finally(() => { if (queues.get(id) === next) pending.delete(id); });
  queues.set(id, next);
}

/** Waits for any pending save of this id (used before a redirect so the next request sees the change). */
export async function flushed(id: string): Promise<void> { await (queues.get(id) ?? Promise.resolve()); }

export async function loadAll(): Promise<Record<string, unknown>> {
  if (!persistEnabled()) return {};
  const rows = await stateLoad();
  const out: Record<string, unknown> = {};
  for (const [id, { json, at }] of Object.entries(rows)) {
    try { out[id] = JSON.parse(json); lastSaved.set(id, json); stamps.set(id, at); } catch { /* skip a bad row */ }
  }
  return out;
}

/**
 * Rows another server instance has saved since this instance last looked: id -> value.
 * Reads only the id and stamp columns, then fetches the rows whose stamp changed.
 * Rows this instance is still saving are skipped; its own write lands next.
 */
export async function changedElsewhere(): Promise<Record<string, unknown>> {
  if (!persistEnabled()) return {};
  const index = await stateIndex();
  const ids = Object.entries(index).filter(([id, at]) => !pending.has(id) && stamps.get(id) !== at).map(([id]) => id);
  const out: Record<string, unknown> = {};
  if (!ids.length) return out;
  const rows = await stateGet(ids);
  for (const [id, { json, at }] of Object.entries(rows)) {
    if (pending.has(id)) continue;
    try { out[id] = JSON.parse(json); lastSaved.set(id, json); stamps.set(id, at); } catch { /* skip a bad row */ }
  }
  return out;
}
