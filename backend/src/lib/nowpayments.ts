// NOWPayments crypto gateway — the Razorpay-shaped flow for crypto:
// we create an invoice, they hand back a payment address + amount unique
// to THAT invoice, the user pays, and they call our webhook when it
// settles. Nothing about addresses is stored or managed here, and there's
// no "who sent this?" problem, because every invoice gets its own address.
//
// Money still moves only through approveDeposit, exactly like every other
// deposit method — this file is glue plus verification.
import crypto from "node:crypto";
import { getCollection } from "./mongo.ts";
import { approveDeposit } from "./db/wallet.ts";

const API_BASE = "https://api.nowpayments.io/v1";

export type NowPaymentsConfig = {
  enabled: boolean;
  api_key: string;
  /** Separate from the API key — used only to verify that a webhook
   * really came from NOWPayments. Set it in their dashboard too. */
  ipn_secret: string;
  /** What we charge in INR per 1 USD of invoice. Admin-set on purpose:
   * an automatic FX feed that glitches would move every price with it. */
  inr_per_usd: number;
  /** Which coin/network the invoice asks for, e.g. usdttrc20, usdtbsc. */
  pay_currency: string;
  min_inr: number;
};

const DEFAULTS: NowPaymentsConfig = {
  enabled: false, api_key: "", ipn_secret: "", inr_per_usd: 0,
  pay_currency: "usdttrc20", min_inr: 100,
};

export type NpSessionDoc = {
  _id: string;
  userId: string;
  paymentId: string;
  orderId: string;
  inrAmount: number;
  usdAmount: number;
  rate: number;
  payCurrency: string;
  payAddress: string | null;
  payAmount: number | null;
  status: "new" | "waiting" | "confirming" | "confirmed" | "sending" | "partially_paid" | "finished" | "failed" | "refunded" | "expired" | "crediting" | "paid";
  actuallyPaid: number | null;
  depositId: string | null;
  note: string | null;
  createdAt: Date;
  creditedAt: Date | null;
};

async function secretsCol() {
  return getCollection<{ _id: string; value: NowPaymentsConfig; updatedAt: Date }>("admin_secrets");
}
export async function loadNpConfig(): Promise<NowPaymentsConfig> {
  const row = await (await secretsCol()).findOne({ _id: "nowpayments" });
  return { ...DEFAULTS, ...(row?.value ?? {}) };
}
export async function patchNpConfig(patch: Partial<NowPaymentsConfig>): Promise<NowPaymentsConfig> {
  const value = { ...(await loadNpConfig()), ...patch };
  await (await secretsCol()).updateOne({ _id: "nowpayments" }, { $set: { value, updatedAt: new Date() } }, { upsert: true });
  return value;
}
export function isNpReady(cfg: NowPaymentsConfig): boolean {
  return cfg.enabled && Boolean(cfg.api_key) && cfg.inr_per_usd > 0;
}
export async function npSessionsCol() {
  return getCollection<NpSessionDoc>("nowpayments_sessions");
}

async function npFetch<T>(cfg: NowPaymentsConfig, path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: { "x-api-key": cfg.api_key, "Content-Type": "application/json", ...(init?.headers ?? {}) },
    signal: AbortSignal.timeout(20000),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((body as { message?: string })?.message || `NOWPayments error (${res.status})`);
  return body as T;
}

export async function npStatus(): Promise<{ ok: boolean; message: string }> {
  const cfg = await loadNpConfig();
  if (!cfg.api_key) return { ok: false, message: "No API key set" };
  try {
    const r = await npFetch<{ message?: string }>(cfg, "/status");
    return { ok: r.message === "OK", message: r.message ?? "unknown" };
  } catch (err) {
    return { ok: false, message: err instanceof Error ? err.message : "unreachable" };
  }
}

/** Creates an invoice. NOWPayments returns an address that belongs to this
 * invoice alone, which is what removes both the address bookkeeping and
 * the "which user does this deposit belong to?" ambiguity. */
export async function createNpPayment(userId: string, inrAmount: number, callbackUrl: string): Promise<NpSessionDoc> {
  const cfg = await loadNpConfig();
  if (!isNpReady(cfg)) throw new Error("Crypto payments aren't enabled yet");
  if (!Number.isFinite(inrAmount) || inrAmount < cfg.min_inr) throw new Error(`Minimum deposit is ₹${cfg.min_inr}`);

  const usdAmount = Number((inrAmount / cfg.inr_per_usd).toFixed(2));
  const orderId = `TEN${Date.now()}${Math.floor(Math.random() * 900 + 100)}`;

  const created = await npFetch<{
    payment_id: string | number; pay_address?: string; pay_amount?: number; pay_currency?: string; payment_status?: string;
  }>(cfg, "/payment", {
    method: "POST",
    body: JSON.stringify({
      price_amount: usdAmount,
      price_currency: "usd",
      pay_currency: cfg.pay_currency,
      order_id: orderId,
      order_description: `TenOTP wallet top-up ₹${inrAmount}`,
      ipn_callback_url: callbackUrl,
    }),
  });

  const doc: NpSessionDoc = {
    _id: crypto.randomUUID(),
    userId,
    paymentId: String(created.payment_id),
    orderId,
    inrAmount: Number(inrAmount.toFixed(2)),
    usdAmount,
    rate: cfg.inr_per_usd,
    payCurrency: created.pay_currency ?? cfg.pay_currency,
    payAddress: created.pay_address ?? null,
    payAmount: created.pay_amount ?? null,
    status: (created.payment_status as NpSessionDoc["status"]) ?? "waiting",
    actuallyPaid: null,
    depositId: null,
    note: null,
    createdAt: new Date(),
    creditedAt: null,
  };
  await (await npSessionsCol()).insertOne(doc);
  return doc;
}

/** Verifies a webhook really came from NOWPayments: HMAC-SHA512 over the
 * payload with keys sorted, keyed by the IPN secret. Without this anyone
 * who found the URL could POST "payment finished" and mint balance, so a
 * missing secret is treated as a hard failure rather than skipped. */
export function verifyIpnSignature(rawBody: unknown, signature: string, ipnSecret: string): boolean {
  if (!ipnSecret || !signature) return false;
  const sortDeep = (v: unknown): unknown => {
    if (Array.isArray(v)) return v.map(sortDeep);
    if (v && typeof v === "object") {
      return Object.keys(v as Record<string, unknown>)
        .sort()
        .reduce<Record<string, unknown>>((acc, k) => { acc[k] = sortDeep((v as Record<string, unknown>)[k]); return acc; }, {});
    }
    return v;
  };
  const expected = crypto.createHmac("sha512", ipnSecret).update(JSON.stringify(sortDeep(rawBody))).digest("hex");
  const a = Buffer.from(expected, "hex");
  const b = Buffer.from(signature, "hex");
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

/** Applies a status update (from a webhook, or from polling). Only
 * "finished" credits, and only once — the atomic claim plus the paid-state
 * check make a replayed webhook a no-op rather than a second credit. */
export async function applyNpUpdate(paymentId: string, status: string, actuallyPaid: number | null): Promise<{ credited: boolean; balance: number | null }> {
  const sessions = await npSessionsCol();
  const s = await sessions.findOne({ paymentId: String(paymentId) });
  if (!s) return { credited: false, balance: null };
  if (s.status === "paid") return { credited: true, balance: null };

  if (status !== "finished" && status !== "confirmed") {
    await sessions.updateOne({ _id: s._id }, { $set: { status: status as NpSessionDoc["status"], actuallyPaid } });
    return { credited: false, balance: null };
  }

  const claimed = await sessions.findOneAndUpdate(
    { _id: s._id, status: { $nin: ["paid", "crediting"] } },
    { $set: { status: "crediting", actuallyPaid } },
    { returnDocument: "after" },
  );
  if (!claimed) return { credited: true, balance: null };

  try {
    const deposits = await getCollection<{
      _id: string; userId: string; amount: number; method: string; currency: string; network: string | null;
      utr: string | null; screenshotUrl: string | null; status: string; adminNote: string | null;
      approvedBy: string | null; approvedAt: Date | null; createdAt: Date;
    }>("deposits");
    const depositId = crypto.randomUUID();
    await deposits.insertOne({
      _id: depositId, userId: s.userId, amount: s.inrAmount, method: "Crypto", currency: s.payCurrency.toUpperCase(),
      network: null, utr: s.paymentId, screenshotUrl: null, status: "pending",
      adminNote: `NOWPayments ${s.paymentId} · $${s.usdAmount} @ ₹${s.rate}`,
      approvedBy: null, approvedAt: null, createdAt: new Date(),
    });
    const balance = await approveDeposit(depositId);
    await sessions.updateOne({ _id: s._id }, { $set: { status: "paid", depositId, creditedAt: new Date(), note: `Credited via ${status}` } });
    return { credited: true, balance };
  } catch (err) {
    // Roll back so a retry (NOWPayments resends failed IPNs) can succeed
    // instead of the session being stuck half-credited.
    await sessions.updateOne({ _id: s._id }, { $set: { status: status as NpSessionDoc["status"] } });
    throw err;
  }
}

/** Polls NOWPayments for one session — the fallback for when a webhook
 * never arrives (their retries give up, or the server was asleep). */
export async function refreshNpSession(sessionId: string, userId: string): Promise<{ status: string; credited: boolean; balance: number | null }> {
  const sessions = await npSessionsCol();
  const s = await sessions.findOne({ _id: sessionId });
  if (!s) throw new Error("Payment not found");
  if (s.userId !== userId) throw new Error("Forbidden");
  if (s.status === "paid") return { status: "paid", credited: true, balance: null };

  const cfg = await loadNpConfig();
  const r = await npFetch<{ payment_status?: string; actually_paid?: number }>(cfg, `/payment/${s.paymentId}`);
  const out = await applyNpUpdate(s.paymentId, r.payment_status ?? "waiting", r.actually_paid ?? null);
  return { status: r.payment_status ?? "waiting", credited: out.credited, balance: out.balance };
}
