// Real, computed provider performance stats — replaces two previously-fake
// fields that misled admins:
//   - successRate: used to be a `config.successRate` field nothing ever
//     wrote to (always 0, or hand-faked to a flat 95% on public pages).
//   - avgSpeedSec: used to be hardcoded to `null` in every /otp/services
//     response, so the "sort fastest first" / "⚡ Xs avg" UI in
//     buy-number.tsx was permanently dead code.
// Both are now backed by real order data: successRate from a live
// aggregation over the orders collection, avgSpeedSec from an incremental
// rolling average recorded every time otp.ts's /status route actually
// observes an OTP arrive for an order.
import { getCollection } from "../mongo.ts";

type OrderStatusDoc = { providerId?: string | null; status: string };

/**
 * successRate = received / (received + refunded + cancelled + expired),
 * i.e. of the orders that reached a final outcome, what fraction actually
 * delivered an OTP. Still-"pending" (in-flight) orders are excluded so a
 * burst of very recent purchases doesn't drag the rate down before they've
 * even had a chance to complete.
 */
export async function computeProviderSuccessRates(): Promise<Map<string, { successRate: number; total: number }>> {
  const orders = await getCollection<OrderStatusDoc>("orders");
  const rows = await orders
    .aggregate<{ _id: string; received: number; failed: number }>([
      { $match: { providerId: { $ne: null }, status: { $in: ["received", "refunded", "cancelled", "expired"] } } },
      { $group: { _id: "$providerId", received: { $sum: { $cond: [{ $eq: ["$status", "received"] }, 1, 0] } }, failed: { $sum: { $cond: [{ $ne: ["$status", "received"] }, 1, 0] } } } },
    ])
    .toArray();
  const out = new Map<string, { successRate: number; total: number }>();
  for (const r of rows) {
    const total = r.received + r.failed;
    out.set(r._id, { successRate: total > 0 ? Math.round((r.received / total) * 100) : 0, total });
  }
  return out;
}

const MAX_REASONABLE_SPEED_SEC = 900; // ignore >15min outliers (stuck/slow-poll artifacts) so they don't skew the average
const ROLLING_WEIGHT_CAP = 500; // once enough samples land, treat it as an EMA so the average tracks recent performance instead of being permanently diluted by history

/**
 * Called right when otp.ts's /status route sees an OTP actually arrive for
 * an order — records how long that took (order creation → OTP received)
 * into the provider's rolling average delivery speed.
 */
export async function recordProviderSpeed(providerId: string, seconds: number): Promise<void> {
  if (!providerId || !Number.isFinite(seconds) || seconds <= 0) return;
  const capped = Math.min(seconds, MAX_REASONABLE_SPEED_SEC);
  const providersCol = await getCollection<{ _id: string; config?: Record<string, unknown> | null }>("providers");
  const provider = await providersCol.findOne({ _id: providerId }, { projection: { config: 1 } });
  if (!provider) return;
  const prevAvg = Number(provider.config?.avgSpeedSec);
  const prevCount = Number(provider.config?.speedSampleCount) || 0;
  const nextCount = Math.min(prevCount + 1, ROLLING_WEIGHT_CAP);
  const nextAvg = prevCount > 0 && Number.isFinite(prevAvg) ? prevAvg + (capped - prevAvg) / nextCount : capped;
  await providersCol.updateOne(
    { _id: providerId },
    { $set: { "config.avgSpeedSec": Number(nextAvg.toFixed(1)), "config.speedSampleCount": nextCount } },
  );
}
