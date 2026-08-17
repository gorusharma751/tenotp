import { createHmac, timingSafeEqual } from "crypto";
import { getCollection } from "./mongo.ts";
import { approveDeposit } from "./db/wallet.ts";

type AdminSecretDoc = { _id: string; value: unknown; updatedAt: Date };

export async function loadRazorpayCreds() {
  const secrets = await getCollection<AdminSecretDoc>("admin_secrets");
  const doc = await secrets.findOne({ _id: "razorpay" });
  const v = (doc?.value ?? {}) as { key_id?: string; key_secret?: string; enabled?: boolean };
  return {
    key_id: v.key_id || process.env.RAZORPAY_KEY_ID || "",
    key_secret: v.key_secret || process.env.RAZORPAY_KEY_SECRET || "",
    // Defaults to true when never explicitly set, so setups that saved keys
    // before this toggle existed keep working without any admin action.
    enabled: v.enabled ?? true,
  };
}

function safeEqualHex(a: string, b: string) {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  return left.length === right.length && timingSafeEqual(left, right);
}

async function fetchRazorpay<T>(
  path: string,
  keyId: string,
  keySecret: string,
  init?: RequestInit,
): Promise<T> {
  const auth = Buffer.from(`${keyId}:${keySecret}`).toString("base64");
  const res = await fetch(`https://api.razorpay.com/v1${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Basic ${auth}`,
      ...(init?.headers ?? {}),
    },
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Razorpay verification failed: ${res.status} ${body.slice(0, 140)}`);
  }
  return (await res.json()) as T;
}

export async function createRazorpayOrder(userId: string, amount: number) {
  const { key_id: keyId, key_secret: keySecret } = await loadRazorpayCreds();
  if (!keyId || !keySecret) {
    throw new Error("Razorpay is not configured yet. Please contact admin.");
  }
  const res = await fetch("https://api.razorpay.com/v1/orders", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Basic ${Buffer.from(`${keyId}:${keySecret}`).toString("base64")}`,
    },
    body: JSON.stringify({
      amount: amount * 100,
      currency: "INR",
      receipt: `dep_${userId.slice(0, 8)}_${Date.now()}`,
      notes: { user_id: userId, amount_inr: String(amount) },
    }),
  });
  if (!res.ok) {
    const t = await res.text().catch(() => "");
    throw new Error(`Razorpay order failed: ${res.status} ${t.slice(0, 120)}`);
  }
  const order = (await res.json()) as { id: string; amount: number; currency: string };
  return {
    order_id: order.id,
    amount: order.amount,
    currency: order.currency,
    key_id: keyId,
  };
}

export async function verifyRazorpayPayment(
  userId: string,
  data: { razorpay_order_id: string; razorpay_payment_id: string; razorpay_signature: string },
) {
  const { key_id: keyId, key_secret: keySecret } = await loadRazorpayCreds();
  if (!keyId || !keySecret) throw new Error("Razorpay is not configured yet. Please contact admin.");

  const expected = createHmac("sha256", keySecret)
    .update(`${data.razorpay_order_id}|${data.razorpay_payment_id}`)
    .digest("hex");
  if (!safeEqualHex(data.razorpay_signature, expected))
    throw new Error("Invalid Razorpay payment signature");

  type RazorpayOrder = {
    id: string;
    amount: number;
    currency: string;
    notes?: Record<string, string>;
  };
  type RazorpayPayment = {
    id: string;
    order_id: string;
    amount: number;
    currency: string;
    status: string;
  };
  const [order, payment] = await Promise.all([
    fetchRazorpay<RazorpayOrder>(`/orders/${data.razorpay_order_id}`, keyId, keySecret),
    fetchRazorpay<RazorpayPayment>(`/payments/${data.razorpay_payment_id}`, keyId, keySecret),
  ]);

  if (payment.order_id !== order.id) throw new Error("Payment does not match this order");
  if (order.notes?.user_id !== userId) throw new Error("Payment belongs to another user");
  if (order.currency !== "INR" || payment.currency !== "INR")
    throw new Error("Only INR Razorpay payments are supported");
  if (payment.status !== "captured" && payment.status !== "authorized")
    throw new Error(`Payment is ${payment.status}, not completed`);
  const amount = Math.round((Math.min(Number(order.amount), Number(payment.amount)) / 100) * 100) / 100;
  if (!Number.isFinite(amount) || amount <= 0) throw new Error("Invalid payment amount");

  type DepositDoc = {
    _id: string;
    userId: string;
    amount: number;
    method: string;
    currency: string;
    network: string | null;
    utr: string | null;
    screenshotUrl: string | null;
    status: string;
    adminNote: string | null;
    approvedBy: string | null;
    approvedAt: Date | null;
    createdAt: Date;
  };
  const deposits = await getCollection<DepositDoc>("deposits");
  const existing = await deposits.findOne({ utr: data.razorpay_payment_id });

  const users = await getCollection<{ _id: string; walletBalance: number }>("users");
  if (existing) {
    const user = await users.findOne({ _id: userId });
    return {
      ok: true,
      credited: false,
      balance: Number(user?.walletBalance ?? 0),
      deposit_id: existing._id,
    };
  }

  const depositId = crypto.randomUUID();
  await deposits.insertOne({
    _id: depositId,
    userId,
    amount,
    method: "Razorpay",
    currency: "INR",
    network: null,
    utr: data.razorpay_payment_id,
    screenshotUrl: null,
    status: "pending",
    adminNote: `Razorpay verified · order ${data.razorpay_order_id}`,
    approvedBy: null,
    approvedAt: null,
    createdAt: new Date(),
  });

  // Wallet credit always goes through the transactional money engine.
  const newBalance = await approveDeposit(depositId);

  // Best-effort admin-visible payment log — mirrors the legacy `payments` table.
  try {
    const payments = await getCollection("payments");
    await payments.insertOne({
      _id: crypto.randomUUID(),
      userId,
      method: "Razorpay",
      amount,
      status: "completed",
      reference: data.razorpay_payment_id,
      createdAt: new Date(),
    } as never);
  } catch {
    /* best-effort */
  }

  return { ok: true, credited: true, balance: newBalance, amount, deposit_id: depositId };
}

export async function getRazorpayConfig() {
  const c = await loadRazorpayCreds();
  // Customer-facing: only live when BOTH keys exist AND the admin toggle is on.
  return { enabled: Boolean(c.key_id && c.key_secret) && c.enabled };
}

function mask(s: string) {
  if (!s) return "";
  if (s.length <= 8) return "•".repeat(s.length);
  return s.slice(0, 4) + "•".repeat(Math.max(4, s.length - 8)) + s.slice(-4);
}

export async function getRazorpayAdminStatus() {
  const c = await loadRazorpayCreds();
  return {
    configured: Boolean(c.key_id && c.key_secret),
    enabled: c.enabled,
    key_id_masked: mask(c.key_id),
    key_secret_masked: mask(c.key_secret),
  };
}

export async function saveRazorpayConfig(data: { key_id?: string; key_secret?: string; enabled?: boolean }) {
  const existing = await loadRazorpayCreds();
  // Keys are optional on this call — a bare toggle flip (enable/disable)
  // shouldn't require re-pasting both secrets every time. Only validate
  // format when a non-empty value is actually being changed.
  const key_id = data.key_id?.trim() ? data.key_id.trim() : existing.key_id;
  const key_secret = data.key_secret?.trim() ? data.key_secret.trim() : existing.key_secret;
  if (data.key_id?.trim() && !key_id.startsWith("rzp_")) throw new Error("key_id must start with rzp_");
  if (data.key_secret?.trim() && key_secret.length < 10) throw new Error("Invalid key_secret");
  const enabled = data.enabled ?? existing.enabled;
  if (enabled && !(key_id && key_secret)) {
    throw new Error("Add your Razorpay Key ID and Key Secret before enabling it");
  }
  const secrets = await getCollection<AdminSecretDoc>("admin_secrets");
  await secrets.updateOne(
    { _id: "razorpay" },
    {
      $set: {
        value: { key_id, key_secret, enabled },
        updatedAt: new Date(),
      },
    },
    { upsert: true },
  );
  return { ok: true };
}
