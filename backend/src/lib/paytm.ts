// Paytm Business (Dynamic QR) helpers — server only.
// Docs: https://business.paytm.com/docs/api/create-dynamic-qr-code/
//       https://business.paytm.com/docs/api/v3-order-status/
import { createHash, createCipheriv, createDecipheriv, randomBytes } from "crypto";
import { getCollection } from "./mongo.ts";
import { approveDeposit } from "./db/wallet.ts";

const IV = "@@@@&&&&####$$$$";

export interface PaytmConfig {
  mid: string;
  merchant_key: string;
  env: "production" | "staging";
  enabled: boolean;
  qr_ttl_minutes: number;
  /** "gateway" = Paytm Business API (needs MID + key). "upi" = merchant UPI QR (no key needed). */
  mode: "gateway" | "upi";
  upi_id: string;
  payee_name: string;
  /** Shared token for the SMS/notification forwarder that auto-confirms UPI payments. */
  webhook_token: string;
  /** BharatPe merchant id (reference only — shown in admin + deposit notes). */
  merchant_id?: string;
  /** BharatPe dashboard access token — enables automatic transaction verification. */
  access_token?: string;
  /** BharatPe transactions API endpoint (overridable if BharatPe changes it). */
  api_url?: string;
  /** Admin-uploaded static merchant QR image (data URL or https URL). Shown instead of a generated QR. */
  qr_image_url?: string;
  token_status?: "not_configured" | BharatpeTokenStatus;
  token_message?: string;
  token_checked_at?: string;
  /** Show direct UPI-app launch buttons below the QR. Disabled by default because some merchant VPAs reject app deep links. */
  show_upi_apps?: boolean;
}

// The merchant dashboard's own transaction-history endpoint ("PAYMENT_QR"
// module) — reachable with just a Merchant ID + dashboard token, the same
// pattern used by BharatPe auto-verify UTR-matching integrations generally.
export const BHARATPE_DEFAULT_API_URL =
  "https://payments-tesseract.bharatpe.in/api/v1/merchant/transactions";

export const PAYTM_DEFAULTS: PaytmConfig = {
  mid: "",
  merchant_key: "",
  env: "production",
  enabled: false,
  qr_ttl_minutes: 5,
  mode: "upi",
  upi_id: "",
  payee_name: "TenOTP",
  webhook_token: "",
};

type AdminSecretDoc = { _id: string; value: unknown; updatedAt: Date };
type AppSettingDoc = { _id: string; value: unknown; updatedAt: Date };

async function adminSecrets() {
  return getCollection<AdminSecretDoc>("admin_secrets");
}

async function appSettings() {
  return getCollection<AppSettingDoc>("app_settings");
}

export function paytmHost(env: string) {
  return env === "staging" ? "https://securegw-stage.paytm.in" : "https://securegw.paytm.in";
}

function aesEncrypt(input: string, key: string) {
  const c = createCipheriv("aes-128-cbc", key.slice(0, 16), IV);
  return Buffer.concat([c.update(Buffer.from(input, "utf8")), c.final()]).toString("base64");
}

function aesDecrypt(input: string, key: string) {
  const d = createDecipheriv("aes-128-cbc", key.slice(0, 16), IV);
  return Buffer.concat([d.update(Buffer.from(input, "base64")), d.final()]).toString("utf8");
}

export function generateSignature(payload: string, key: string) {
  const salt = randomBytes(2).toString("hex"); // 4 chars
  const hash = createHash("sha256").update(`${payload}|${salt}`).digest("hex");
  return aesEncrypt(`${hash}${salt}`, key);
}

export function verifySignature(payload: string, key: string, signature: string) {
  try {
    const decrypted = aesDecrypt(signature, key);
    const salt = decrypted.slice(-4);
    const expected = createHash("sha256").update(`${payload}|${salt}`).digest("hex");
    return `${expected}${salt}` === decrypted;
  } catch {
    return false;
  }
}

export async function loadPaytmConfig(): Promise<PaytmConfig> {
  const secrets = await adminSecrets();
  const doc = await secrets.findOne({ _id: "paytm_business" });
  const v = (doc?.value ?? {}) as Partial<PaytmConfig>;
  return {
    mid: v.mid || "",
    merchant_key: v.merchant_key || "",
    env: v.env === "staging" ? "staging" : "production",
    enabled: Boolean(v.enabled),
    qr_ttl_minutes: Number(v.qr_ttl_minutes) > 0 ? Number(v.qr_ttl_minutes) : 5,
    mode: v.mode === "gateway" ? "gateway" : "upi",
    upi_id: v.upi_id || "",
    payee_name: v.payee_name || "TenOTP",
    webhook_token: v.webhook_token || "",
  };
}

export type QrProvider = "paytm" | "bharatpe";

/**
 * BharatPe merchant runs in UPI mode only (no gateway API) but reuses the exact
 * same unique-amount + forwarder-webhook auto-credit pipeline as Paytm.
 * Public bits (UPI ID, name, QR image) live in app_settings.payment_methods,
 * secrets (merchant id + webhook token) live in admin_secrets.bharatpe_merchant.
 */
export async function loadBharatpeConfig(): Promise<PaytmConfig> {
  const paytm = await ensureWebhookToken();
  const settings = await appSettings();
  const doc = await settings.findOne({ _id: "payment_methods" });
  const b = (((doc?.value ?? {}) as Record<string, unknown>).bharatpe ?? {}) as {
    enabled?: boolean;
    upi_id?: string;
    payee_name?: string;
    qr_url?: string;
  };
  const secrets = await adminSecrets();
  const secDoc = await secrets.findOne({ _id: "bharatpe_merchant" });
  const s = (secDoc?.value ?? {}) as Partial<PaytmConfig> & { merchant_id?: string };
  return {
    ...PAYTM_DEFAULTS,
    mode: "upi",
    enabled: Boolean(s.enabled ?? b.enabled),
    upi_id: String(s.upi_id || b.upi_id || ""),
    payee_name: String(s.payee_name || b.payee_name || "TenOTP"),
    merchant_id: String(s.merchant_id ?? ""),
    access_token: String(s.access_token ?? ""),
    api_url: String(s.api_url || BHARATPE_DEFAULT_API_URL),
    qr_image_url: String(s.qr_image_url || b.qr_url || ""),
    token_status: s.token_status,
    token_message: String(s.token_message ?? ""),
    token_checked_at: String(s.token_checked_at ?? ""),
    show_upi_apps: Boolean(s.show_upi_apps),
    qr_ttl_minutes: Number(s.qr_ttl_minutes) > 0 ? Number(s.qr_ttl_minutes) : paytm.qr_ttl_minutes,
    // BharatPe ka apna token; na ho to shared Paytm forwarder token chalega.
    webhook_token: String(s.webhook_token || paytm.webhook_token),
  };
}

/** Persists BharatPe merchant credentials (merchant id, token, UPI, live toggle). */
export async function patchBharatpeConfig(patch: Partial<PaytmConfig>) {
  const current = await loadBharatpeConfig();
  const value = { ...current, ...patch };
  const secrets = await adminSecrets();
  await secrets.updateOne(
    { _id: "bharatpe_merchant" },
    { $set: { value, updatedAt: new Date() } },
    { upsert: true },
  );
  return value;
}

export interface BharatpeTxn {
  amount: number;
  utr: string;
  status: string;
  at: string;
}

export type BharatpeTokenStatus = "working" | "expired" | "invalid" | "unavailable";

export class BharatpeApiError extends Error {
  status: BharatpeTokenStatus;

  constructor(message: string, status: BharatpeTokenStatus) {
    super(message);
    this.name = "BharatpeApiError";
    this.status = status;
  }
}

function normalizeBharatpeApiUrl(value: string) {
  const raw = value.trim();
  let parsed: URL;
  try {
    parsed = new URL(raw);
  } catch {
    throw new BharatpeApiError("BharatPe Transactions API URL is invalid", "unavailable");
  }
  if (parsed.protocol !== "https:" || parsed.username || parsed.password) {
    throw new BharatpeApiError(
      "BharatPe Transactions API URL must be a secure https URL",
      "unavailable",
    );
  }
  return parsed.toString();
}

function normalizeBharatpeToken(value: string) {
  let token = value.trim();
  if (!token) return "";
  try {
    const parsed = JSON.parse(token) as unknown;
    if (typeof parsed === "string") token = parsed.trim();
    else if (parsed && typeof parsed === "object") {
      const record = parsed as Record<string, unknown>;
      const candidate = record.accessToken ?? record.access_token ?? record.token;
      if (typeof candidate === "string") token = candidate.trim();
    }
  } catch {
    // Plain tokens are expected most of the time.
  }
  token = token
    .replace(/^bearer\s+/i, "")
    .replace(/^['"]|['"]$/g, "")
    .trim();
  return token;
}

function bharatpeFailure(json: Record<string, unknown> | null | undefined, httpStatus: number) {
  const code = String(json?.responseCode ?? json?.code ?? json?.statusCode ?? httpStatus);
  const message = String(json?.responseMessage ?? json?.message ?? json?.error ?? "");
  const joined = `${code} ${message}`.toLowerCase();
  if (httpStatus === 401 || /token.*expir|session.*expir/.test(joined)) {
    return new BharatpeApiError("BharatPe access token has expired or is unauthorized", "expired");
  }
  if (/invalid.*token|token.*invalid/.test(joined)) {
    return new BharatpeApiError("BharatPe access token is invalid", "invalid");
  }
  if (httpStatus === 403) {
    return new BharatpeApiError(
      message || "BharatPe denied transaction access; check Merchant ID and API permissions",
      "unavailable",
    );
  }
  if (httpStatus >= 400 || /\bfail(?:ed|ure)?\b|\berror\b/.test(joined)) {
    return new BharatpeApiError(
      message || `BharatPe API request failed (HTTP ${httpStatus})`,
      "unavailable",
    );
  }
  return null;
}

// Field names that unambiguously mean "this is the transaction list" even
// when it's empty — e.g. BharatPe's own `data.transactions: []` on a
// brand-new/unused QR, which has no rows yet to shape-sniff.
const KNOWN_TRANSACTION_LIST_KEYS = new Set(["transactions", "txns", "transactionlist", "records"]);

function transactionArrayFrom(value: unknown, keyHint?: string): Record<string, unknown>[] | null {
  if (Array.isArray(value)) {
    const rows = value.filter(
      (item): item is Record<string, unknown> => Boolean(item) && typeof item === "object",
    );
    if (value.length === 0 && keyHint && KNOWN_TRANSACTION_LIST_KEYS.has(keyHint.toLowerCase())) {
      return [];
    }
    const looksLikeTransactions = rows.some((row) =>
      [
        "amount",
        "txnAmount",
        "transactionAmount",
        "payAmount",
        "utr",
        "rrn",
        "txnId",
        "transactionId",
      ].some((key) => key in row),
    );
    return looksLikeTransactions ? rows : null;
  }
  if (!value || typeof value !== "object") return null;
  for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
    const found = transactionArrayFrom(child, key);
    if (found) return found;
  }
  return null;
}

function numericAmount(value: unknown) {
  if (value && typeof value === "object") {
    const record = value as Record<string, unknown>;
    return numericAmount(record.value ?? record.amount ?? record.rupees);
  }
  const parsed = Number(String(value ?? "0").replace(/[^0-9.-]/g, ""));
  return Number.isFinite(parsed) ? parsed : 0;
}

function transactionAmount(t: Record<string, unknown>) {
  const paise = numericAmount(t.amountInPaise ?? t.amount_in_paise ?? t.txnAmountInPaise);
  if (paise > 0) return paise / 100;
  return numericAmount(
    t.amount ??
      t.txnAmount ??
      t.transactionAmount ??
      t.payAmount ??
      t.amountInRupees ??
      t.creditAmount,
  );
}

function transactionTime(value: unknown) {
  if (typeof value === "number" || /^\d{10,13}$/.test(String(value ?? ""))) {
    const n = Number(value);
    return new Date(n < 10_000_000_000 ? n * 1000 : n).toISOString();
  }
  return String(value ?? "");
}

/** Pulls recent merchant transactions from BharatPe using the dashboard access token. */
export async function fetchBharatpeTransactions(cfg: PaytmConfig): Promise<BharatpeTxn[]> {
  const token = normalizeBharatpeToken(String(cfg.access_token ?? ""));
  if (!token) throw new BharatpeApiError("BharatPe access token is not configured", "invalid");
  const normalizedUrl = normalizeBharatpeApiUrl(String(cfg.api_url || BHARATPE_DEFAULT_API_URL));
  const requestUrl = new URL(normalizedUrl);
  const merchantId = String(cfg.merchant_id ?? "").trim();
  if (!merchantId) throw new BharatpeApiError("BharatPe Merchant ID is not configured", "invalid");
  // Some dashboard versions read the MID from the query string, others from headers.
  if (merchantId && !requestUrl.searchParams.has("merchantId"))
    requestUrl.searchParams.set("merchantId", merchantId);
  // The default endpoint is the "PAYMENT_QR" module's transaction history,
  // scoped to a date range — default to the last 2 days if not already set
  // (an admin-overridden api_url may not need/want these, so only fill gaps).
  if (!requestUrl.searchParams.has("module")) requestUrl.searchParams.set("module", "PAYMENT_QR");
  if (!requestUrl.searchParams.has("sDate") || !requestUrl.searchParams.has("eDate")) {
    const now = new Date();
    const start = new Date(now.getTime() - 2 * 24 * 60 * 60_000);
    const ymd = (d: Date) => d.toISOString().slice(0, 10);
    requestUrl.searchParams.set("sDate", ymd(start));
    requestUrl.searchParams.set("eDate", ymd(now));
  }
  let res: Response;
  try {
    res = await fetch(requestUrl.toString(), {
      method: "GET",
      signal: AbortSignal.timeout(8_000),
      headers: {
        Accept: "application/json",
        token,
        "x-access-token": token,
        Authorization: `Bearer ${token}`,
        ...(merchantId
          ? {
              merchantId,
              "merchant-id": merchantId,
              "x-merchant-id": merchantId,
            }
          : {}),
      },
    });
  } catch {
    throw new BharatpeApiError("Could not connect to BharatPe Transactions API", "unavailable");
  }
  const text = await res.text();
  let json: Record<string, unknown>;
  try {
    json = JSON.parse(text);
  } catch {
    throw new BharatpeApiError("BharatPe API returned an unexpected response", "unavailable");
  }
  const failure = bharatpeFailure(json, res.status);
  if (failure) throw failure;

  // Dashboard response envelopes change often; locate the transaction-shaped array recursively.
  const list = transactionArrayFrom(json);
  if (!list) {
    throw new BharatpeApiError(
      "BharatPe responded, but this API URL did not return a transaction list",
      "unavailable",
    );
  }

  return list
    .map((t) => ({
      amount: transactionAmount(t),
      utr: String(
        t?.utr ??
          t?.utrNumber ??
          t?.rrn ??
          t?.bankReferenceNo ??
          t?.txnId ??
          t?.transactionId ??
          t?.referenceId ??
          "",
      ).trim(),
      status: String(
        t?.status ?? t?.txnStatus ?? t?.transactionStatus ?? t?.paymentStatus ?? "SUCCESS",
      ).toUpperCase(),
      at: transactionTime(
        t?.createdAt ??
          t?.created_at ??
          t?.transactionDate ??
          t?.transactionTime ??
          t?.txnDate ??
          t?.date ??
          t?.timestamp,
      ),
    }))
    .filter((t) => t.amount > 0);
}

/** Finds a successful BharatPe credit whose amount matches the pending session exactly. */
export async function findBharatpeCredit(
  cfg: PaytmConfig,
  amount: number,
  createdAt?: string,
  expectedUtr?: string,
) {
  const txns = await fetchBharatpeTransactions(cfg);
  const wantedUtr = String(expectedUtr ?? "")
    .replace(/\W/g, "")
    .toLowerCase();
  const sessionStart = createdAt ? new Date(createdAt).getTime() - 5 * 60_000 : 0;
  const hit = txns.find((t) => {
    // Some dashboard responses label paise as a generic `amount`; accept both
    // units while explicit amountInPaise fields are normalized during parsing.
    const amountMatches =
      Math.abs(t.amount - amount) < 0.005 || Math.abs(t.amount / 100 - amount) < 0.005;
    if (!amountMatches || /FAIL|PENDING|REFUND|REVERS|DECLIN/.test(t.status)) return false;
    const txnUtr = t.utr.replace(/\W/g, "").toLowerCase();
    if (wantedUtr && txnUtr && txnUtr !== wantedUtr) return false;
    if (!sessionStart || !t.at) return true;
    const txnTime = new Date(t.at).getTime();
    return !Number.isFinite(txnTime) || txnTime >= sessionStart;
  });
  return hit ?? null;
}

export async function saveBharatpeTokenStatus(status: BharatpeTokenStatus, message: string) {
  return patchBharatpeConfig({
    token_status: status,
    token_message: message.slice(0, 240),
    token_checked_at: new Date().toISOString(),
  });
}

/** The forwarder webhook needs a token even if Paytm itself was never configured. */
export async function ensureWebhookToken(): Promise<PaytmConfig> {
  const cfg = await loadPaytmConfig();
  if (cfg.webhook_token) return cfg;
  return patchPaytmConfig({ webhook_token: crypto.randomUUID().replace(/-/g, "") });
}

export async function loadQrConfig(provider: QrProvider): Promise<PaytmConfig> {
  return provider === "bharatpe" ? loadBharatpeConfig() : loadPaytmConfig();
}

/** Persists a partial config patch without touching the other fields. */
export async function patchPaytmConfig(patch: Partial<PaytmConfig>) {
  const current = await loadPaytmConfig();
  const value = { ...current, ...patch };
  const secrets = await adminSecrets();
  await secrets.updateOne(
    { _id: "paytm_business" },
    { $set: { value, updatedAt: new Date() } },
    { upsert: true },
  );
  return value;
}

/** True when the chosen mode has everything it needs to accept payments. */
export function isPaytmReady(cfg: PaytmConfig) {
  return cfg.mode === "gateway" ? Boolean(cfg.mid && cfg.merchant_key) : Boolean(cfg.upi_id);
}

/** Builds a standard UPI intent link for merchant VPAs without inventing bank-issued fields. */
export function buildUpiLink(cfg: PaytmConfig, orderId: string, amount: number) {
  // mc/tid/mode/tr are merchant-acquirer issued values. Sending our own order
  // id as `tr` makes strict UPI apps reject an otherwise valid merchant VPA.
  // The unique amount identifies the session, so no synthetic `tr` is needed.
  const enc = (v: string) => encodeURIComponent(v);
  const ref = orderId.replace(/[^A-Za-z0-9]/g, "").slice(0, 35);
  const parts = [
    `pa=${enc(cfg.upi_id)}`,
    `pn=${enc((cfg.payee_name || "TenOTP").replace(/[^A-Za-z0-9 ]/g, "").trim() || "TenOTP")}`,
    `tn=${enc(`Wallet ${ref}`)}`,
    `am=${amount.toFixed(2)}`,
    `cu=INR`,
  ];
  return `upi://pay?${parts.join("&")}`;
}

export type PaytmSessionDoc = {
  _id: string;
  userId: string;
  orderId: string;
  amount: number;
  qrData: string | null;
  qrImage: string | null;
  qrCodeId: string | null;
  status: "pending" | "utr_submitted" | "paid" | "expired" | "failed";
  txnId: string | null;
  utr: string | null;
  depositId: string | null;
  note: string | null;
  expiresAt: Date;
  creditedAt: Date | null;
  createdAt: Date;
  provider: "paytm" | "bharatpe";
};

async function paytmSessionsCol() {
  return getCollection<PaytmSessionDoc>("paytm_sessions");
}

/**
 * Gives every pending QR a unique paise suffix so an incoming UPI credit
 * can be matched back to exactly one user without any gateway API.
 */
export async function uniqueUpiAmount(base: number) {
  const col = await paytmSessionsCol();
  const rows = await col
    .find({ status: { $in: ["pending", "utr_submitted"] }, expiresAt: { $gte: new Date() } })
    .project({ amount: 1 })
    .toArray();
  const taken = new Set(rows.map((r) => Number((r as { amount: number }).amount).toFixed(2)));
  for (let i = 0; i < 99; i++) {
    const candidate = Number((base + (i + 1) / 100).toFixed(2));
    if (!taken.has(candidate.toFixed(2))) return candidate;
  }
  return Number((base + Math.random()).toFixed(2));
}

/** Finds the one live pending UPI session that matches an incoming credit amount. */
export async function matchPendingUpiSession(amount: number) {
  const col = await paytmSessionsCol();
  const rows = await col
    .find({
      status: { $in: ["pending", "utr_submitted"] },
      expiresAt: { $gte: new Date(Date.now() - 30 * 60_000) },
    })
    .sort({ createdAt: -1 })
    .toArray();
  const matches = rows.filter((r) => Math.abs(Number(r.amount) - amount) < 0.005);
  return matches.length === 1 ? matches[0] : null;
}

async function paytmPost(cfg: PaytmConfig, path: string, body: Record<string, unknown>) {
  const payload = JSON.stringify(body);
  const signature = generateSignature(payload, cfg.merchant_key);
  const res = await fetch(`${paytmHost(cfg.env)}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ head: { clientId: "C11", version: "v1", signature }, body }),
  });
  const text = await res.text();
  try {
    // Paytm's response shape is dynamic/undocumented beyond resultInfo — same
    // escape hatch the pre-migration code used here.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return JSON.parse(text) as { head?: Record<string, unknown>; body?: Record<string, any> };
  } catch {
    throw new Error(`Paytm returned an unexpected response (${res.status})`);
  }
}

export async function createDynamicQr(cfg: PaytmConfig, orderId: string, amount: number) {
  const r = await paytmPost(cfg, "/paymentservices/qr/create", {
    mid: cfg.mid,
    orderId,
    amount: amount.toFixed(2),
    businessType: "UPI_QR_CODE",
    posId: "TENOTP",
    displayName: "TenOTP",
  });
  const b = r.body ?? {};
  const status = String(b?.resultInfo?.resultStatus ?? "");
  if (status !== "SUCCESS") {
    throw new Error(String(b?.resultInfo?.resultMsg ?? "Could not create Paytm QR"));
  }
  return {
    qrData: String(b.qrData ?? ""),
    image: String(b.image ?? ""),
    qrCodeId: String(b.qrCodeId ?? ""),
  };
}

export async function fetchPaytmOrderStatus(cfg: PaytmConfig, orderId: string) {
  const r = await paytmPost(cfg, "/v3/order/status", { mid: cfg.mid, orderId });
  const b = r.body ?? {};
  const resultStatus = String(b?.resultInfo?.resultStatus ?? "PENDING");
  return {
    resultStatus,
    resultMsg: String(b?.resultInfo?.resultMsg ?? ""),
    txnId: b.txnId ? String(b.txnId) : null,
    txnAmount: b.txnAmount != null ? Number(b.txnAmount) : null,
    bankTxnId: b.bankTxnId ? String(b.bankTxnId) : null,
  };
}

// Credits a Paytm/BharatPe session's amount to the user's wallet exactly once.
// The wallet credit itself always goes through db/wallet.ts's approveDeposit
// transaction — this function only (a) atomically claims the session via a
// compare-and-swap on its status, then (b) records + approves a deposit.
export async function creditPaytmSession(
  sessionId: string,
  txnId: string,
  note: string,
): Promise<number> {
  const sessions = await paytmSessionsCol();
  const s = await sessions.findOne({ _id: sessionId });
  if (!s) throw new Error("Payment session not found");

  const users = await getCollection<{ _id: string; walletBalance: number }>("users");

  if (s.status === "paid") {
    const user = await users.findOne({ _id: s.userId });
    return Number(user?.walletBalance ?? 0);
  }

  const cleanTxnId = txnId.trim();
  if (cleanTxnId) {
    const duplicate = await sessions.findOne({
      txnId: cleanTxnId,
      status: "paid",
      _id: { $ne: sessionId },
    });
    if (duplicate) throw new Error("This payment reference has already been credited");
  }

  const methodLabel = s.provider === "bharatpe" ? "BharatPe" : "Paytm";

  // Atomic guard: only one caller can flip a given session from non-paid to paid.
  const claimed = await sessions.findOneAndUpdate(
    { _id: sessionId, status: { $ne: "paid" } },
    { $set: { status: "paid", txnId, creditedAt: new Date(), note } },
    { returnDocument: "after" },
  );
  if (!claimed) {
    // Someone else credited it concurrently.
    const user = await users.findOne({ _id: s.userId });
    return Number(user?.walletBalance ?? 0);
  }

  const amount = Number(s.amount);
  const depositsCol = await getCollection<{
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
  }>("deposits");
  const depositId = crypto.randomUUID();
  await depositsCol.insertOne({
    _id: depositId,
    userId: s.userId,
    amount,
    method: methodLabel,
    currency: "INR",
    network: null,
    utr: txnId,
    screenshotUrl: null,
    status: "pending",
    adminNote: note,
    approvedBy: null,
    approvedAt: null,
    createdAt: new Date(),
  });

  const newBalance = await approveDeposit(depositId);

  await sessions.updateOne({ _id: sessionId }, { $set: { depositId } });

  // Best-effort admin-visible payment log — mirrors the legacy `payments` table.
  try {
    const payments = await getCollection("payments");
    await payments.insertOne({
      _id: crypto.randomUUID(),
      userId: s.userId,
      method: methodLabel,
      amount,
      status: "completed",
      reference: txnId,
      createdAt: new Date(),
    } as never);
  } catch {
    /* best-effort */
  }

  return newBalance;
}

export function maskSecret(s: string) {
  if (!s) return "";
  if (s.length <= 6) return "•".repeat(s.length);
  return `${s.slice(0, 3)}${"•".repeat(Math.max(4, s.length - 6))}${s.slice(-3)}`;
}
