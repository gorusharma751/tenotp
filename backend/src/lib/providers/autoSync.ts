// Runs entirely inside the backend process (index.ts starts an interval on
// boot) — no external cron, no Render Shell, no admin having a browser tab
// open needed. Every few minutes it:
//   1. Re-checks every built-in SMS provider's real connectivity
//      (same getBalance() probe as the admin health-check/ping-all
//      buttons) and updates its status/latency — so "Connected" in the
//      admin UI reflects reality within a few minutes of, say, an admin
//      finally saving a correct API key on Render, without anyone having
//      to click anything.
//   2. For every provider that's actually connected, refreshes its live
//      countries/services catalog — so buy-otp's country/service list
//      tracks the real upstream (new services, sold-out countries, price
//      changes) automatically instead of going stale until someone
//      remembers to click "Sync services".
// One provider failing (bad key, upstream hiccup) never blocks the
// others — each is caught independently.
import { getCollection } from "../mongo.ts";
import { pingOneProvider, SUPPORTED_HEALTH_KINDS } from "./health.ts";
import { syncProviderCatalog } from "./catalogSync.ts";

type ProviderDoc = { _id: string; name: string; kind?: string | null; config?: Record<string, unknown> | null; status: string };

let running = false; // re-entrancy guard — a slow upstream call must never let two sweeps overlap

export async function runProviderAutoSync(): Promise<void> {
  if (running) return;
  running = true;
  try {
    const providersCol = await getCollection<ProviderDoc>("providers");
    const rows = await providersCol.find({}).toArray();
    for (const p of rows) {
      const kind = (p.kind ?? "").toLowerCase();
      if (!SUPPORTED_HEALTH_KINDS.has(kind)) continue; // "custom" kind — nothing this scheduler can verify or sync
      try {
        const r = await pingOneProvider(kind);
        const status = r.ok ? "connected" : "error";
        await providersCol.updateOne({ _id: p._id }, { $set: { status, latencyMs: r.latencyMs, updatedAt: new Date() } });
        if (r.ok) {
          await syncProviderCatalog({ _id: p._id, name: p.name, kind, config: p.config ?? {} });
          await providersCol.updateOne({ _id: p._id }, { $set: { lastSyncAt: new Date() } });
        }
      } catch (err) {
        console.error(`[autoSync] ${p.name} (${kind}) failed:`, err instanceof Error ? err.message : err);
      }
    }
  } finally {
    running = false;
  }
}

/** Starts the recurring sweep. Runs once immediately (so a fresh deploy doesn't sit idle for a full interval) then every `intervalMs`. */
export function startProviderAutoSync(intervalMs = 2 * 60 * 1000): void {
  void runProviderAutoSync();
  setInterval(() => { void runProviderAutoSync(); }, intervalMs);
}
