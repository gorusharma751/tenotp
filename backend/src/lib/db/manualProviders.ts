// Manual Provider module — atomic money operations, mirroring wallet.ts's
// pattern exactly (single MongoDB multi-document transaction per money
// event: balance check-then-debit/credit + a ledger insert, so a crash
// mid-operation can never happen). This module NEVER touches
// users.walletBalance directly except through the same optimistic-lock
// findOneAndUpdate style purchaseOtp/refundOrder already use — no second,
// conflicting wallet implementation.
//
// Two separate ledgers exist on purpose:
//   - wallet_tx (existing, unchanged shape) — the BUYER's money: debited
//     when a request is created, refunded if it's cancelled/fails.
//   - manual_provider_transactions (new) — the SELLER's earnings: entirely
//     separate from any user's wallet balance, per the spec's explicit
//     "do not create another wallet system for users" / "seller-specific
//     ledger" requirement. Settling a provider never moves money through
//     users.walletBalance at all — it's an internal bookkeeping record of
//     what the platform owes the seller, paid out externally.
import type { ClientSession } from "mongodb";
import { getMongoClient, getCollection } from "../mongo.ts";
import type { UserDoc } from "../types.ts";
import type { WalletTxDoc } from "./wallet.ts";

async function withMoneyTransaction<T>(fn: (session: ClientSession) => Promise<T>): Promise<T> {
  const client = await getMongoClient();
  const session = client.startSession();
  try {
    let result: T;
    await session.withTransaction(async () => {
      result = await fn(session);
    });
    return result!;
  } finally {
    await session.endSession();
  }
}

export type ManualProviderDoc = {
  _id: string;
  userId: string; // owning user account — the seller logs in with their normal TenOTP account, "provider" is just an extra role on it
  companyName: string;
  contactPhone?: string | null;
  country?: string | null;
  // Where admin actually sends money when a settlement is marked paid —
  // purely informational (this app never auto-transfers money out), but
  // without it there was no record anywhere of where a seller wants to be
  // paid, so admin had to ask separately every time.
  upiId?: string | null;
  bankAccountName?: string | null;
  bankAccountNumber?: string | null;
  bankIfsc?: string | null;
  status: "active" | "disabled";
  online: boolean;
  priority: number; // higher = preferred in ranking, admin-configurable
  pendingBalance: number; // earned, not yet settled
  availableBalance: number; // settled/approved, awaiting payout confirmation
  totalEarnings: number; // lifetime, monotonic
  totalPaidOut: number; // lifetime, monotonic
  completedRequests: number;
  failedRequests: number;
  avgRating: number | null;
  ratingCount: number;
  createdAt: Date;
  updatedAt: Date;
};

export type ManualProviderServiceDoc = {
  _id: string;
  providerId: string;
  service: string;
  country: string;
  // null = "ask for a price" — the seller hasn't fixed a rate for this
  // service yet; a buyer can still request it, and the seller quotes a
  // price on that specific request (see submitQuote / acceptQuote below)
  // instead of it being pre-set here.
  price: number | null;
  marginOverridePercent?: number | null; // null = use global default
  status: "active" | "disabled"; // admin/provider can disable a listing entirely
  availability: "available" | "busy" | "offline";
  /** How many real numbers the seller actually has on hand for this
   * service — purely informational for the buyer ("12 numbers
   * available"), not deducted per-order (capacity below is what actually
   * limits concurrent in-flight requests). */
  stock: number;
  capacity: number; // max concurrent in-flight requests
  priority: number;
  completedRequests: number;
  failedRequests: number;
  avgResponseSec: number | null;
  responseSampleCount: number;
  lastActiveAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

export type ManualProviderRequestTimelineEntry = { status: string; at: Date; note?: string | null; by?: string | null };

export type ManualProviderRequestDoc = {
  _id: string;
  code: string; // human-friendly "MP-20260819-00001"
  buyerUserId: string;
  // "" (not a real id) while status is "open" — a broadcast bid request
  // isn't tied to any one seller yet, could end up going to whichever one
  // wins the bid. Kept as a plain string (not string | null) so every
  // existing status branch that already assumes providerId is set doesn't
  // need touching — only the "open" path ever produces "".
  providerId: string;
  serviceId: string; // same "" convention as providerId, for the same reason
  serviceName: string;
  country: string;
  /** What the buyer proposed when opening a broadcast bid request — a
   * hint shown to sellers deciding whether to bid, not binding on either
   * side (a seller can bid higher or lower; the buyer picks whichever bid
   * they like via acceptBid). Only meaningful while status is "open". */
  buyerBidPrice?: number | null;
  /** How many numbers the buyer actually wants — "kitne number ki need
   * hai" — a hint for sellers deciding whether to bid (a seller with only
   * 1 in stock can see upfront a buyer wants 5), not enforced/multiplied
   * into the price automatically (a bid is still one price for the whole
   * request; the seller factors quantity into what they bid). */
  quantity?: number;
  /** "old chahiye ya new chahiye" — whether the buyer wants an
   * already-used/aged number or a freshly registered one, or has no
   * preference. Purely informational, shown to bidding sellers. */
  numberType?: "any" | "old" | "new";
  // All four of these stay 0 while status is "quote_requested" — nothing
  // has a price yet, and critically NO money has moved. They're only ever
  // read once status has reached "quoted" or later, by which point
  // they're real (set by submitQuote, or upfront by
  // createManualProviderRequest for an already-priced listing).
  priceCustomer: number; // what the buyer pays (debited from wallet on quote acceptance / on request creation for a pre-priced listing)
  priceProvider: number; // provider's cut
  marginPercent: number;
  marginAmount: number;
  // open: buyer posted a broadcast bid request for a service+country (not
  //   tied to any specific seller's listing) — any online seller who
  //   offers that service+country can submit a bid (see ManualProviderBidDoc).
  //   No money moved yet.
  // quote_requested: buyer asked ONE specific seller's no-price listing
  //   for a price, no money moved yet, waiting on that seller.
  // quoted: that seller named a price, waiting on the buyer to accept/decline.
  // assigned: paid and waiting on the seller to start — reached directly
  //   for an already-priced listing, or via acceptBid/acceptQuote.
  // otp_sent: seller has typed in an OTP and is waiting on the buyer to
  //   confirm it's correct (or say it's wrong / ask for another one, for
  //   services that send more than one code) — money has NOT moved into
  //   the seller's pendingBalance yet, that only happens on buyerConfirmOtp
  //   (or the auto-confirm sweep, if the buyer never responds).
  status: "open" | "quote_requested" | "quoted" | "assigned" | "in_progress" | "otp_sent" | "completed" | "failed" | "cancelled" | "refunded" | "disputed";
  /** The real phone number the seller hands the buyer once they start
   * working the request — the seller reads the OTP off this number's own
   * phone and types it in manually (no automated SMS-provider API here,
   * this is the whole point of "Manual" Provider). */
  number?: string | null;
  /** Whatever the seller most recently typed in — the buyer confirms THIS
   * one via buyerConfirmOtp. */
  otpCode?: string | null;
  /** Every code the seller has sent for this request, oldest first —
   * some services (per otpMode "multi") need more than one. */
  otpHistory?: Array<{ code: string; sentAt: Date }>;
  /** Whether the buyer expects one OTP or possibly more than one for this
   * request — set once, at request creation, from what the buyer picked. */
  otpMode?: "single" | "multi";
  /** When the current otpCode was submitted — the auto-confirm sweep
   * credits the seller and completes the request if the buyer hasn't
   * responded within settings.otpAutoConfirmMinutes of this. */
  otpDeliveredAt?: Date | null;
  resultNote?: string | null;
  timeline: ManualProviderRequestTimelineEntry[];
  createdAt: Date;
  // null while "quote_requested"/"quoted" — set the moment payment
  // actually happens (either immediately, for a pre-priced listing, or on
  // quote acceptance). The 2-minute-cancel-style auto-expiry sweep and the
  // response-time stat both key off this, not createdAt, since the clock
  // that matters is "how long has money been sitting with a seller who
  // hasn't started," not "how long has this record existed."
  assignedAt: Date | null;
  startedAt?: Date | null;
  completedAt?: Date | null;
  failedAt?: Date | null;
  cancelledAt?: Date | null;
};

export type ManualProviderBidDoc = {
  _id: string;
  requestId: string;
  providerId: string;
  price: number; // seller's own price for this bid (pre-margin)
  priceCustomer: number; // computed, what the buyer would pay if they accept this bid
  marginPercent: number;
  marginAmount: number;
  status: "pending" | "accepted" | "rejected";
  createdAt: Date;
};

export type ManualProviderTxDoc = {
  _id: string;
  providerId: string;
  type: "pending_earning" | "settled" | "adjustment" | "reversal";
  amount: number;
  pendingBalanceAfter: number;
  availableBalanceAfter: number;
  requestId?: string | null;
  note: string;
  createdAt: Date;
};

export type ManualProviderSettlementDoc = {
  _id: string;
  providerId: string;
  amount: number;
  status: "pending" | "approved" | "paid" | "rejected";
  requestCount: number;
  txnRef?: string | null;
  note?: string | null;
  createdAt: Date;
  decidedAt?: Date | null;
  decidedBy?: string | null;
};

export type ManualProviderSettingsDoc = { _id: "global"; marginPercent: number; minCancelMs: number; maxDisputeRefunds: number; assignExpiryMinutes: number; otpAutoConfirmMinutes: number };

export type ManualProviderDisputeDoc = {
  _id: string;
  requestId: string;
  buyerUserId: string;
  providerId: string;
  reason: string;
  proofImage: string | null; // base64 data: URL, same pattern as deposit screenshots elsewhere in the app
  /** The request's status right before opening the dispute flipped it to
   * "disputed" — resolveDispute needs this (not the live, now-"disputed"
   * status) to know whether the provider had already been credited
   * pendingBalance for this request and needs it clawed back. */
  previousStatus: ManualProviderRequestDoc["status"];
  status: "pending" | "approved" | "rejected";
  createdAt: Date;
  decidedAt?: Date | null;
  decidedBy?: string | null;
  decidedByRole?: "provider" | "admin" | null;
};

export type ManualProviderReviewDoc = {
  _id: string;
  requestId: string;
  buyerUserId: string;
  providerId: string;
  rating: number; // 1-5
  comment?: string | null;
  createdAt: Date;
};

async function logActivity(actorUserId: string, actorRole: string, action: string, extra: Record<string, unknown> = {}) {
  try {
    const logs = await getCollection("manual_provider_activity_logs");
    await logs.insertOne({ _id: crypto.randomUUID(), actorUserId, actorRole, action, ...extra, createdAt: new Date() } as never);
  } catch { /* best-effort — never let audit logging block the real operation */ }
}

/** Real, cross-device notification — reuses the app's existing generic
 * `notifications` collection/shape (id/title/body/type/read/createdAt),
 * not the buy-number page's local-only in-memory store. This is how a
 * seller on a different device actually finds out a buyer posted a
 * request, and how a buyer finds out a seller bid on theirs. Best-effort:
 * a notification failing to insert should never block the real action. */
async function notifyUser(userId: string, title: string, body: string, type: "info" | "success" | "warning" | "error" = "info") {
  try {
    const col = await getCollection("notifications");
    await col.insertOne({ _id: crypto.randomUUID(), userId, title, body, type, read: false, createdAt: new Date() } as never);
  } catch { /* best-effort */ }
}

export async function loadManualProviderSettings(): Promise<ManualProviderSettingsDoc> {
  const col = await getCollection<ManualProviderSettingsDoc>("manual_provider_settings");
  const doc = await col.findOne({ _id: "global" });
  return doc ?? { _id: "global", marginPercent: 30, minCancelMs: 0, maxDisputeRefunds: 3, assignExpiryMinutes: 10, otpAutoConfirmMinutes: 10 };
}

export async function saveManualProviderSettings(patch: { marginPercent?: number; minCancelMs?: number; maxDisputeRefunds?: number; assignExpiryMinutes?: number; otpAutoConfirmMinutes?: number }): Promise<ManualProviderSettingsDoc> {
  const col = await getCollection<ManualProviderSettingsDoc>("manual_provider_settings");
  const current = await loadManualProviderSettings();
  const next: ManualProviderSettingsDoc = {
    _id: "global",
    marginPercent: patch.marginPercent !== undefined ? Math.max(0, Number(patch.marginPercent)) : current.marginPercent,
    minCancelMs: patch.minCancelMs !== undefined ? Math.max(0, Number(patch.minCancelMs)) : current.minCancelMs,
    maxDisputeRefunds: patch.maxDisputeRefunds !== undefined ? Math.max(0, Math.round(Number(patch.maxDisputeRefunds))) : current.maxDisputeRefunds,
    assignExpiryMinutes: patch.assignExpiryMinutes !== undefined ? Math.max(1, Math.round(Number(patch.assignExpiryMinutes))) : current.assignExpiryMinutes,
    otpAutoConfirmMinutes: patch.otpAutoConfirmMinutes !== undefined ? Math.max(1, Math.round(Number(patch.otpAutoConfirmMinutes))) : current.otpAutoConfirmMinutes,
  };
  await col.updateOne({ _id: "global" }, { $set: next }, { upsert: true });
  return next;
}

/** Server-side price calculation — NEVER trust a customer price computed on
 * the frontend. Per-service override wins over the global default. */
export function computeCustomerPrice(baseProviderPrice: number, marginOverridePercent: number | null | undefined, globalMarginPercent: number): { priceCustomer: number; marginPercent: number; marginAmount: number } {
  const marginPercent = Number.isFinite(marginOverridePercent) && marginOverridePercent !== null ? Number(marginOverridePercent) : globalMarginPercent;
  const priceCustomer = Number((baseProviderPrice * (1 + marginPercent / 100)).toFixed(2));
  const marginAmount = Number((priceCustomer - baseProviderPrice).toFixed(2));
  return { priceCustomer, marginPercent, marginAmount };
}

/** Reverse of computeCustomerPrice — used ONLY to translate a buyer's
 * stated budget into "what a seller would actually net" before showing
 * it to sellers. Neither side ever sees the other's raw number or the
 * margin math itself: a buyer only ever sees their own total price, a
 * seller only ever sees their own net earning for it. */
export function computeProviderNetFromCustomerPrice(customerPrice: number, marginPercent: number): number {
  return Number((customerPrice / (1 + marginPercent / 100)).toFixed(2));
}

/** A buyer's track record, shown to sellers deciding whether to bid on
 * their open request or fulfil their assigned one — "kitne number liye
 * hai pehle, iska kya review hai." Computed fresh from real order history
 * every time, not a cached counter. */
export async function getBuyerStats(buyerUserId: string): Promise<{ completedCount: number; disputeCount: number }> {
  const requestsCol = await getCollection<ManualProviderRequestDoc>("manual_provider_requests");
  const disputesCol = await getCollection<ManualProviderDisputeDoc>("manual_provider_disputes");
  const [completedCount, disputeCount] = await Promise.all([
    requestsCol.countDocuments({ buyerUserId, status: "completed" }),
    disputesCol.countDocuments({ buyerUserId, status: "approved" }),
  ]);
  return { completedCount, disputeCount };
}

/** Every account has a unique @handle now (assigned at signup going
 * forward), but accounts created before this feature don't — this
 * backfills one lazily, the first time it's actually needed, instead of
 * a migration. Never exposes email/phone; the handle is what shows up
 * on public profiles on both sides of a deal. */
export async function ensureUsername(userId: string): Promise<string> {
  const users = await getCollection<UserDoc>("users");
  const user = await users.findOne({ _id: userId });
  if (!user) throw new Error("User not found");
  if (user.username) return user.username;
  const base = (user.emailLower ?? user.email ?? "user").split("@")[0].toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 16) || "user";
  let username = base;
  for (let attempt = 0; attempt < 8; attempt++) {
    const candidate = attempt === 0 ? base : `${base}${Math.floor(1000 + Math.random() * 9000)}`;
    const exists = await users.findOne({ username: candidate }, { projection: { _id: 1 } });
    if (!exists) { username = candidate; break; }
    if (attempt === 7) username = `${base}${crypto.randomUUID().replace(/-/g, "").slice(0, 6)}`;
  }
  await users.updateOne({ _id: userId }, { $set: { username } });
  return username;
}

/** Resolve many userIds to usernames at once — for lists (bid rows,
 * review rows) where calling ensureUsername one-by-one would mean N
 * sequential round-trips for accounts still missing a handle. */
export async function resolveUsernames(userIds: string[]): Promise<Map<string, string>> {
  const ids = Array.from(new Set(userIds));
  const out = new Map<string, string>();
  await Promise.all(ids.map(async (id) => { try { out.set(id, await ensureUsername(id)); } catch { /* skip */ } }));
  return out;
}

/** Public profile — what a buyer sees looking at a seller they're about
 * to deal with, or a seller sees looking at a buyer who posted a
 * request. Username only, never email/phone/real name. "kitna liya,
 * kitna becha, kitna scam hua, reviews" — both sides of the ledger,
 * whichever apply to this account. */
export async function getPublicProfile(username: string): Promise<{
  username: string; memberSince: string;
  asBuyer: { numbersTaken: number; scamsFlagged: number };
  asSeller: { companyName: string; numbersSold: number; failedRequests: number; scamsFlagged: number; avgRating: number | null; ratingCount: number; successRate: number | null; avgResponseSec: number | null } | null;
  reviews: Array<{ rating: number; comment: string | null; createdAt: string; buyerUsername: string }>;
}> {
  const users = await getCollection<UserDoc>("users");
  const user = await users.findOne({ username });
  if (!user) throw new Error("Profile not found");

  const buyerStats = await getBuyerStats(user._id);
  const asBuyer = { numbersTaken: buyerStats.completedCount, scamsFlagged: buyerStats.disputeCount };

  let asSeller: Awaited<ReturnType<typeof getPublicProfile>>["asSeller"] = null;
  let reviews: Awaited<ReturnType<typeof getPublicProfile>>["reviews"] = [];
  if (user.roles?.includes("provider")) {
    const providersCol = await getCollection<ManualProviderDoc>("manual_providers");
    const provider = await providersCol.findOne({ userId: user._id });
    if (provider) {
      const disputesCol = await getCollection<ManualProviderDisputeDoc>("manual_provider_disputes");
      const scamsFlagged = await disputesCol.countDocuments({ providerId: provider._id, status: "approved" });
      // Overall success rate + response time across every service they
      // offer (weighted by how many requests each one has actually seen),
      // not just one listing — "kitne time me otp diya, success rate kya
      // hai" for the seller as a whole, same numbers a buyer would see per-bid.
      const svcCol = await getCollection<ManualProviderServiceDoc>("manual_provider_services");
      const services = await svcCol.find({ providerId: provider._id }).toArray();
      const totalCompleted = services.reduce((sum, s) => sum + (s.completedRequests ?? 0), 0);
      const totalFailed = services.reduce((sum, s) => sum + (s.failedRequests ?? 0), 0);
      const successRate = totalCompleted + totalFailed > 0 ? Math.round((totalCompleted / (totalCompleted + totalFailed)) * 100) : null;
      const weightedResponseSum = services.reduce((sum, s) => sum + (s.avgResponseSec ?? 0) * (s.responseSampleCount ?? 0), 0);
      const totalResponseSamples = services.reduce((sum, s) => sum + (s.responseSampleCount ?? 0), 0);
      const avgResponseSec = totalResponseSamples > 0 ? Number((weightedResponseSum / totalResponseSamples).toFixed(1)) : null;
      asSeller = {
        companyName: provider.companyName, numbersSold: provider.completedRequests ?? 0,
        failedRequests: provider.failedRequests ?? 0, scamsFlagged,
        avgRating: provider.avgRating ?? null, ratingCount: provider.ratingCount ?? 0,
        successRate, avgResponseSec,
      };
      const reviewsCol = await getCollection<ManualProviderReviewDoc>("manual_provider_reviews");
      const rows = await reviewsCol.find({ providerId: provider._id }).sort({ createdAt: -1 }).limit(20).toArray();
      const usernameByBuyer = await resolveUsernames(rows.map((r) => r.buyerUserId));
      reviews = rows.map((r) => ({ rating: r.rating, comment: r.comment ?? null, createdAt: r.createdAt.toISOString(), buyerUsername: usernameByBuyer.get(r.buyerUserId) ?? "unknown" }));
    }
  }

  return { username: user.username!, memberSince: user.createdAt.toISOString(), asBuyer, asSeller, reviews };
}

async function nextRequestCode(session?: ClientSession): Promise<string> {
  const counters = await getCollection<{ _id: string; seq: number }>("manual_provider_request_counters");
  const day = new Date().toISOString().slice(0, 10).replace(/-/g, "");
  const doc = await counters.findOneAndUpdate(
    { _id: day },
    { $inc: { seq: 1 } },
    { upsert: true, returnDocument: "after", session },
  );
  const seq = Number(doc?.seq ?? 1);
  return `MP-${day}-${String(seq).padStart(5, "0")}`;
}

/** Buyer creates a request against a specific provider service listing:
 * atomically debits the buyer's EXISTING wallet (same optimistic-lock
 * pattern as purchaseOtp — never a second wallet balance), inserts the
 * request doc, and bumps the service's lastActiveAt. */
export async function createManualProviderRequest(input: {
  buyerUserId: string; serviceId: string;
}): Promise<{ requestId: string; code: string; newBalance: number; quoteRequested: boolean }> {
  return withMoneyTransaction(async (session) => {
    const servicesCol = await getCollection<ManualProviderServiceDoc>("manual_provider_services");
    const service = await servicesCol.findOne({ _id: input.serviceId }, { session });
    if (!service) throw new Error("Service not found");
    if (service.status !== "active") throw new Error("This service is no longer available");
    if (service.availability !== "available") throw new Error("This provider is currently busy or offline — pick another one");

    // Enforced server-side, inside the same transaction as the debit —
    // the marketplace listing shows this too (as "busy" once full), but
    // that's just a display hint; without this check here a burst of
    // concurrent requests could all land on a seller past their stated
    // capacity with no code actually stopping it. Quote-pending requests
    // count toward this too — a seller can't get flooded with quote asks
    // past their stated capacity either.
    const requestsColForCap = await getCollection<ManualProviderRequestDoc>("manual_provider_requests");
    const activeCount = await requestsColForCap.countDocuments({ serviceId: service._id, status: { $in: ["quote_requested", "quoted", "assigned", "in_progress", "otp_sent"] } }, { session });
    if (activeCount >= service.capacity) throw new Error("This provider just hit their capacity for this service — pick another one or try again shortly");

    const providersCol = await getCollection<ManualProviderDoc>("manual_providers");
    const provider = await providersCol.findOne({ _id: service.providerId }, { session });
    if (!provider || provider.status !== "active" || !provider.online) throw new Error("This provider is currently unavailable");

    const code = await nextRequestCode(session);
    const now = new Date();
    const requestsCol = await getCollection<ManualProviderRequestDoc>("manual_provider_requests");

    // No price set on this listing — the seller hasn't fixed a rate for
    // it, so this becomes a quote request: no money moves until the
    // seller names a price and the buyer accepts it (see submitQuote /
    // acceptQuote below).
    if (service.price === null) {
      const request: ManualProviderRequestDoc = {
        _id: crypto.randomUUID(), code, buyerUserId: input.buyerUserId, providerId: service.providerId,
        serviceId: service._id, serviceName: service.service, country: service.country,
        priceCustomer: 0, priceProvider: 0, marginPercent: 0, marginAmount: 0,
        status: "quote_requested", resultNote: null,
        timeline: [{ status: "quote_requested", at: now, note: `Asked ${provider.companyName} for a price` }],
        createdAt: now, assignedAt: null, startedAt: null, completedAt: null, failedAt: null, cancelledAt: null,
      };
      await requestsCol.insertOne(request, { session });
      await servicesCol.updateOne({ _id: service._id }, { $set: { lastActiveAt: now, updatedAt: now } }, { session });
      const users = await getCollection<UserDoc>("users");
      const buyer = await users.findOne({ _id: input.buyerUserId }, { session });
      return { requestId: request._id, code, newBalance: Number(buyer?.walletBalance ?? 0), quoteRequested: true };
    }

    const settings = await loadManualProviderSettings();
    const { priceCustomer, marginPercent, marginAmount } = computeCustomerPrice(service.price, service.marginOverridePercent, settings.marginPercent);

    const users = await getCollection<UserDoc>("users");
    const buyer = await users.findOne({ _id: input.buyerUserId }, { session });
    if (!buyer) throw new Error("User not found");
    if (buyer.status === "frozen" || buyer.status === "blocked") throw new Error("Your account cannot make purchases right now. Contact support.");
    if (Number(buyer.walletBalance) < priceCustomer) {
      throw new Error(`Insufficient balance. Need ₹${priceCustomer.toFixed(2)}, have ₹${Number(buyer.walletBalance).toFixed(2)}. Please add funds.`);
    }
    const newBalance = Number((Number(buyer.walletBalance) - priceCustomer).toFixed(2));
    const updated = await users.findOneAndUpdate(
      { _id: input.buyerUserId, walletBalance: buyer.walletBalance },
      { $set: { walletBalance: newBalance, updatedAt: new Date() } },
      { session, returnDocument: "after" },
    );
    if (!updated) throw new Error("Balance changed, please retry");

    const request: ManualProviderRequestDoc = {
      _id: crypto.randomUUID(), code, buyerUserId: input.buyerUserId, providerId: service.providerId,
      serviceId: service._id, serviceName: service.service, country: service.country,
      priceCustomer, priceProvider: service.price, marginPercent, marginAmount,
      status: "assigned", resultNote: null,
      timeline: [{ status: "assigned", at: now, note: `Request created — assigned to ${provider.companyName}` }],
      createdAt: now, assignedAt: now, startedAt: null, completedAt: null, failedAt: null, cancelledAt: null,
    };
    await requestsCol.insertOne(request, { session });

    const walletTxCol = await getCollection<WalletTxDoc>("wallet_tx");
    await walletTxCol.insertOne({
      _id: crypto.randomUUID(), userId: input.buyerUserId, type: "purchase", amount: -priceCustomer, balanceAfter: newBalance,
      method: null, note: `Manual Provider: ${service.service} · ${service.country} (${code})`, referenceId: request._id, createdAt: now,
    }, { session });

    await servicesCol.updateOne({ _id: service._id }, { $set: { lastActiveAt: now, updatedAt: now } }, { session });

    return { requestId: request._id, code, newBalance, quoteRequested: false };
  }).then(async (res) => {
    await logActivity(input.buyerUserId, "user", res.quoteRequested ? "quote_requested" : "request_created", { requestId: res.requestId, code: res.code });
    return res;
  });
}

/** Seller quotes a price on a "quote_requested" request — no money moves
 * yet, this just proposes the price (the buyer's price = this + margin,
 * computed server-side same as everywhere else). */
export async function submitQuote(requestId: string, providerUserId: string, price: number): Promise<void> {
  if (!Number.isFinite(price) || price <= 0) throw new Error("Enter a valid price");
  const requestsCol = await getCollection<ManualProviderRequestDoc>("manual_provider_requests");
  const providersCol = await getCollection<ManualProviderDoc>("manual_providers");
  const provider = await providersCol.findOne({ userId: providerUserId });
  if (!provider) throw new Error("Not a provider account");
  const request = await requestsCol.findOne({ _id: requestId });
  if (!request) throw new Error("Request not found");
  if (request.providerId !== provider._id) throw new Error("Forbidden");
  if (request.status !== "quote_requested") throw new Error(`Can't quote — this request is already ${request.status.replace("_", " ")}`);

  const servicesCol = await getCollection<ManualProviderServiceDoc>("manual_provider_services");
  const service = await servicesCol.findOne({ _id: request.serviceId });
  const settings = await loadManualProviderSettings();
  const { priceCustomer, marginPercent, marginAmount } = computeCustomerPrice(price, service?.marginOverridePercent, settings.marginPercent);

  const now = new Date();
  await requestsCol.updateOne(
    { _id: requestId },
    { $set: { status: "quoted", priceProvider: price, priceCustomer, marginPercent, marginAmount }, $push: { timeline: { status: "quoted", at: now, note: `Quoted ₹${priceCustomer.toFixed(2)}` } } },
  );
  await logActivity(providerUserId, "provider", "quote_submitted", { requestId, price });
}

/** Buyer accepts a quote — THIS is when money actually moves, same
 * check-then-debit pattern as createManualProviderRequest's instant path. */
export async function acceptQuote(requestId: string, buyerUserId: string): Promise<{ newBalance: number }> {
  const newBalance = await withMoneyTransaction(async (session) => {
    const requestsCol = await getCollection<ManualProviderRequestDoc>("manual_provider_requests");
    const request = await requestsCol.findOne({ _id: requestId }, { session });
    if (!request) throw new Error("Request not found");
    if (request.buyerUserId !== buyerUserId) throw new Error("Forbidden");
    if (request.status !== "quoted") throw new Error(`Can't accept — this request is ${request.status.replace("_", " ")}, not quoted`);

    const users = await getCollection<UserDoc>("users");
    const buyer = await users.findOne({ _id: buyerUserId }, { session });
    if (!buyer) throw new Error("User not found");
    if (buyer.status === "frozen" || buyer.status === "blocked") throw new Error("Your account cannot make purchases right now. Contact support.");
    if (Number(buyer.walletBalance) < request.priceCustomer) {
      throw new Error(`Insufficient balance. Need ₹${request.priceCustomer.toFixed(2)}, have ₹${Number(buyer.walletBalance).toFixed(2)}. Please add funds.`);
    }
    const newBalance = Number((Number(buyer.walletBalance) - request.priceCustomer).toFixed(2));
    const updated = await users.findOneAndUpdate(
      { _id: buyerUserId, walletBalance: buyer.walletBalance },
      { $set: { walletBalance: newBalance, updatedAt: new Date() } },
      { session, returnDocument: "after" },
    );
    if (!updated) throw new Error("Balance changed, please retry");

    const now = new Date();
    await requestsCol.updateOne(
      { _id: requestId },
      { $set: { status: "assigned", assignedAt: now }, $push: { timeline: { status: "assigned", at: now, note: "Quote accepted and paid" } } },
      { session },
    );
    const walletTxCol = await getCollection<WalletTxDoc>("wallet_tx");
    await walletTxCol.insertOne({
      _id: crypto.randomUUID(), userId: buyerUserId, type: "purchase", amount: -request.priceCustomer, balanceAfter: newBalance,
      method: null, note: `Manual Provider: ${request.serviceName} · ${request.country} (${request.code})`, referenceId: request._id, createdAt: now,
    }, { session });
    return newBalance;
  });
  await logActivity(buyerUserId, "user", "quote_accepted", { requestId });
  return { newBalance };
}

/** Buyer declines a quote (or withdraws a still-unanswered quote request)
 * — safe to do freely since no money has moved at either of these
 * stages. */
// Covers three no-money-moved-yet states: "open" (buyer withdraws their
// own bid request), "quote_requested" (buyer gives up waiting on a single
// seller), "quoted" (buyer declines that seller's price). Same safe
// no-op-refund-needed logic in all three since nothing was ever charged.
export async function declineQuote(requestId: string, buyerUserId: string): Promise<void> {
  const requestsCol = await getCollection<ManualProviderRequestDoc>("manual_provider_requests");
  const request = await requestsCol.findOne({ _id: requestId });
  if (!request) throw new Error("Request not found");
  if (request.buyerUserId !== buyerUserId) throw new Error("Forbidden");
  if (!["open", "quote_requested", "quoted"].includes(request.status)) throw new Error(`Can't decline — this request is already ${request.status.replace("_", " ")}`);
  const now = new Date();
  await requestsCol.updateOne(
    { _id: requestId },
    { $set: { status: "cancelled", cancelledAt: now }, $push: { timeline: { status: "cancelled", at: now, note: "Buyer declined/withdrew" } } },
  );
  await logActivity(buyerUserId, "user", "quote_declined", { requestId });
}

// =====================================================================
// Open bidding board — buyer posts "I want <service> in <country>",
// optionally naming their own price as a hint, and ANY online seller who
// already offers that service+country (their own Services page is the
// source of truth for "offers") can respond with a bid. No money moves
// until the buyer picks one bid to accept — every seller who bid keeps
// their own real price private from the others; only the buyer sees all
// of them side by side.
// =====================================================================

export async function createOpenRequest(input: {
  buyerUserId: string; country: string; service: string; buyerBidPrice?: number | null;
  otpMode?: "single" | "multi"; quantity?: number; numberType?: "any" | "old" | "new";
}): Promise<{ requestId: string; code: string }> {
  const { buyerUserId, country, service } = input;
  if (!country.trim() || !service.trim()) throw new Error("Pick a country and service first");
  const buyerBidPrice = Number.isFinite(input.buyerBidPrice) && input.buyerBidPrice! > 0 ? Number(input.buyerBidPrice) : null;
  const otpMode: "single" | "multi" = input.otpMode === "multi" ? "multi" : "single";
  const quantity = Number.isFinite(input.quantity) && input.quantity! > 0 ? Math.floor(input.quantity!) : 1;
  const numberType: "any" | "old" | "new" = input.numberType === "old" || input.numberType === "new" ? input.numberType : "any";

  const code = await nextRequestCode();
  const now = new Date();
  const requestsCol = await getCollection<ManualProviderRequestDoc>("manual_provider_requests");
  const request: ManualProviderRequestDoc = {
    _id: crypto.randomUUID(), code, buyerUserId, providerId: "", serviceId: "", serviceName: service, country,
    buyerBidPrice, quantity, numberType, priceCustomer: 0, priceProvider: 0, marginPercent: 0, marginAmount: 0,
    status: "open", resultNote: null, otpMode, otpHistory: [], otpDeliveredAt: null,
    timeline: [{ status: "open", at: now, note: buyerBidPrice ? `Open request posted — buyer suggested ₹${buyerBidPrice.toFixed(2)}` : "Open request posted" }],
    createdAt: now, assignedAt: null, startedAt: null, completedAt: null, failedAt: null, cancelledAt: null,
  };
  await requestsCol.insertOne(request);
  await logActivity(buyerUserId, "user", "open_request_posted", { requestId: request._id, code });

  // Notify every online seller, platform-wide — not just the ones who
  // already have this exact service listed. Sellers only carry a
  // handful of listings each while the buyer picks from the full real
  // catalog, so matching-only notification almost never fired in
  // practice ("seller ke paas jana chahiye tha lekin gayi nahi"). A
  // seller who doesn't offer it yet can see the request and add the
  // service to bid; submitBid() still enforces the actual listing check
  // before a bid can be placed. Runs after the insert so a notification
  // hiccup never blocks the request itself.
  try {
    const providersCol = await getCollection<ManualProviderDoc>("manual_providers");
    const providers = await providersCol.find({ online: true, status: "active" }).toArray();
    const qtyNote = quantity > 1 ? `${quantity} numbers` : "1 number";
    const typeNote = numberType === "any" ? "" : `, ${numberType}`;
    await Promise.all(providers.map((p) =>
      notifyUser(p.userId, "New request on the Open Board", `${service} in ${country} (${code}) — wants ${qtyNote}${typeNote}, place your bid.`),
    ));
  } catch { /* best-effort */ }

  return { requestId: request._id, code };
}

/** Seller submits a bid on an open request — only allowed if they
 * currently offer this exact service+country on their own Services page
 * (active listing, priced or not — capacity/availability there don't
 * gate bidding itself, only actually winning does, checked at accept
 * time same as the instant-buy path). No money moves. */
export async function submitBid(requestId: string, providerUserId: string, price: number): Promise<void> {
  if (!Number.isFinite(price) || price <= 0) throw new Error("Enter a valid price");
  const provider = await (await getCollection<ManualProviderDoc>("manual_providers")).findOne({ userId: providerUserId });
  if (!provider) throw new Error("Not a provider account");
  if (!provider.online) throw new Error("Go online before bidding");

  const requestsCol = await getCollection<ManualProviderRequestDoc>("manual_provider_requests");
  const request = await requestsCol.findOne({ _id: requestId });
  if (!request) throw new Error("Request not found");
  if (request.status !== "open") throw new Error(`Can't bid — this request is already ${request.status.replace("_", " ")}`);

  const servicesCol = await getCollection<ManualProviderServiceDoc>("manual_provider_services");
  const listing = await servicesCol.findOne({ providerId: provider._id, country: request.country, service: request.serviceName, status: "active" });
  if (!listing) throw new Error("You don't currently offer this service in this country — add it on your Services page first");

  const bidsCol = await getCollection<ManualProviderBidDoc>("manual_provider_bids");
  const existing = await bidsCol.findOne({ requestId, providerId: provider._id, status: "pending" });
  if (existing) throw new Error("You've already bid on this request");

  const settings = await loadManualProviderSettings();
  const { priceCustomer, marginPercent, marginAmount } = computeCustomerPrice(price, listing.marginOverridePercent, settings.marginPercent);
  const now = new Date();
  await bidsCol.insertOne({
    _id: crypto.randomUUID(), requestId, providerId: provider._id, price, priceCustomer, marginPercent, marginAmount, status: "pending", createdAt: now,
  });
  await requestsCol.updateOne({ _id: requestId }, { $push: { timeline: { status: "open", at: now, note: `${provider.companyName} bid ₹${priceCustomer.toFixed(2)}` } } });
  await logActivity(providerUserId, "provider", "bid_submitted", { requestId, price });
  await notifyUser(request.buyerUserId, "New offer on your request", `${request.serviceName} · ${request.country} (${request.code}) — ₹${priceCustomer.toFixed(2)} offered. Open it to accept.`, "success");
}

export async function listBidsForRequest(requestId: string): Promise<Array<ManualProviderBidDoc & {
  providerName: string; providerUsername: string; providerRating: number | null; providerRatingCount: number;
  stock: number | null; successRate: number | null; avgResponseSec: number | null;
}>> {
  const bidsCol = await getCollection<ManualProviderBidDoc>("manual_provider_bids");
  const bids = await bidsCol.find({ requestId, status: "pending" }).sort({ priceCustomer: 1 }).toArray();
  if (bids.length === 0) return [];
  const request = await (await getCollection<ManualProviderRequestDoc>("manual_provider_requests")).findOne({ _id: requestId });
  const providersCol = await getCollection<ManualProviderDoc>("manual_providers");
  const providers = await providersCol.find({ _id: { $in: bids.map((b) => b.providerId) } }).toArray();
  const providerById = new Map(providers.map((p) => [p._id, p]));
  const usernameByUserId = await resolveUsernames(providers.map((p) => p.userId));
  // "kitne number available hai, kitne time me otp diya, success rate
  // kya hai" — pulled straight from THIS exact service+country listing
  // (not an all-services average), since that's what actually predicts
  // how this seller will perform on this specific request.
  const svcCol = await getCollection<ManualProviderServiceDoc>("manual_provider_services");
  const listings = request ? await svcCol.find({ providerId: { $in: bids.map((b) => b.providerId) }, country: request.country, service: request.serviceName }).toArray() : [];
  const listingByProvider = new Map(listings.map((l) => [l.providerId, l]));
  return bids.map((b) => {
    const p = providerById.get(b.providerId);
    const listing = listingByProvider.get(b.providerId);
    const totalOutcomes = (listing?.completedRequests ?? 0) + (listing?.failedRequests ?? 0);
    const successRate = totalOutcomes > 0 ? Math.round(((listing?.completedRequests ?? 0) / totalOutcomes) * 100) : null;
    return {
      ...b, providerName: p?.companyName ?? "Unknown", providerUsername: p ? (usernameByUserId.get(p.userId) ?? "") : "",
      providerRating: p?.avgRating ?? null, providerRatingCount: p?.ratingCount ?? 0,
      stock: listing?.stock ?? null, successRate, avgResponseSec: listing?.avgResponseSec ?? null,
    };
  });
}

/** Buyer accepts one bid on their open request — THIS is when money
 * actually moves, same check-then-debit pattern as everywhere else.
 * Every other pending bid on the same request is marked rejected so
 * sellers know they didn't win, and the request locks to the winner. */
export async function acceptBid(requestId: string, buyerUserId: string, bidId: string): Promise<{ newBalance: number }> {
  const newBalance = await withMoneyTransaction(async (session) => {
    const requestsCol = await getCollection<ManualProviderRequestDoc>("manual_provider_requests");
    const request = await requestsCol.findOne({ _id: requestId }, { session });
    if (!request) throw new Error("Request not found");
    if (request.buyerUserId !== buyerUserId) throw new Error("Forbidden");
    if (request.status !== "open") throw new Error(`Can't accept a bid — this request is already ${request.status.replace("_", " ")}`);

    const bidsCol = await getCollection<ManualProviderBidDoc>("manual_provider_bids");
    const bid = await bidsCol.findOne({ _id: bidId, requestId }, { session });
    if (!bid || bid.status !== "pending") throw new Error("This bid is no longer available");

    const users = await getCollection<UserDoc>("users");
    const buyer = await users.findOne({ _id: buyerUserId }, { session });
    if (!buyer) throw new Error("User not found");
    if (buyer.status === "frozen" || buyer.status === "blocked") throw new Error("Your account cannot make purchases right now. Contact support.");
    if (Number(buyer.walletBalance) < bid.priceCustomer) {
      throw new Error(`Insufficient balance. Need ₹${bid.priceCustomer.toFixed(2)}, have ₹${Number(buyer.walletBalance).toFixed(2)}. Please add funds.`);
    }
    const newBalance = Number((Number(buyer.walletBalance) - bid.priceCustomer).toFixed(2));
    const updated = await users.findOneAndUpdate(
      { _id: buyerUserId, walletBalance: buyer.walletBalance },
      { $set: { walletBalance: newBalance, updatedAt: new Date() } },
      { session, returnDocument: "after" },
    );
    if (!updated) throw new Error("Balance changed, please retry");

    const now = new Date();
    await requestsCol.updateOne(
      { _id: requestId },
      {
        $set: {
          status: "assigned", assignedAt: now, providerId: bid.providerId,
          priceCustomer: bid.priceCustomer, priceProvider: bid.price, marginPercent: bid.marginPercent, marginAmount: bid.marginAmount,
        },
        $push: { timeline: { status: "assigned", at: now, note: "Bid accepted and paid" } },
      },
      { session },
    );
    await bidsCol.updateOne({ _id: bidId }, { $set: { status: "accepted" } }, { session });
    await bidsCol.updateMany({ requestId, _id: { $ne: bidId }, status: "pending" }, { $set: { status: "rejected" } }, { session });

    const walletTxCol = await getCollection<WalletTxDoc>("wallet_tx");
    await walletTxCol.insertOne({
      _id: crypto.randomUUID(), userId: buyerUserId, type: "purchase", amount: -bid.priceCustomer, balanceAfter: newBalance,
      method: null, note: `Manual Provider: ${request.serviceName} · ${request.country} (${request.code})`, referenceId: request._id, createdAt: now,
    }, { session });
    return newBalance;
  });
  await logActivity(buyerUserId, "user", "bid_accepted", { requestId, bidId });
  return { newBalance };
}

/** Buyer cancels — only while still "assigned" (seller hasn't started
 * work yet). Refunds the full amount through the same wallet used to pay. */
export async function cancelManualProviderRequestByBuyer(requestId: string, buyerUserId: string): Promise<number> {
  const newBalance = await withMoneyTransaction(async (session) => {
    const requestsCol = await getCollection<ManualProviderRequestDoc>("manual_provider_requests");
    const request = await requestsCol.findOne({ _id: requestId }, { session });
    if (!request) throw new Error("Request not found");
    if (request.buyerUserId !== buyerUserId) throw new Error("Forbidden");
    if (request.status !== "assigned") throw new Error(`Can't cancel — this request is already ${request.status.replace("_", " ")}`);

    const users = await getCollection<UserDoc>("users");
    const buyer = await users.findOne({ _id: buyerUserId }, { session });
    if (!buyer) throw new Error("User not found");
    const newBalance = Number((Number(buyer.walletBalance) + request.priceCustomer).toFixed(2));
    await users.updateOne({ _id: buyerUserId }, { $set: { walletBalance: newBalance, updatedAt: new Date() } }, { session });

    const now = new Date();
    await requestsCol.updateOne(
      { _id: requestId },
      { $set: { status: "cancelled", cancelledAt: now }, $push: { timeline: { status: "cancelled", at: now, note: "Cancelled by buyer" } } },
      { session },
    );
    const walletTxCol = await getCollection<WalletTxDoc>("wallet_tx");
    await walletTxCol.insertOne({
      _id: crypto.randomUUID(), userId: buyerUserId, type: "refund", amount: request.priceCustomer, balanceAfter: newBalance,
      method: null, note: `Manual Provider request cancelled (${request.code})`, referenceId: requestId, createdAt: now,
    }, { session });
    return newBalance;
  });
  await logActivity(buyerUserId, "user", "request_cancelled", { requestId });
  return newBalance;
}

async function pushTimeline(requestId: string, status: ManualProviderRequestDoc["status"], note: string, session?: ClientSession) {
  const col = await getCollection<ManualProviderRequestDoc>("manual_provider_requests");
  const now = new Date();
  const dateField = status === "in_progress" ? "startedAt" : status === "completed" ? "completedAt" : status === "failed" ? "failedAt" : status === "cancelled" ? "cancelledAt" : null;
  const set: Record<string, unknown> = { status };
  if (dateField) set[dateField] = now;
  await col.updateOne({ _id: requestId }, { $set: set, $push: { timeline: { status, at: now, note } } }, session ? { session } : undefined);
}

/** Seller marks a request in progress and hands over the real number the
 * buyer should use — this is the number the seller's own phone will
 * receive the OTP on; there's no automated SMS-provider API behind a
 * Manual Provider listing, the seller reads it off their phone by hand. */
/** Every number a seller has ever handed out for a given service+country
 * — so a "buyer wants a NEW number" request can actually be enforced,
 * not just taken on trust. Keyed by providerId+country+service+number,
 * one doc per number, useCount bumped on repeat use. */
type UsedNumberDoc = { _id: string; providerId: string; country: string; service: string; number: string; firstUsedAt: Date; lastUsedAt: Date; useCount: number };

export async function sellerStartRequest(requestId: string, providerUserId: string, number: string): Promise<void> {
  const trimmedNumber = number.trim();
  if (!trimmedNumber) throw new Error("Enter the phone number for the buyer to use");
  const requestsCol = await getCollection<ManualProviderRequestDoc>("manual_provider_requests");
  const providersCol = await getCollection<ManualProviderDoc>("manual_providers");
  const provider = await providersCol.findOne({ userId: providerUserId });
  if (!provider) throw new Error("Not a provider account");
  const request = await requestsCol.findOne({ _id: requestId });
  if (!request) throw new Error("Request not found");
  if (request.providerId !== provider._id) throw new Error("Forbidden");
  if (request.status !== "assigned") throw new Error(`Can't start — this request is already ${request.status.replace("_", " ")}`);

  // "agar buyer ne new number manga hai to same number dobara mat do" —
  // check this seller's own history for this exact service+country
  // before letting them hand out a number they've already used before.
  const usedCol = await getCollection<UsedNumberDoc>("manual_provider_used_numbers");
  const usedKey = { providerId: provider._id, country: request.country, service: request.serviceName, number: trimmedNumber };
  const prior = await usedCol.findOne(usedKey);
  if (request.numberType === "new" && prior) {
    throw new Error("This number was already used before — the buyer asked for a NEW number. Use a different one.");
  }

  const now = new Date();
  await requestsCol.updateOne(
    { _id: requestId },
    { $set: { status: "in_progress", startedAt: now, number: trimmedNumber }, $push: { timeline: { status: "in_progress", at: now, note: `Number provided: ${trimmedNumber}` } } },
  );
  await usedCol.updateOne(
    usedKey,
    { $setOnInsert: { _id: crypto.randomUUID(), firstUsedAt: now }, $set: { lastUsedAt: now }, $inc: { useCount: 1 } },
    { upsert: true },
  );
  await logActivity(providerUserId, "provider", "request_started", { requestId });
}

/** Seller types in the OTP they read off their own phone — this hands it
 * to the buyer to check, but it does NOT complete the request or credit
 * the seller yet. That only happens once the buyer confirms it's correct
 * (buyerConfirmOtp), or the auto-confirm sweep does it for them if they
 * never respond. If the buyer instead says it's wrong / asks for another
 * one (buyerRequestOtpResend), this gets called again for the same
 * request. Requires the seller to have already started (given a number). */
export async function sellerSubmitOtp(requestId: string, providerUserId: string, otpCode: string): Promise<void> {
  if (!otpCode.trim()) throw new Error("Enter the OTP code you received");
  const providersCol = await getCollection<ManualProviderDoc>("manual_providers");
  const provider = await providersCol.findOne({ userId: providerUserId });
  if (!provider) throw new Error("Not a provider account");
  const requestsCol = await getCollection<ManualProviderRequestDoc>("manual_provider_requests");
  const request = await requestsCol.findOne({ _id: requestId });
  if (!request) throw new Error("Request not found");
  if (request.providerId !== provider._id) throw new Error("Forbidden");
  if (request.status !== "in_progress") throw new Error(`Can't submit an OTP — this request is ${request.status.replace("_", " ")}`);

  const code = otpCode.trim();
  const now = new Date();
  await requestsCol.updateOne(
    { _id: requestId },
    {
      $set: { status: "otp_sent", otpCode: code, otpDeliveredAt: now },
      $push: {
        timeline: { status: "otp_sent", at: now, note: "OTP sent — waiting for buyer to confirm" },
        otpHistory: { code, sentAt: now },
      },
    },
  );
  await notifyUser(request.buyerUserId, "OTP delivered", `${request.serviceName} · ${request.country} (${request.code}) — check and confirm, or ask for a resend if it's wrong.`, "info");
  await logActivity(providerUserId, "provider", "otp_submitted", { requestId });
}

/** Shared by buyerConfirmOtp and the auto-confirm sweep — the actual
 * money-moving completion, split out so both paths credit the seller
 * identically instead of drifting apart. Caller must already be inside a
 * withMoneyTransaction session and must have re-checked the request is
 * still "otp_sent" right before calling this. */
async function finalizeOtpConfirmation(request: ManualProviderRequestDoc, session: ClientSession, note: string): Promise<void> {
  const providersCol = await getCollection<ManualProviderDoc>("manual_providers");
  const provider = await providersCol.findOne({ _id: request.providerId }, { session });
  if (!provider) throw new Error("Provider not found");
  const requestsCol = await getCollection<ManualProviderRequestDoc>("manual_provider_requests");
  const now = new Date();
  await requestsCol.updateOne(
    { _id: request._id },
    { $set: { status: "completed", completedAt: now }, $push: { timeline: { status: "completed", at: now, note } } },
    { session },
  );

  const newPending = Number((Number(provider.pendingBalance) + request.priceProvider).toFixed(2));
  const newTotalEarnings = Number((Number(provider.totalEarnings) + request.priceProvider).toFixed(2));
  await providersCol.updateOne(
    { _id: provider._id },
    { $set: { pendingBalance: newPending, totalEarnings: newTotalEarnings, completedRequests: (provider.completedRequests ?? 0) + 1, updatedAt: now } },
    { session },
  );
  const txCol = await getCollection<ManualProviderTxDoc>("manual_provider_transactions");
  await txCol.insertOne({
    _id: crypto.randomUUID(), providerId: provider._id, type: "pending_earning", amount: request.priceProvider,
    pendingBalanceAfter: newPending, availableBalanceAfter: provider.availableBalance,
    requestId: request._id, note: `Completed: ${request.serviceName} · ${request.country} (${request.code})`, createdAt: now,
  }, { session });

  const responseSec = request.assignedAt ? (now.getTime() - request.assignedAt.getTime()) / 1000 : null;
  const servicesCol = await getCollection<ManualProviderServiceDoc>("manual_provider_services");
  const service = await servicesCol.findOne({ _id: request.serviceId }, { session });
  if (service && responseSec !== null) {
    const prevAvg = Number(service.avgResponseSec) || 0;
    const prevCount = service.responseSampleCount || 0;
    const nextCount = Math.min(prevCount + 1, 500);
    const nextAvg = prevCount > 0 ? prevAvg + (responseSec - prevAvg) / nextCount : responseSec;
    await servicesCol.updateOne(
      { _id: service._id },
      { $set: { completedRequests: (service.completedRequests ?? 0) + 1, avgResponseSec: Number(nextAvg.toFixed(1)), responseSampleCount: nextCount, updatedAt: now } },
      { session },
    );
  }
}

/** Buyer confirms the OTP the seller just sent is correct — THIS is what
 * actually credits the seller's pending earnings, never the seller's own
 * submit action (a seller can't pay themselves by just typing something
 * in). */
export async function buyerConfirmOtp(requestId: string, buyerUserId: string): Promise<void> {
  await withMoneyTransaction(async (session) => {
    const requestsCol = await getCollection<ManualProviderRequestDoc>("manual_provider_requests");
    const request = await requestsCol.findOne({ _id: requestId }, { session });
    if (!request) throw new Error("Request not found");
    if (request.buyerUserId !== buyerUserId) throw new Error("Forbidden");
    if (request.status !== "otp_sent") throw new Error(`Nothing to confirm — this request is ${request.status.replace("_", " ")}`);
    await finalizeOtpConfirmation(request, session, "Buyer confirmed the OTP");
  });
  const request = await (await getCollection<ManualProviderRequestDoc>("manual_provider_requests")).findOne({ _id: requestId });
  if (request) {
    const providerUserId = await providerUserIdFor(request.providerId);
    if (providerUserId) await notifyUser(providerUserId, "OTP confirmed — you got paid", `${request.serviceName} · ${request.country} (${request.code}) marked complete, earnings credited.`, "success");
  }
  await logActivity(buyerUserId, "user", "otp_confirmed", { requestId });
}

async function providerUserIdFor(providerId: string): Promise<string> {
  const p = await (await getCollection<ManualProviderDoc>("manual_providers")).findOne({ _id: providerId });
  return p?.userId ?? "";
}

/** Buyer says the OTP was wrong, or (only when otpMode is "multi") asks
 * for another one — either way, back to the seller to try again. No
 * money has moved yet at this point so there's nothing to reverse. */
export async function buyerRequestOtpResend(requestId: string, buyerUserId: string, reason: "wrong" | "need_another"): Promise<void> {
  const requestsCol = await getCollection<ManualProviderRequestDoc>("manual_provider_requests");
  const request = await requestsCol.findOne({ _id: requestId });
  if (!request) throw new Error("Request not found");
  if (request.buyerUserId !== buyerUserId) throw new Error("Forbidden");
  if (request.status !== "otp_sent") throw new Error(`Can't ask for a resend — this request is ${request.status.replace("_", " ")}`);
  if (reason === "need_another" && request.otpMode !== "multi") throw new Error("This request only expects a single OTP");

  const now = new Date();
  const note = reason === "wrong" ? "Buyer said the OTP was wrong — asked for a resend" : "Buyer asked for another OTP";
  await requestsCol.updateOne(
    { _id: requestId },
    { $set: { status: "in_progress" }, $push: { timeline: { status: "in_progress", at: now, note } } },
  );
  const providerUserId = await providerUserIdFor(request.providerId);
  if (providerUserId) await notifyUser(providerUserId, reason === "wrong" ? "OTP was wrong — please resend" : "Buyer needs another OTP", `${request.serviceName} · ${request.country} (${request.code}) — send the next code from your phone.`, "warning");
  await logActivity(buyerUserId, "user", "otp_resend_requested", { requestId, reason });
}

/** Seller (or admin) marks a request failed — refunds the buyer in full,
 * same as a buyer-initiated cancel, but tracked separately in stats
 * (failedRequests) since it's the provider's failure, not the buyer's
 * change of mind. */
export async function failManualProviderRequest(requestId: string, actorUserId: string, actorRole: "provider" | "admin", reason: string): Promise<number> {
  const newBalance = await withMoneyTransaction(async (session) => {
    const requestsCol = await getCollection<ManualProviderRequestDoc>("manual_provider_requests");
    const request = await requestsCol.findOne({ _id: requestId }, { session });
    if (!request) throw new Error("Request not found");
    if (actorRole === "provider") {
      const providersCol = await getCollection<ManualProviderDoc>("manual_providers");
      const provider = await providersCol.findOne({ userId: actorUserId }, { session });
      if (!provider || request.providerId !== provider._id) throw new Error("Forbidden");
    }
    if (request.status === "completed" || request.status === "failed" || request.status === "cancelled" || request.status === "refunded") {
      throw new Error(`Can't fail — this request is already ${request.status.replace("_", " ")}`);
    }

    const users = await getCollection<UserDoc>("users");
    const buyer = await users.findOne({ _id: request.buyerUserId }, { session });
    if (!buyer) throw new Error("Buyer not found");
    const newBalance = Number((Number(buyer.walletBalance) + request.priceCustomer).toFixed(2));
    await users.updateOne({ _id: request.buyerUserId }, { $set: { walletBalance: newBalance, updatedAt: new Date() } }, { session });

    const now = new Date();
    await requestsCol.updateOne(
      { _id: requestId },
      { $set: { status: "failed", failedAt: now, resultNote: reason }, $push: { timeline: { status: "failed", at: now, note: reason } } },
      { session },
    );
    const walletTxCol = await getCollection<WalletTxDoc>("wallet_tx");
    await walletTxCol.insertOne({
      _id: crypto.randomUUID(), userId: request.buyerUserId, type: "refund", amount: request.priceCustomer, balanceAfter: newBalance,
      method: null, note: `Manual Provider request failed, refunded (${request.code})`, referenceId: requestId, createdAt: now,
    }, { session });

    const providersCol = await getCollection<ManualProviderDoc>("manual_providers");
    await providersCol.updateOne({ _id: request.providerId }, { $inc: { failedRequests: 1 }, $set: { updatedAt: now } }, { session });
    const servicesCol = await getCollection<ManualProviderServiceDoc>("manual_provider_services");
    await servicesCol.updateOne({ _id: request.serviceId }, { $inc: { failedRequests: 1 }, $set: { updatedAt: now } }, { session });

    return newBalance;
  });
  await logActivity(actorUserId, actorRole, "request_failed", { requestId, reason });
  return newBalance;
}

/** Admin force-refund/cancel — same money movement as a buyer cancel or a
 * failure, usable from any non-terminal state (dispute resolution). */
export async function adminCancelManualProviderRequest(requestId: string, adminUserId: string, reason: string): Promise<number> {
  const newBalance = await withMoneyTransaction(async (session) => {
    const requestsCol = await getCollection<ManualProviderRequestDoc>("manual_provider_requests");
    const request = await requestsCol.findOne({ _id: requestId }, { session });
    if (!request) throw new Error("Request not found");
    if (request.status === "completed" || request.status === "cancelled" || request.status === "refunded") {
      throw new Error(`Can't refund — this request is already ${request.status.replace("_", " ")}`);
    }
    const users = await getCollection<UserDoc>("users");
    const buyer = await users.findOne({ _id: request.buyerUserId }, { session });
    if (!buyer) throw new Error("Buyer not found");
    const newBalance = Number((Number(buyer.walletBalance) + request.priceCustomer).toFixed(2));
    await users.updateOne({ _id: request.buyerUserId }, { $set: { walletBalance: newBalance, updatedAt: new Date() } }, { session });

    const now = new Date();
    await requestsCol.updateOne(
      { _id: requestId },
      { $set: { status: "refunded", cancelledAt: now }, $push: { timeline: { status: "refunded", at: now, note: `Admin refund: ${reason}` } } },
      { session },
    );
    const walletTxCol = await getCollection<WalletTxDoc>("wallet_tx");
    await walletTxCol.insertOne({
      _id: crypto.randomUUID(), userId: request.buyerUserId, type: "refund", amount: request.priceCustomer, balanceAfter: newBalance,
      method: "admin", note: `Manual Provider request refunded by admin (${request.code}): ${reason}`, referenceId: requestId, createdAt: now,
    }, { session });
    return newBalance;
  });
  await logActivity(adminUserId, "admin", "request_admin_refunded", { requestId, reason });
  return newBalance;
}

/** Admin creates a settlement batch: moves a provider's current
 * pendingBalance into availableBalance and records a settlement doc.
 * Actual payout happens outside the app (bank transfer etc.) — marking it
 * "paid" is a separate admin action (markSettlementPaid). */
export async function createSettlement(providerId: string, note?: string): Promise<ManualProviderSettlementDoc> {
  return withMoneyTransaction(async (session) => {
    const providersCol = await getCollection<ManualProviderDoc>("manual_providers");
    const provider = await providersCol.findOne({ _id: providerId }, { session });
    if (!provider) throw new Error("Provider not found");
    if (provider.pendingBalance <= 0) throw new Error("Nothing pending to settle");

    const amount = provider.pendingBalance;
    const now = new Date();
    const newAvailable = Number((provider.availableBalance + amount).toFixed(2));
    await providersCol.updateOne({ _id: providerId }, { $set: { pendingBalance: 0, availableBalance: newAvailable, updatedAt: now } }, { session });

    const txCol = await getCollection<ManualProviderTxDoc>("manual_provider_transactions");
    await txCol.insertOne({
      _id: crypto.randomUUID(), providerId, type: "settled", amount, pendingBalanceAfter: 0, availableBalanceAfter: newAvailable,
      requestId: null, note: note || "Settlement batch created", createdAt: now,
    }, { session });

    const requestsCol = await getCollection<ManualProviderRequestDoc>("manual_provider_requests");
    const requestCount = await requestsCol.countDocuments({ providerId, status: "completed" }, { session });

    const settlementsCol = await getCollection<ManualProviderSettlementDoc>("manual_provider_settlements");
    const settlement: ManualProviderSettlementDoc = {
      _id: crypto.randomUUID(), providerId, amount, status: "pending", requestCount, txnRef: null, note: note ?? null, createdAt: now,
    };
    await settlementsCol.insertOne(settlement, { session });
    return settlement;
  });
}

export async function decideSettlement(settlementId: string, decision: "approved" | "paid" | "rejected", adminUserId: string, txnRef?: string): Promise<ManualProviderSettlementDoc> {
  return withMoneyTransaction(async (session) => {
    const settlementsCol = await getCollection<ManualProviderSettlementDoc>("manual_provider_settlements");
    const settlement = await settlementsCol.findOne({ _id: settlementId }, { session });
    if (!settlement) throw new Error("Settlement not found");
    if (settlement.status === "paid" || settlement.status === "rejected") throw new Error(`Settlement already ${settlement.status}`);

    if (decision === "rejected") {
      // Give the pending amount back to the provider's pending bucket — the
      // settlement never actually left "owed to provider" status, this just
      // undoes the batch that group it.
      const providersCol = await getCollection<ManualProviderDoc>("manual_providers");
      const provider = await providersCol.findOne({ _id: settlement.providerId }, { session });
      if (provider) {
        const newAvailable = Number((provider.availableBalance - settlement.amount).toFixed(2));
        const newPending = Number((provider.pendingBalance + settlement.amount).toFixed(2));
        await providersCol.updateOne({ _id: provider._id }, { $set: { availableBalance: Math.max(0, newAvailable), pendingBalance: newPending, updatedAt: new Date() } }, { session });
      }
    }
    if (decision === "paid") {
      const providersCol = await getCollection<ManualProviderDoc>("manual_providers");
      const provider = await providersCol.findOne({ _id: settlement.providerId }, { session });
      if (provider) {
        const newAvailable = Number((provider.availableBalance - settlement.amount).toFixed(2));
        const newPaidOut = Number((provider.totalPaidOut + settlement.amount).toFixed(2));
        await providersCol.updateOne({ _id: provider._id }, { $set: { availableBalance: Math.max(0, newAvailable), totalPaidOut: newPaidOut, updatedAt: new Date() } }, { session });
      }
    }

    const now = new Date();
    const updated = await settlementsCol.findOneAndUpdate(
      { _id: settlementId },
      { $set: { status: decision, decidedAt: now, decidedBy: adminUserId, txnRef: txnRef ?? null } },
      { session, returnDocument: "after" },
    );
    if (!updated) throw new Error("Settlement not found");
    return updated;
  }).then(async (res) => {
    await logActivity(adminUserId, "admin", `settlement_${decision}`, { settlementId });
    return res;
  });
}

/** Seller-initiated withdrawal — the exact same money movement as an
 * admin-created settlement (pendingBalance -> availableBalance, a
 * settlement doc created "pending"), just triggered by the provider
 * instead of requiring an admin to notice and batch it. Admin still has
 * to approve/mark it paid — this doesn't let a seller pay themselves. */
export async function requestWithdrawal(providerUserId: string): Promise<ManualProviderSettlementDoc> {
  const providersCol = await getCollection<ManualProviderDoc>("manual_providers");
  const provider = await providersCol.findOne({ userId: providerUserId });
  if (!provider) throw new Error("Not a provider account");
  const settlement = await createSettlement(provider._id, "Withdrawal requested by seller");
  await logActivity(providerUserId, "provider", "withdrawal_requested", { settlementId: settlement._id, amount: settlement.amount });
  return settlement;
}

// =====================================================================
// Disputes — the buyer's ONLY recourse against a completed/stuck request
// that didn't actually work (no chat feature exists; this is instead of
// one). A fraud cap (settings.maxDisputeRefunds) limits how many disputes
// a single buyer can ever win, since an unlimited dispute-refund path is
// a direct scam vector against sellers (buy real service, dispute anyway,
// get refunded, seller loses the sale for nothing). Counted from actual
// approved-dispute history, not a cached counter, so it can't drift.
// =====================================================================

async function countApprovedDisputesForBuyer(buyerUserId: string): Promise<number> {
  const col = await getCollection<ManualProviderDisputeDoc>("manual_provider_disputes");
  return col.countDocuments({ buyerUserId, status: "approved" });
}

export async function openDispute(requestId: string, buyerUserId: string, reason: string, proofImage: string | null): Promise<ManualProviderDisputeDoc> {
  if (!reason.trim()) throw new Error("Explain what went wrong");
  // "already used" is a claim against a specific promise (numberType ===
  // "new") — enforced server-side too, not just a frontend nicety, since
  // it decides real money (a refund) based on this evidence.
  if (/already used/i.test(reason) && !proofImage) {
    throw new Error("A screenshot proving the number was already used is required for this claim");
  }
  const requestsCol = await getCollection<ManualProviderRequestDoc>("manual_provider_requests");
  const request = await requestsCol.findOne({ _id: requestId });
  if (!request) throw new Error("Request not found");
  if (request.buyerUserId !== buyerUserId) throw new Error("Forbidden");
  if (!["completed", "in_progress", "otp_sent"].includes(request.status)) {
    throw new Error(`Can't open a dispute on a request that's ${request.status.replace("_", " ")}`);
  }
  const disputesCol = await getCollection<ManualProviderDisputeDoc>("manual_provider_disputes");
  const existing = await disputesCol.findOne({ requestId, status: "pending" });
  if (existing) throw new Error("A dispute is already open for this request");

  const settings = await loadManualProviderSettings();
  const approvedCount = await countApprovedDisputesForBuyer(buyerUserId);
  if (approvedCount >= settings.maxDisputeRefunds) {
    throw new Error(`You've reached the maximum number of dispute refunds (${settings.maxDisputeRefunds}) allowed on this account — contact support instead.`);
  }

  const now = new Date();
  const dispute: ManualProviderDisputeDoc = {
    _id: crypto.randomUUID(), requestId, buyerUserId, providerId: request.providerId, reason: reason.trim(),
    proofImage: proofImage || null, previousStatus: request.status, status: "pending", createdAt: now,
  };
  await disputesCol.insertOne(dispute);
  await requestsCol.updateOne(
    { _id: requestId },
    { $set: { status: "disputed" }, $push: { timeline: { status: "disputed", at: now, note: `Buyer opened a dispute: ${reason.trim()}` } } },
  );
  await logActivity(buyerUserId, "user", "dispute_opened", { requestId, disputeId: dispute._id });
  return dispute;
}

/** actorRole gates who's allowed to decide: the assigned seller, or admin. */
export async function resolveDispute(disputeId: string, decision: "approved" | "rejected", actorUserId: string, actorRole: "provider" | "admin"): Promise<void> {
  await withMoneyTransaction(async (session) => {
    const disputesCol = await getCollection<ManualProviderDisputeDoc>("manual_provider_disputes");
    const dispute = await disputesCol.findOne({ _id: disputeId }, { session });
    if (!dispute) throw new Error("Dispute not found");
    if (dispute.status !== "pending") throw new Error(`Dispute already ${dispute.status}`);

    if (actorRole === "provider") {
      const providersCol = await getCollection<ManualProviderDoc>("manual_providers");
      const provider = await providersCol.findOne({ userId: actorUserId }, { session });
      if (!provider || provider._id !== dispute.providerId) throw new Error("Forbidden");
    }

    const requestsCol = await getCollection<ManualProviderRequestDoc>("manual_provider_requests");
    const request = await requestsCol.findOne({ _id: dispute.requestId }, { session });
    if (!request) throw new Error("Request not found");
    const now = new Date();

    if (decision === "approved") {
      const users = await getCollection<UserDoc>("users");
      const buyer = await users.findOne({ _id: dispute.buyerUserId }, { session });
      if (!buyer) throw new Error("Buyer not found");
      const newBalance = Number((Number(buyer.walletBalance) + request.priceCustomer).toFixed(2));
      await users.updateOne({ _id: dispute.buyerUserId }, { $set: { walletBalance: newBalance, updatedAt: now } }, { session });
      const walletTxCol = await getCollection<WalletTxDoc>("wallet_tx");
      await walletTxCol.insertOne({
        _id: crypto.randomUUID(), userId: dispute.buyerUserId, type: "refund", amount: request.priceCustomer, balanceAfter: newBalance,
        method: null, note: `Manual Provider dispute approved, refunded (${request.code})`, referenceId: request._id, createdAt: now,
      }, { session });

      // If the request had already reached "completed" (the seller's
      // pendingBalance was already credited for it), claw that back too —
      // a seller shouldn't keep the earning for a job that got refunded.
      // If it's already been settled out of pendingBalance (batched into
      // a settlement), this floors at 0 and the shortfall is left for
      // admin to see in the negative-looking ledger entry rather than
      // silently making pendingBalance go negative.
      if (dispute.previousStatus === "completed") {
        const providersCol = await getCollection<ManualProviderDoc>("manual_providers");
        const provider = await providersCol.findOne({ _id: dispute.providerId }, { session });
        if (provider) {
          const newPending = Math.max(0, Number((provider.pendingBalance - request.priceProvider).toFixed(2)));
          const newTotalEarnings = Math.max(0, Number((provider.totalEarnings - request.priceProvider).toFixed(2)));
          await providersCol.updateOne({ _id: provider._id }, { $set: { pendingBalance: newPending, totalEarnings: newTotalEarnings, updatedAt: now } }, { session });
          const txCol = await getCollection<ManualProviderTxDoc>("manual_provider_transactions");
          await txCol.insertOne({
            _id: crypto.randomUUID(), providerId: provider._id, type: "reversal", amount: -request.priceProvider,
            pendingBalanceAfter: newPending, availableBalanceAfter: provider.availableBalance,
            requestId: request._id, note: `Dispute approved — earning reversed (${request.code})`, createdAt: now,
          }, { session });
        }
      }

      await requestsCol.updateOne(
        { _id: request._id },
        { $set: { status: "refunded" }, $push: { timeline: { status: "refunded", at: now, note: "Dispute approved, buyer refunded" } } },
        { session },
      );
    } else {
      // Rejected — the request goes back to whatever it genuinely was
      // before the dispute (previousStatus, not a hardcoded "completed" —
      // it could also have been "in_progress"); nothing else changes.
      await requestsCol.updateOne(
        { _id: request._id },
        { $set: { status: dispute.previousStatus }, $push: { timeline: { status: dispute.previousStatus, at: now, note: "Dispute rejected" } } },
        { session },
      );
    }

    await disputesCol.updateOne(
      { _id: disputeId },
      { $set: { status: decision, decidedAt: now, decidedBy: actorUserId, decidedByRole: actorRole } },
      { session },
    );
  });
  await logActivity(actorUserId, actorRole, `dispute_${decision}`, { disputeId });
}

// =====================================================================
// Reviews — no chat feature; this is the buyer's only feedback channel
// to a provider, shown on the marketplace so it factors into future
// buyers' choices.
// =====================================================================

export async function submitReview(requestId: string, buyerUserId: string, rating: number, comment: string | null): Promise<void> {
  const r = Math.round(rating);
  if (!Number.isFinite(r) || r < 1 || r > 5) throw new Error("Rating must be between 1 and 5");
  const requestsCol = await getCollection<ManualProviderRequestDoc>("manual_provider_requests");
  const request = await requestsCol.findOne({ _id: requestId });
  if (!request) throw new Error("Request not found");
  if (request.buyerUserId !== buyerUserId) throw new Error("Forbidden");
  if (request.status !== "completed") throw new Error("You can only review a completed request");

  const reviewsCol = await getCollection<ManualProviderReviewDoc>("manual_provider_reviews");
  if (await reviewsCol.findOne({ requestId })) throw new Error("You've already reviewed this request");
  const now = new Date();
  await reviewsCol.insertOne({
    _id: crypto.randomUUID(), requestId, buyerUserId, providerId: request.providerId, rating: r, comment: comment?.trim() || null, createdAt: now,
  });

  const providersCol = await getCollection<ManualProviderDoc>("manual_providers");
  const provider = await providersCol.findOne({ _id: request.providerId });
  if (provider) {
    const prevAvg = Number(provider.avgRating) || 0;
    const prevCount = provider.ratingCount || 0;
    const nextCount = prevCount + 1;
    const nextAvg = (prevAvg * prevCount + r) / nextCount;
    await providersCol.updateOne({ _id: provider._id }, { $set: { avgRating: Number(nextAvg.toFixed(2)), ratingCount: nextCount, updatedAt: now } });
  }
  await logActivity(buyerUserId, "user", "review_submitted", { requestId, rating: r });
}

// =====================================================================
// Auto-expiry — a seller who never starts an "assigned" request
// (offline, ignoring it, whatever) would otherwise leave the buyer's
// money stuck indefinitely with no automated way out. Runs from
// lib/providers/autoSync.ts-style background interval in index.ts, not
// from a request handler.
// =====================================================================

export async function autoExpireStaleRequests(): Promise<number> {
  const settings = await loadManualProviderSettings();
  const cutoff = new Date(Date.now() - settings.assignExpiryMinutes * 60_000);
  const requestsCol = await getCollection<ManualProviderRequestDoc>("manual_provider_requests");

  // No money at risk here (nothing's been charged yet), so this is a
  // plain status flip, not a refund — a buyer's unanswered "ask for a
  // price" shouldn't sit around forever either.
  const staleQuotes = await requestsCol.find({ status: { $in: ["quote_requested", "quoted"] }, createdAt: { $lt: cutoff } }).limit(200).toArray();
  let expiredQuotes = 0;
  for (const q of staleQuotes) {
    const now = new Date();
    const res = await requestsCol.updateOne(
      { _id: q._id, status: q.status },
      { $set: { status: "cancelled", cancelledAt: now }, $push: { timeline: { status: "cancelled", at: now, note: `Auto-cancelled — no response within ${settings.assignExpiryMinutes} minutes` } } },
    );
    if (res.modifiedCount > 0) expiredQuotes++;
  }
  if (expiredQuotes > 0) await logActivity("system", "system", "quotes_auto_expired", { count: expiredQuotes });

  const stale = await requestsCol.find({ status: "assigned", assignedAt: { $lt: cutoff } }).limit(100).toArray();
  let count = 0;
  for (const request of stale) {
    try {
      await withMoneyTransaction(async (session) => {
        // Re-check status inside the transaction — someone may have
        // started/cancelled it in the gap between the find() above and now.
        const requestsColTx = await getCollection<ManualProviderRequestDoc>("manual_provider_requests");
        const fresh = await requestsColTx.findOne({ _id: request._id }, { session });
        if (!fresh || fresh.status !== "assigned") return;

        const users = await getCollection<UserDoc>("users");
        const buyer = await users.findOne({ _id: fresh.buyerUserId }, { session });
        if (!buyer) return;
        const newBalance = Number((Number(buyer.walletBalance) + fresh.priceCustomer).toFixed(2));
        await users.updateOne({ _id: fresh.buyerUserId }, { $set: { walletBalance: newBalance, updatedAt: new Date() } }, { session });

        const now = new Date();
        await requestsColTx.updateOne(
          { _id: fresh._id },
          { $set: { status: "refunded", cancelledAt: now }, $push: { timeline: { status: "refunded", at: now, note: `Auto-refunded — provider didn't start within ${settings.assignExpiryMinutes} minutes` } } },
          { session },
        );
        const walletTxCol = await getCollection<WalletTxDoc>("wallet_tx");
        await walletTxCol.insertOne({
          _id: crypto.randomUUID(), userId: fresh.buyerUserId, type: "refund", amount: fresh.priceCustomer, balanceAfter: newBalance,
          method: null, note: `Manual Provider request auto-expired, refunded (${fresh.code})`, referenceId: fresh._id, createdAt: now,
        }, { session });
      });
      await logActivity("system", "system", "request_auto_expired", { requestId: request._id, code: request.code });
      count++;
    } catch (err) {
      console.error(`[autoExpireStaleRequests] failed for ${request._id}:`, err instanceof Error ? err.message : err);
    }
  }

  // "if 10 min se jyada le raha hai to otp automatic confirm ho jayega" —
  // a buyer who never checks back shouldn't leave the seller unpaid
  // forever; auto-confirm the last OTP sent after otpAutoConfirmMinutes.
  const otpCutoff = new Date(Date.now() - settings.otpAutoConfirmMinutes * 60_000);
  const staleOtps = await requestsCol.find({ status: "otp_sent", otpDeliveredAt: { $lt: otpCutoff } }).limit(100).toArray();
  let autoConfirmed = 0;
  for (const request of staleOtps) {
    try {
      await withMoneyTransaction(async (session) => {
        const requestsColTx = await getCollection<ManualProviderRequestDoc>("manual_provider_requests");
        const fresh = await requestsColTx.findOne({ _id: request._id }, { session });
        if (!fresh || fresh.status !== "otp_sent") return;
        await finalizeOtpConfirmation(fresh, session, `Auto-confirmed — buyer didn't respond within ${settings.otpAutoConfirmMinutes} minutes`);
      });
      const providerUserId = await providerUserIdFor(request.providerId);
      if (providerUserId) await notifyUser(providerUserId, "OTP auto-confirmed — you got paid", `${request.serviceName} · ${request.country} (${request.code}) auto-completed, earnings credited.`, "success");
      await logActivity("system", "system", "otp_auto_confirmed", { requestId: request._id, code: request.code });
      autoConfirmed++;
    } catch (err) {
      console.error(`[autoExpireStaleRequests] otp auto-confirm failed for ${request._id}:`, err instanceof Error ? err.message : err);
    }
  }

  return count + expiredQuotes + autoConfirmed;
}

/** Admin safety valve for a stuck in_progress request whose seller has
 * gone unresponsive after already sending a number — completes it on
 * the seller's behalf (crediting their pendingBalance same as a normal
 * completion) rather than forcing a refund when the buyer may already
 * have gotten real use out of the number. Use adminCancelManualProviderRequest
 * instead if the buyer should be refunded rather than the job force-closed. */
export async function adminForceCompleteRequest(requestId: string, adminUserId: string, otpCode: string, note?: string): Promise<void> {
  if (!otpCode.trim()) throw new Error("Enter the OTP code");
  await withMoneyTransaction(async (session) => {
    const requestsCol = await getCollection<ManualProviderRequestDoc>("manual_provider_requests");
    const request = await requestsCol.findOne({ _id: requestId }, { session });
    if (!request) throw new Error("Request not found");
    if (!["assigned", "in_progress", "otp_sent"].includes(request.status)) {
      throw new Error(`Can't force-complete — this request is already ${request.status.replace("_", " ")}`);
    }
    const now = new Date();
    await requestsCol.updateOne(
      { _id: requestId },
      { $set: { status: "completed", completedAt: now, otpCode: otpCode.trim() }, $push: { timeline: { status: "completed", at: now, note: `Force-completed by admin: ${note || "no note"}` } } },
      { session },
    );
    const providersCol = await getCollection<ManualProviderDoc>("manual_providers");
    const provider = await providersCol.findOne({ _id: request.providerId }, { session });
    if (provider) {
      const newPending = Number((Number(provider.pendingBalance) + request.priceProvider).toFixed(2));
      const newTotalEarnings = Number((Number(provider.totalEarnings) + request.priceProvider).toFixed(2));
      await providersCol.updateOne(
        { _id: provider._id },
        { $set: { pendingBalance: newPending, totalEarnings: newTotalEarnings, completedRequests: (provider.completedRequests ?? 0) + 1, updatedAt: now } },
        { session },
      );
      const txCol = await getCollection<ManualProviderTxDoc>("manual_provider_transactions");
      await txCol.insertOne({
        _id: crypto.randomUUID(), providerId: provider._id, type: "pending_earning", amount: request.priceProvider,
        pendingBalanceAfter: newPending, availableBalanceAfter: provider.availableBalance,
        requestId, note: `Force-completed by admin (${request.code})`, createdAt: now,
      }, { session });
    }
  });
  await logActivity(adminUserId, "admin", "request_force_completed", { requestId });
}
