// Real connectivity check for the 5 built-in sms-activate-style provider
// kinds — a live getBalance() call, the same "does this credential
// actually work" probe used by the admin health-check/test/ping-all
// routes (routes/providers.ts) and the background auto-sync scheduler
// (lib/providers/autoSync.ts). Extracted here so both share one
// implementation instead of drifting.
import { getSmsClientByKind } from "../grizzly.ts";

export const SUPPORTED_HEALTH_KINDS = new Set(["grizzlysms", "tigersms", "smsbower", "sastasms", "fivesim"]);

async function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  return await Promise.race([p, new Promise<T>((_, rej) => setTimeout(() => rej(new Error(`timeout after ${ms}ms`)), ms))]);
}

export async function pingOneProvider(kind: string): Promise<{ ok: boolean; balance: number | null; message: string; latencyMs: number }> {
  const { client, label } = getSmsClientByKind(kind);
  const t0 = Date.now();
  try {
    const r = await withTimeout(client.getBalance(), 8000);
    const latencyMs = Date.now() - t0;
    const bal = (r as { balance: number | null }).balance;
    if (bal === null || Number.isNaN(bal)) return { ok: false, balance: null, message: `${label}: invalid balance response`, latencyMs };
    return { ok: true, balance: bal, message: "OK", latencyMs };
  } catch (e) {
    return { ok: false, balance: null, message: (e as Error).message, latencyMs: Date.now() - t0 };
  }
}
