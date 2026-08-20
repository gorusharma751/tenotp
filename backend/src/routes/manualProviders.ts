// Manual Provider module routes — a marketplace of human-fulfilled
// services layered on top of the existing OTP-purchase system. Reuses the
// existing users/wallet_tx collections and requireAuth/requireAdmin
// middleware exactly as-is; only requireProvider and the manual_provider_*
// collections are new. See lib/db/manualProviders.ts for the money logic.
import { Router } from "express";
import { getCollection } from "../lib/mongo.ts";
import { requireAuth, requireAdmin, requireProvider } from "../middleware/auth.ts";
import type { UserDoc } from "../lib/types.ts";
import {
  type ManualProviderDoc, type ManualProviderServiceDoc, type ManualProviderRequestDoc,
  type ManualProviderTxDoc, type ManualProviderSettlementDoc, type ManualProviderDisputeDoc,
  loadManualProviderSettings, saveManualProviderSettings, computeCustomerPrice,
  createManualProviderRequest, cancelManualProviderRequestByBuyer,
  sellerStartRequest, sellerSubmitOtp, buyerConfirmOtp, buyerRequestOtpResend, failManualProviderRequest,
  adminCancelManualProviderRequest, createSettlement, decideSettlement, requestWithdrawal,
  openDispute, resolveDispute, submitReview, adminForceCompleteRequest,
  submitQuote, acceptQuote, declineQuote,
  createOpenRequest, submitBid, listBidsForRequest, acceptBid,
  computeProviderNetFromCustomerPrice, getBuyerStats,
  ensureUsername, resolveUsernames, getPublicProfile,
} from "../lib/db/manualProviders.ts";

export const manualProvidersRouter = Router();

function fail(res: import("express").Response, err: unknown, code = 400) {
  res.status(code).json({ error: err instanceof Error ? err.message : "Request failed" });
}

async function providersCol() { return getCollection<ManualProviderDoc>("manual_providers"); }
async function servicesCol() { return getCollection<ManualProviderServiceDoc>("manual_provider_services"); }
async function requestsCol() { return getCollection<ManualProviderRequestDoc>("manual_provider_requests"); }

async function providerForUser(userId: string): Promise<ManualProviderDoc> {
  const col = await providersCol();
  const doc = await col.findOne({ userId });
  if (!doc) throw new Error("Not a provider account");
  return doc;
}

// =====================================================================
// Real notifications — "seller ko notification jana chahiye" — a buyer
// posting an open request notifies every online matching seller, a
// seller bidding notifies that buyer. Reuses the app's existing generic
// `notifications` collection (id/title/body/type/read/createdAt), not
// the buy-number page's local-only in-memory store, so it actually
// reaches a different device/session. Polled from a bell in both
// SellerShell and DashboardShell.
// =====================================================================
manualProvidersRouter.get("/my-notifications", requireAuth, async (req, res) => {
  try {
    const col = await getCollection<{ _id: string; userId: string; title: string; body: string; type: string; read: boolean; createdAt: Date }>("notifications");
    const rows = await col.find({ userId: req.auth.userId }).sort({ createdAt: -1 }).limit(50).toArray();
    res.json(rows.map((r) => ({ id: r._id, title: r.title, body: r.body, type: r.type, read: r.read, createdAt: r.createdAt.toISOString() })));
  } catch (err) {
    fail(res, err, 500);
  }
});
manualProvidersRouter.post("/my-notifications/read-all", requireAuth, async (req, res) => {
  try {
    const col = await getCollection("notifications");
    await col.updateMany({ userId: req.auth.userId, read: false }, { $set: { read: true } });
    res.json({ ok: true });
  } catch (err) {
    fail(res, err);
  }
});

// "user ka username hona chahiye, uska profile dekh sake dono taraf" —
// public profile by username, either side of a deal can look up the
// other. Never leaks email/phone: just the handle, buy/sell stats, and
// reviews.
manualProvidersRouter.get("/profile/:username", requireAuth, async (req, res) => {
  try {
    const profile = await getPublicProfile(req.params.username);
    res.json(profile);
  } catch (err) {
    fail(res, err, 404);
  }
});
manualProvidersRouter.get("/my-username", requireAuth, async (req, res) => {
  try {
    res.json({ username: await ensureUsername(req.auth.userId) });
  } catch (err) {
    fail(res, err);
  }
});

// =====================================================================
// Buyer-facing (any logged-in user) — marketplace + requests
// =====================================================================

manualProvidersRouter.get("/services", requireAuth, async (req, res) => {
  try {
    const q = String(req.query.q ?? "").trim().toLowerCase();
    const country = String(req.query.country ?? "").trim();
    const service = String(req.query.service ?? "").trim();
    const availability = String(req.query.availability ?? "").trim();
    const sort = String(req.query.sort ?? "price"); // price | success | speed
    const dir = req.query.dir === "desc" ? -1 : 1;

    const filter: Record<string, unknown> = { status: "active" };
    if (country) filter.country = country;
    if (service) filter.service = service;
    if (availability) filter.availability = availability;

    const svcCol = await servicesCol();
    const rows = await svcCol.find(filter).toArray();
    const provCol = await providersCol();
    const providerIds = Array.from(new Set(rows.map((r) => r.providerId)));
    const providers = providerIds.length ? await provCol.find({ _id: { $in: providerIds } }).toArray() : [];
    const providerById = new Map(providers.map((p) => [p._id, p]));
    const settings = await loadManualProviderSettings();

    // Live queue count per listing — computed fresh, not a cached counter,
    // so it can't drift from what's actually assigned. Also what decides
    // "busy": a seller's own availability toggle is a ceiling, not the
    // only signal — even if they left it "available", capacity actually
    // being full means new requests would just fail the atomic check in
    // createManualProviderRequest anyway, so show that honestly upfront.
    const reqCol = await requestsCol();
    const activeCounts = await reqCol.aggregate<{ _id: string; count: number }>([
      { $match: { serviceId: { $in: rows.map((r) => r._id) }, status: { $in: ["quote_requested", "quoted", "assigned", "in_progress", "otp_sent"] } } },
      { $group: { _id: "$serviceId", count: { $sum: 1 } } },
    ]).toArray();
    const activeCountByService = new Map(activeCounts.map((a) => [a._id, a.count]));

    let out = rows
      .filter((r) => providerById.get(r.providerId)?.status === "active")
      .filter((r) => !q || `${r.service} ${r.country}`.toLowerCase().includes(q))
      .map((r) => {
        const provider = providerById.get(r.providerId)!;
        // null price means "ask for a price" — no fixed rate exists to
        // apply a margin to yet, the buyer requests a quote instead (see
        // POST /requests → quoteRequested, and submitQuote/acceptQuote).
        const price = r.price === null ? null : computeCustomerPrice(r.price, r.marginOverridePercent, settings.marginPercent).priceCustomer;
        const totalOutcomes = (r.completedRequests ?? 0) + (r.failedRequests ?? 0);
        const successRate = totalOutcomes > 0 ? Math.round(((r.completedRequests ?? 0) / totalOutcomes) * 100) : null;
        const queue = activeCountByService.get(r._id) ?? 0;
        // Providers only ever go "busy/offline" through their own toggle,
        // a disabled listing, or actually being at capacity — never expose
        // credentials/internal config, just the buyer-facing status fields
        // the spec calls for.
        const availabilityEffective = !provider.online ? "offline" : queue >= r.capacity ? "busy" : r.availability;
        return {
          id: r._id, providerId: r.providerId, providerName: provider.companyName,
          service: r.service, country: r.country, price, quoteOnly: r.price === null,
          availability: availabilityEffective, successRate, avgResponseSec: r.avgResponseSec,
          completedRequests: r.completedRequests ?? 0, priority: (provider.priority ?? 0) + (r.priority ?? 0),
          lastActiveAt: r.lastActiveAt ? r.lastActiveAt.toISOString() : null,
          avgRating: provider.avgRating ?? null, ratingCount: provider.ratingCount ?? 0,
          queue, capacity: r.capacity, stock: r.stock ?? 1,
        };
      });

    const rank = (x: (typeof out)[number]) => {
      if (sort === "success") return x.successRate ?? -1;
      if (sort === "speed") return x.avgResponseSec ?? Number.POSITIVE_INFINITY;
      return x.price ?? Number.POSITIVE_INFINITY; // quote-only listings sort to the end when sorting by price
    };
    out.sort((a, b) => {
      // Available listings always float above busy/offline ones regardless
      // of the chosen sort — buying from an offline provider isn't useful.
      const availRank = (x: (typeof out)[number]) => (x.availability === "available" ? 0 : x.availability === "busy" ? 1 : 2);
      const av = availRank(a) - availRank(b);
      if (av !== 0) return av;
      const r = rank(a) - rank(b);
      return sort === "speed" ? r : dir * r;
    });
    res.json(out);
  } catch (err) {
    fail(res, err, 500);
  }
});

manualProvidersRouter.get("/services/filters", requireAuth, async (_req, res) => {
  try {
    const svcCol = await servicesCol();
    const [countries, services] = await Promise.all([
      svcCol.distinct("country", { status: "active" }),
      svcCol.distinct("service", { status: "active" }),
    ]);
    res.json({ countries: countries.sort(), services: services.sort() });
  } catch (err) {
    fail(res, err, 500);
  }
});

// Full real service catalog (same source as buy-number.tsx / seller/catalog)
// — decoupled from whether any seller has actually set up a listing for
// it yet, so the buyer can post an open bid request for ANYTHING, not
// just what's already priced. Country choice stays scoped to real seller
// presence (services/filters above) — no point letting a buyer pick a
// country with zero sellers in it.
manualProvidersRouter.get("/catalog-services", requireAuth, async (_req, res) => {
  try {
    const services = await getCollection<{ name: string; enabled: boolean }>("services");
    const names = await services.distinct("name", { enabled: true });
    res.json({ services: names.sort() });
  } catch (err) {
    fail(res, err, 500);
  }
});

// ---- Open bidding board (buyer side) ----
manualProvidersRouter.post("/requests/open", requireAuth, async (req, res) => {
  try {
    const country = String(req.body?.country ?? "");
    const service = String(req.body?.service ?? "");
    const buyerBidPrice = req.body?.buyerBidPrice !== undefined ? Number(req.body.buyerBidPrice) : null;
    const otpMode = req.body?.otpMode === "multi" ? "multi" : "single";
    const quantity = req.body?.quantity !== undefined ? Number(req.body.quantity) : 1;
    const numberType = req.body?.numberType === "old" || req.body?.numberType === "new" ? req.body.numberType : "any";
    const result = await createOpenRequest({ buyerUserId: req.auth.userId, country, service, buyerBidPrice, otpMode, quantity, numberType });
    res.json(result);
  } catch (err) {
    fail(res, err);
  }
});
manualProvidersRouter.get("/requests/:id/bids", requireAuth, async (req, res) => {
  try {
    const col = await requestsCol();
    const request = await col.findOne({ _id: req.params.id });
    if (!request) throw new Error("Request not found");
    if (request.buyerUserId !== req.auth.userId && !req.auth.roles.includes("admin")) return res.status(403).json({ error: "Forbidden" });
    const bids = await listBidsForRequest(req.params.id);
    res.json(bids.map((b) => ({
      id: b._id, providerId: b.providerId, providerName: b.providerName, providerUsername: b.providerUsername,
      providerRating: b.providerRating, providerRatingCount: b.providerRatingCount, price: b.priceCustomer, stock: b.stock,
      successRate: b.successRate, avgResponseSec: b.avgResponseSec, createdAt: b.createdAt.toISOString(),
    })));
  } catch (err) {
    fail(res, err);
  }
});
manualProvidersRouter.post("/requests/:id/accept-bid", requireAuth, async (req, res) => {
  try {
    const bidId = String(req.body?.bidId ?? "");
    if (!bidId) throw new Error("Pick a bid first");
    const result = await acceptBid(req.params.id, req.auth.userId, bidId);
    res.json({ ok: true, newBalance: result.newBalance });
  } catch (err) {
    fail(res, err);
  }
});

manualProvidersRouter.post("/requests", requireAuth, async (req, res) => {
  try {
    const serviceId = String(req.body?.serviceId ?? "");
    if (!serviceId) throw new Error("Select a service first");
    const result = await createManualProviderRequest({ buyerUserId: req.auth.userId, serviceId });
    res.json(result);
  } catch (err) {
    fail(res, err);
  }
});

manualProvidersRouter.get("/requests/mine", requireAuth, async (req, res) => {
  try {
    const col = await requestsCol();
    const rows = await col.find({ buyerUserId: req.auth.userId }).sort({ createdAt: -1 }).limit(200).toArray();
    const settings = await loadManualProviderSettings();
    res.json(rows.map((r) => mapRequestForBuyer(r, settings.assignExpiryMinutes, settings.otpAutoConfirmMinutes)));
  } catch (err) {
    fail(res, err, 500);
  }
});

manualProvidersRouter.get("/requests/:id", requireAuth, async (req, res) => {
  try {
    const col = await requestsCol();
    const row = await col.findOne({ _id: req.params.id });
    if (!row) throw new Error("Request not found");
    const isOwner = row.buyerUserId === req.auth.userId;
    const isAdmin = req.auth.roles.includes("admin");
    let isProvider = false;
    if (req.auth.roles.includes("provider")) {
      const p = await (await providersCol()).findOne({ userId: req.auth.userId });
      isProvider = Boolean(p && p._id === row.providerId);
    }
    if (!isOwner && !isAdmin && !isProvider) return res.status(403).json({ error: "Forbidden" });
    const settings = await loadManualProviderSettings();
    // A seller looking at their own request sees their net earning; the
    // buyer (or admin) sees the buyer's total — never the other party's number.
    res.json(isProvider && !isOwner ? mapRequestForSeller(row, settings.assignExpiryMinutes, settings.otpAutoConfirmMinutes) : mapRequestForBuyer(row, settings.assignExpiryMinutes, settings.otpAutoConfirmMinutes));
  } catch (err) {
    fail(res, err);
  }
});

manualProvidersRouter.post("/requests/:id/confirm-otp", requireAuth, async (req, res) => {
  try {
    await buyerConfirmOtp(req.params.id, req.auth.userId);
    res.json({ ok: true });
  } catch (err) {
    fail(res, err);
  }
});
manualProvidersRouter.post("/requests/:id/resend-otp", requireAuth, async (req, res) => {
  try {
    const reason = req.body?.reason === "need_another" ? "need_another" : "wrong";
    await buyerRequestOtpResend(req.params.id, req.auth.userId, reason);
    res.json({ ok: true });
  } catch (err) {
    fail(res, err);
  }
});
manualProvidersRouter.post("/requests/:id/cancel", requireAuth, async (req, res) => {
  try {
    const newBalance = await cancelManualProviderRequestByBuyer(req.params.id, req.auth.userId);
    res.json({ ok: true, newBalance });
  } catch (err) {
    fail(res, err);
  }
});

// No chat feature exists — a dispute (with an optional proof screenshot,
// same base64 data: URL pattern the deposit-proof flow already uses) is
// the buyer's only recourse against a bad/stuck request. Capped by
// settings.maxDisputeRefunds server-side (see openDispute).
manualProvidersRouter.post("/requests/:id/dispute", requireAuth, async (req, res) => {
  try {
    const reason = String(req.body?.reason ?? "");
    const proofImage = req.body?.proofImage ? String(req.body.proofImage) : null;
    const dispute = await openDispute(req.params.id, req.auth.userId, reason, proofImage);
    res.json({ id: dispute._id, status: dispute.status });
  } catch (err) {
    fail(res, err);
  }
});

manualProvidersRouter.post("/requests/:id/review", requireAuth, async (req, res) => {
  try {
    const rating = Number(req.body?.rating);
    const comment = req.body?.comment ? String(req.body.comment) : null;
    await submitReview(req.params.id, req.auth.userId, rating, comment);
    res.json({ ok: true });
  } catch (err) {
    fail(res, err);
  }
});

// A "quote_requested" request (asked for a service with no preset price)
// becomes "quoted" once the seller names one — buyer accepts (pays now,
// same as the instant-buy flow) or declines (nothing was ever charged).
manualProvidersRouter.post("/requests/:id/accept-quote", requireAuth, async (req, res) => {
  try {
    const result = await acceptQuote(req.params.id, req.auth.userId);
    res.json({ ok: true, newBalance: result.newBalance });
  } catch (err) {
    fail(res, err);
  }
});
manualProvidersRouter.post("/requests/:id/decline-quote", requireAuth, async (req, res) => {
  try {
    await declineQuote(req.params.id, req.auth.userId);
    res.json({ ok: true });
  } catch (err) {
    fail(res, err);
  }
});

// assignExpiryMinutes threaded in (not loaded per-row) so listing many
// requests doesn't mean many settings reads — callers load it once.
// price is 0 as a real placeholder while status is "open" or
// "quote_requested" (nothing priced yet) — only ever show a real number
// once one actually exists (status "quoted" or later).
const NO_PRICE_YET_STATUSES = new Set(["open", "quote_requested"]);

/** Buyer-facing: always their own total (what they pay / paid). Never the
 * seller's raw price or the margin math — a buyer only ever needs to know
 * their own number. */
function mapRequestForBuyer(r: ManualProviderRequestDoc, assignExpiryMinutes: number, otpAutoConfirmMinutes = 10) {
  const hasPrice = !NO_PRICE_YET_STATUSES.has(r.status);
  return {
    id: r._id, code: r.code, providerId: r.providerId, serviceName: r.serviceName, country: r.country,
    price: hasPrice ? r.priceCustomer : null, status: r.status, resultNote: r.resultNote ?? null,
    number: r.number ?? null, otpCode: r.otpCode ?? null,
    otpMode: r.otpMode ?? "single", otpCount: r.otpHistory?.length ?? 0, quantity: r.quantity ?? 1, numberType: r.numberType ?? "any",
    // Frontend renders a live countdown from this while status is
    // "assigned" — after this time the background sweep in
    // lib/providers/autoSync.ts-style scheduler (index.ts) auto-refunds it.
    assignExpiresAt: r.status === "assigned" && r.assignedAt ? new Date(r.assignedAt.getTime() + assignExpiryMinutes * 60_000).toISOString() : null,
    // Same idea while an OTP is waiting on the buyer to confirm — after
    // this it auto-confirms and the seller gets paid regardless.
    otpAutoConfirmAt: r.status === "otp_sent" && r.otpDeliveredAt ? new Date(r.otpDeliveredAt.getTime() + otpAutoConfirmMinutes * 60_000).toISOString() : null,
    timeline: r.timeline.map((t) => ({ status: t.status, at: t.at.toISOString(), note: t.note ?? null })),
    createdAt: r.createdAt.toISOString(), assignedAt: r.assignedAt ? r.assignedAt.toISOString() : null,
    startedAt: r.startedAt ? r.startedAt.toISOString() : null,
    completedAt: r.completedAt ? r.completedAt.toISOString() : null,
    failedAt: r.failedAt ? r.failedAt.toISOString() : null,
    cancelledAt: r.cancelledAt ? r.cancelledAt.toISOString() : null,
  };
}

/** Seller-facing: always their own net earning (priceProvider), NEVER the
 * buyer's total/margin-inclusive price — "seller ko jo kam hoke mila hai
 * wahi show hona chahiye." Same shape as mapRequestForBuyer otherwise so
 * the frontend's SellerRequest type lines up, just a different `price`
 * source. */
function mapRequestForSeller(r: ManualProviderRequestDoc, assignExpiryMinutes: number, otpAutoConfirmMinutes = 10) {
  const hasPrice = !NO_PRICE_YET_STATUSES.has(r.status);
  return {
    id: r._id, code: r.code, serviceName: r.serviceName, country: r.country,
    price: hasPrice ? r.priceProvider : null, status: r.status, resultNote: r.resultNote ?? null,
    number: r.number ?? null, otpCode: r.otpCode ?? null,
    otpMode: r.otpMode ?? "single", otpCount: r.otpHistory?.length ?? 0, quantity: r.quantity ?? 1, numberType: r.numberType ?? "any",
    assignExpiresAt: r.status === "assigned" && r.assignedAt ? new Date(r.assignedAt.getTime() + assignExpiryMinutes * 60_000).toISOString() : null,
    otpAutoConfirmAt: r.status === "otp_sent" && r.otpDeliveredAt ? new Date(r.otpDeliveredAt.getTime() + otpAutoConfirmMinutes * 60_000).toISOString() : null,
    createdAt: r.createdAt.toISOString(), assignedAt: r.assignedAt ? r.assignedAt.toISOString() : null,
    startedAt: r.startedAt ? r.startedAt.toISOString() : null,
    completedAt: r.completedAt ? r.completedAt.toISOString() : null,
    failedAt: r.failedAt ? r.failedAt.toISOString() : null,
    cancelledAt: r.cancelledAt ? r.cancelledAt.toISOString() : null,
  };
}

// =====================================================================
// Seller panel (requireProvider)
// =====================================================================

manualProvidersRouter.get("/seller/me", requireProvider, async (req, res) => {
  try {
    const p = await providerForUser(req.auth.userId);
    const totalOutcomes = (p.completedRequests ?? 0) + (p.failedRequests ?? 0);
    const successRate = totalOutcomes > 0 ? Math.round(((p.completedRequests ?? 0) / totalOutcomes) * 100) : null;
    const reqCol = await requestsCol();
    const [activeCount, todayEarnings] = await Promise.all([
      reqCol.countDocuments({ providerId: p._id, status: { $in: ["assigned", "in_progress"] } }),
      reqCol.aggregate<{ _id: null; total: number }>([
        { $match: { providerId: p._id, status: "completed", completedAt: { $gte: new Date(new Date().setHours(0, 0, 0, 0)) } } },
        { $group: { _id: null, total: { $sum: "$priceProvider" } } },
      ]).toArray(),
    ]);
    res.json({
      id: p._id, companyName: p.companyName, status: p.status, online: p.online, priority: p.priority,
      pendingBalance: p.pendingBalance, availableBalance: p.availableBalance, totalEarnings: p.totalEarnings, totalPaidOut: p.totalPaidOut,
      completedRequests: p.completedRequests, failedRequests: p.failedRequests, successRate,
      activeRequests: activeCount, todayEarnings: Number((todayEarnings[0]?.total ?? 0).toFixed(2)),
    });
  } catch (err) {
    fail(res, err);
  }
});

manualProvidersRouter.patch("/seller/online", requireProvider, async (req, res) => {
  try {
    const p = await providerForUser(req.auth.userId);
    const online = Boolean(req.body?.online);
    const col = await providersCol();
    await col.updateOne({ _id: p._id }, { $set: { online, updatedAt: new Date() } });
    res.json({ ok: true, online });
  } catch (err) {
    fail(res, err);
  }
});

// Where admin actually sends a settlement payout — purely informational,
// this app never auto-transfers money, but without a record of it admin
// had no way to know where to pay a seller.
manualProvidersRouter.get("/seller/payout-details", requireProvider, async (req, res) => {
  try {
    const p = await providerForUser(req.auth.userId);
    res.json({ upiId: p.upiId ?? "", bankAccountName: p.bankAccountName ?? "", bankAccountNumber: p.bankAccountNumber ?? "", bankIfsc: p.bankIfsc ?? "" });
  } catch (err) {
    fail(res, err);
  }
});
manualProvidersRouter.patch("/seller/payout-details", requireProvider, async (req, res) => {
  try {
    const p = await providerForUser(req.auth.userId);
    const col = await providersCol();
    const set: Record<string, unknown> = { updatedAt: new Date() };
    if (req.body?.upiId !== undefined) set.upiId = String(req.body.upiId).trim() || null;
    if (req.body?.bankAccountName !== undefined) set.bankAccountName = String(req.body.bankAccountName).trim() || null;
    if (req.body?.bankAccountNumber !== undefined) set.bankAccountNumber = String(req.body.bankAccountNumber).trim() || null;
    if (req.body?.bankIfsc !== undefined) set.bankIfsc = String(req.body.bankIfsc).trim() || null;
    await col.updateOne({ _id: p._id }, { $set: set });
    res.json({ ok: true });
  } catch (err) {
    fail(res, err);
  }
});

// Real country/service names, reused straight from the existing OTP
// catalog (countries/services collections — the same ones Buy Number
// reads from) instead of making sellers type free text. "jo service jaati
// hai servers se vo sab bhi mil jaayegi seller ke paas" — sellers pick
// from the platform's real catalog, not invent their own service names.
manualProvidersRouter.get("/seller/catalog", requireProvider, async (_req, res) => {
  try {
    const countriesCol = await getCollection<{ name: string; enabled: boolean }>("countries");
    const servicesCol2 = await getCollection<{ name: string; enabled: boolean }>("services");
    const [countryNames, serviceNames] = await Promise.all([
      countriesCol.distinct("name", { enabled: true }),
      servicesCol2.distinct("name", { enabled: true }),
    ]);
    res.json({ countries: countryNames.sort(), services: serviceNames.sort() });
  } catch (err) {
    fail(res, err, 500);
  }
});

manualProvidersRouter.get("/seller/services", requireProvider, async (req, res) => {
  try {
    const p = await providerForUser(req.auth.userId);
    const col = await servicesCol();
    const rows = await col.find({ providerId: p._id }).sort({ createdAt: -1 }).toArray();
    res.json(rows.map(mapServiceForSeller));
  } catch (err) {
    fail(res, err);
  }
});

manualProvidersRouter.post("/seller/services", requireProvider, async (req, res) => {
  try {
    const p = await providerForUser(req.auth.userId);
    const service = String(req.body?.service ?? "").trim();
    const country = String(req.body?.country ?? "").trim();
    // null/blank price is valid — "ask for price" listing, the seller
    // quotes per-request instead of a fixed rate (see submitQuote below).
    const priceRaw = req.body?.price;
    const price = priceRaw === null || priceRaw === undefined || priceRaw === "" ? null : Number(priceRaw);
    if (!service) throw new Error("Service name is required");
    if (!country) throw new Error("Country is required");
    if (price !== null && (!Number.isFinite(price) || price <= 0)) throw new Error("Valid price is required");
    const capacity = Number.isFinite(Number(req.body?.capacity)) ? Math.max(1, Number(req.body.capacity)) : 1;
    const stock = Number.isFinite(Number(req.body?.stock)) ? Math.max(0, Number(req.body.stock)) : 1;
    const col = await servicesCol();
    const now = new Date();
    const doc: ManualProviderServiceDoc = {
      _id: crypto.randomUUID(), providerId: p._id, service, country, price, marginOverridePercent: null,
      status: "active", availability: "available", stock, capacity, priority: 0,
      completedRequests: 0, failedRequests: 0, avgResponseSec: null, responseSampleCount: 0, lastActiveAt: null,
      createdAt: now, updatedAt: now,
    };
    await col.insertOne(doc);
    res.json(mapServiceForSeller(doc));
  } catch (err) {
    fail(res, err);
  }
});

// Country picked ONCE, then every real service from the catalog shows as a
// toggle+price row (default all "on" conceptually — the seller only needs
// to touch the ones they DON'T want to offer, by simply not including them
// in `items`). One call creates/updates every listing the seller checked
// for this country; anything previously listed for this country that's
// no longer in `items` gets disabled (not deleted, so its history/stats
// survive) rather than silently orphaned.
manualProvidersRouter.post("/seller/services/bulk", requireProvider, async (req, res) => {
  try {
    const p = await providerForUser(req.auth.userId);
    const country = String(req.body?.country ?? "").trim();
    if (!country) throw new Error("Pick a country first");
    const items = Array.isArray(req.body?.items) ? req.body.items : [];
    const col = await servicesCol();
    const now = new Date();
    const keptServiceNames = new Set<string>();

    for (const item of items) {
      const service = String(item?.service ?? "").trim();
      if (!service) continue;
      // Blank/0 price = "on, but ask for a price on request" — not
      // skipped like before, since the seller explicitly toggled it on.
      const rawPrice = item?.price;
      const price = rawPrice === "" || rawPrice === null || rawPrice === undefined ? null : Number(rawPrice);
      if (price !== null && (!Number.isFinite(price) || price <= 0)) continue;
      const stock = Number.isFinite(Number(item?.stock)) ? Math.max(0, Number(item.stock)) : 1;
      keptServiceNames.add(service);
      const existing = await col.findOne({ providerId: p._id, country, service });
      if (existing) {
        await col.updateOne({ _id: existing._id }, { $set: { price, stock, status: "active", updatedAt: now } });
      } else {
        const doc: ManualProviderServiceDoc = {
          _id: crypto.randomUUID(), providerId: p._id, service, country, price, marginOverridePercent: null,
          status: "active", availability: "available", stock, capacity: 1, priority: 0,
          completedRequests: 0, failedRequests: 0, avgResponseSec: null, responseSampleCount: 0, lastActiveAt: null,
          createdAt: now, updatedAt: now,
        };
        await col.insertOne(doc);
      }
    }
    // Disable (never delete — preserves completedRequests/successRate
    // history) anything for this country that wasn't in this save.
    await col.updateMany(
      { providerId: p._id, country, service: { $nin: Array.from(keptServiceNames) } },
      { $set: { status: "disabled", updatedAt: now } },
    );

    const rows = await col.find({ providerId: p._id, country }).toArray();
    res.json(rows.map(mapServiceForSeller));
  } catch (err) {
    fail(res, err);
  }
});

manualProvidersRouter.patch("/seller/services/:id", requireProvider, async (req, res) => {
  try {
    const p = await providerForUser(req.auth.userId);
    const col = await servicesCol();
    const existing = await col.findOne({ _id: req.params.id });
    if (!existing || existing.providerId !== p._id) throw new Error("Service not found");
    const set: Record<string, unknown> = { updatedAt: new Date() };
    if (req.body?.price !== undefined) {
      if (req.body.price === null) {
        set.price = null; // switching to "ask for a price on request"
      } else {
        const price = Number(req.body.price);
        if (!Number.isFinite(price) || price <= 0) throw new Error("Valid price is required");
        set.price = price;
      }
    }
    if (req.body?.status !== undefined && ["active", "disabled"].includes(req.body.status)) set.status = req.body.status;
    if (req.body?.availability !== undefined && ["available", "busy", "offline"].includes(req.body.availability)) set.availability = req.body.availability;
    if (req.body?.capacity !== undefined) set.capacity = Math.max(1, Number(req.body.capacity) || 1);
    if (req.body?.stock !== undefined) set.stock = Math.max(0, Number(req.body.stock) || 0);
    const result = await col.findOneAndUpdate({ _id: req.params.id }, { $set: set }, { returnDocument: "after" });
    res.json(mapServiceForSeller(result!));
  } catch (err) {
    fail(res, err);
  }
});

function mapServiceForSeller(r: ManualProviderServiceDoc) {
  const totalOutcomes = (r.completedRequests ?? 0) + (r.failedRequests ?? 0);
  const successRate = totalOutcomes > 0 ? Math.round(((r.completedRequests ?? 0) / totalOutcomes) * 100) : null;
  return {
    id: r._id, service: r.service, country: r.country, price: r.price, status: r.status, availability: r.availability,
    stock: r.stock ?? 1, capacity: r.capacity, priority: r.priority, completedRequests: r.completedRequests, failedRequests: r.failedRequests,
    successRate, avgResponseSec: r.avgResponseSec, lastActiveAt: r.lastActiveAt ? r.lastActiveAt.toISOString() : null,
  };
}

manualProvidersRouter.get("/seller/requests", requireProvider, async (req, res) => {
  try {
    const p = await providerForUser(req.auth.userId);
    const status = String(req.query.status ?? "");
    const filter: Record<string, unknown> = { providerId: p._id };
    if (status === "active") filter.status = { $in: ["quote_requested", "quoted", "assigned", "in_progress", "otp_sent"] };
    else if (status) filter.status = status;
    const col = await requestsCol();
    const rows = await col.find(filter).sort({ createdAt: -1 }).limit(200).toArray();
    const settings = await loadManualProviderSettings();
    // "seller bhi dekh sakta hai isne kitne number liye hai pehle" — the
    // buyer's real track record (completed orders, approved disputes
    // against them), computed fresh per buyer, not a cached field.
    const buyerIds = Array.from(new Set(rows.map((r) => r.buyerUserId)));
    const statsEntries = await Promise.all(buyerIds.map(async (id) => [id, await getBuyerStats(id)] as const));
    const statsByBuyer = new Map(statsEntries);
    const usernameByBuyer = await resolveUsernames(buyerIds);
    res.json(rows.map((r) => ({
      ...mapRequestForSeller(r, settings.assignExpiryMinutes, settings.otpAutoConfirmMinutes),
      buyerStats: statsByBuyer.get(r.buyerUserId) ?? { completedCount: 0, disputeCount: 0 },
      buyerUsername: usernameByBuyer.get(r.buyerUserId) ?? "",
    })));
  } catch (err) {
    fail(res, err);
  }
});

// Open requests this seller could actually fulfil — intersected against
// their own active Services page listings (country+service match), not
// every open request on the platform. A seller who doesn't offer
// "Netflix in Brazil" never sees that request at all.
manualProvidersRouter.get("/seller/open-requests", requireProvider, async (req, res) => {
  try {
    const p = await providerForUser(req.auth.userId);
    const mySvcCol = await servicesCol();
    const myListings = await mySvcCol.find({ providerId: p._id, status: "active" }).toArray();
    const listingByKey = new Map(myListings.map((s) => [`${s.country}::${s.service}`, s]));

    // Show every open request platform-wide, not just ones matching a
    // listing this seller already has — otherwise a seller with only 1-2
    // services set up almost never sees anything on their board. Whether
    // they CAN bid (canBid) still depends on having a matching listing;
    // submitBid() enforces this server-side regardless of what the UI shows.
    const col = await requestsCol();
    const rows = await col.find({ status: "open" }).sort({ createdAt: -1 }).limit(100).toArray();

    const bidsCol = await getCollection<{ requestId: string; providerId: string; status: string }>("manual_provider_bids");
    const myBids = await bidsCol.find({ providerId: p._id, requestId: { $in: rows.map((r) => r._id) } }).toArray();
    const bidByRequest = new Map(myBids.map((b) => [b.requestId, b.status]));

    const settings = await loadManualProviderSettings();
    const buyerIds = Array.from(new Set(rows.map((r) => r.buyerUserId)));
    const statsEntries = await Promise.all(buyerIds.map(async (id) => [id, await getBuyerStats(id)] as const));
    const statsByBuyer = new Map(statsEntries);
    const usernameByBuyer = await resolveUsernames(buyerIds);

    res.json(rows.map((r) => {
      const listing = listingByKey.get(`${r.country}::${r.serviceName}`);
      const marginPercent = listing?.marginOverridePercent ?? settings.marginPercent;
      // "jo price user dega usse jo margin kam karna hai vo kam karke hi
      // seller ko dikhna chahiye" — the buyer's stated budget is their
      // total (margin-inclusive); sellers only ever see what they'd
      // actually net if they matched it, never the buyer's raw number.
      const buyerBudgetNet = r.buyerBidPrice ? computeProviderNetFromCustomerPrice(r.buyerBidPrice, marginPercent) : null;
      return {
        id: r._id, code: r.code, serviceName: r.serviceName, country: r.country, buyerBudgetNet,
        quantity: r.quantity ?? 1, numberType: r.numberType ?? "any",
        createdAt: r.createdAt.toISOString(), myBidStatus: bidByRequest.get(r._id) ?? null,
        canBid: !!listing,
        buyerStats: statsByBuyer.get(r.buyerUserId) ?? { completedCount: 0, disputeCount: 0 },
        buyerUsername: usernameByBuyer.get(r.buyerUserId) ?? "",
      };
    }));
  } catch (err) {
    fail(res, err);
  }
});
manualProvidersRouter.post("/seller/requests/:id/bid", requireProvider, async (req, res) => {
  try {
    await submitBid(req.params.id, req.auth.userId, Number(req.body?.price));
    res.json({ ok: true });
  } catch (err) {
    fail(res, err);
  }
});

manualProvidersRouter.post("/seller/requests/:id/quote", requireProvider, async (req, res) => {
  try { await submitQuote(req.params.id, req.auth.userId, Number(req.body?.price)); res.json({ ok: true }); }
  catch (err) { fail(res, err); }
});
manualProvidersRouter.post("/seller/requests/:id/start", requireProvider, async (req, res) => {
  try { await sellerStartRequest(req.params.id, req.auth.userId, String(req.body?.number ?? "")); res.json({ ok: true }); }
  catch (err) { fail(res, err); }
});
manualProvidersRouter.post("/seller/requests/:id/complete", requireProvider, async (req, res) => {
  try { await sellerSubmitOtp(req.params.id, req.auth.userId, String(req.body?.otpCode ?? "")); res.json({ ok: true }); }
  catch (err) { fail(res, err); }
});
manualProvidersRouter.post("/seller/requests/:id/fail", requireProvider, async (req, res) => {
  try {
    const reason = String(req.body?.reason ?? "Provider could not fulfil this request");
    await failManualProviderRequest(req.params.id, req.auth.userId, "provider", reason);
    res.json({ ok: true });
  } catch (err) { fail(res, err); }
});

manualProvidersRouter.get("/seller/ledger", requireProvider, async (req, res) => {
  try {
    const p = await providerForUser(req.auth.userId);
    const col = await getCollection<ManualProviderTxDoc>("manual_provider_transactions");
    const rows = await col.find({ providerId: p._id }).sort({ createdAt: -1 }).limit(200).toArray();
    res.json(rows.map((r) => ({ id: r._id, type: r.type, amount: r.amount, pendingBalanceAfter: r.pendingBalanceAfter, availableBalanceAfter: r.availableBalanceAfter, note: r.note, createdAt: r.createdAt.toISOString() })));
  } catch (err) {
    fail(res, err);
  }
});

manualProvidersRouter.get("/seller/settlements", requireProvider, async (req, res) => {
  try {
    const p = await providerForUser(req.auth.userId);
    const col = await getCollection<ManualProviderSettlementDoc>("manual_provider_settlements");
    const rows = await col.find({ providerId: p._id }).sort({ createdAt: -1 }).toArray();
    res.json(rows.map(mapSettlement));
  } catch (err) {
    fail(res, err);
  }
});

// Seller-initiated withdrawal — batches whatever's currently pending into
// a settlement request an admin still has to approve/pay. See
// lib/db/manualProviders.ts requestWithdrawal.
manualProvidersRouter.post("/seller/withdraw", requireProvider, async (req, res) => {
  try {
    const settlement = await requestWithdrawal(req.auth.userId);
    res.json(mapSettlement(settlement));
  } catch (err) {
    fail(res, err);
  }
});

// ---- Disputes (seller side: review + decide ones filed against them) ----
manualProvidersRouter.get("/seller/disputes", requireProvider, async (req, res) => {
  try {
    const p = await providerForUser(req.auth.userId);
    const col = await getCollection<ManualProviderDisputeDoc>("manual_provider_disputes");
    const rows = await col.find({ providerId: p._id }).sort({ createdAt: -1 }).toArray();
    res.json(rows.map(mapDispute));
  } catch (err) {
    fail(res, err);
  }
});
manualProvidersRouter.post("/seller/disputes/:id/decide", requireProvider, async (req, res) => {
  try {
    const decision = req.body?.decision === "approved" ? "approved" : req.body?.decision === "rejected" ? "rejected" : null;
    if (!decision) throw new Error("Invalid decision");
    await resolveDispute(req.params.id, decision, req.auth.userId, "provider");
    res.json({ ok: true });
  } catch (err) {
    fail(res, err);
  }
});

function mapDispute(r: ManualProviderDisputeDoc) {
  return {
    id: r._id, requestId: r.requestId, reason: r.reason, proofImage: r.proofImage,
    status: r.status, createdAt: r.createdAt.toISOString(), decidedAt: r.decidedAt ? r.decidedAt.toISOString() : null,
  };
}

function mapSettlement(r: ManualProviderSettlementDoc) {
  return {
    id: r._id, providerId: r.providerId, amount: r.amount, status: r.status, requestCount: r.requestCount,
    txnRef: r.txnRef ?? null, note: r.note ?? null, createdAt: r.createdAt.toISOString(), decidedAt: r.decidedAt ? r.decidedAt.toISOString() : null,
  };
}

// =====================================================================
// Admin (requireAdmin) — everything below reuses the existing Admin Panel,
// mounted at a distinct path prefix so the frontend can add a "Manual
// Provider" sidebar section without touching any existing admin route.
// =====================================================================

manualProvidersRouter.get("/admin/dashboard", requireAdmin, async (_req, res) => {
  try {
    const provCol = await providersCol();
    const reqCol = await requestsCol();
    const [providers, active, completed, failed, revenueAgg, todayStart] = await Promise.all([
      provCol.find({}).toArray(),
      reqCol.countDocuments({ status: { $in: ["assigned", "in_progress"] } }),
      reqCol.countDocuments({ status: "completed" }),
      reqCol.countDocuments({ status: { $in: ["failed", "cancelled", "refunded"] } }),
      reqCol.aggregate<{ _id: null; customer: number; provider: number; margin: number }>([
        { $match: { status: "completed" } },
        { $group: { _id: null, customer: { $sum: "$priceCustomer" }, provider: { $sum: "$priceProvider" }, margin: { $sum: "$marginAmount" } } },
      ]).toArray(),
      Promise.resolve(new Date(new Date().setHours(0, 0, 0, 0))),
    ]);
    const settleCol = await getCollection<ManualProviderSettlementDoc>("manual_provider_settlements");
    const pendingSettlements = await settleCol.countDocuments({ status: "pending" });
    const rev = revenueAgg[0] ?? { customer: 0, provider: 0, margin: 0 };
    const outcomeTotal = completed + failed;
    const avgSuccessRate = outcomeTotal > 0 ? Math.round((completed / outcomeTotal) * 100) : 0;

    const dailyAgg = await reqCol.aggregate<{ _id: string; requests: number; revenue: number; margin: number }>([
      { $match: { createdAt: { $gte: new Date(Date.now() - 13 * 86400_000) } } },
      { $group: { _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } }, requests: { $sum: 1 }, revenue: { $sum: "$priceCustomer" }, margin: { $sum: "$marginAmount" } } },
      { $sort: { _id: 1 } },
    ]).toArray();

    res.json({
      activeProviders: providers.filter((p) => p.status === "active").length,
      onlineProviders: providers.filter((p) => p.status === "active" && p.online).length,
      activeRequests: active, completedRequests: completed, failedRequests: failed,
      totalRevenue: Number(rev.customer.toFixed(2)), platformRevenue: Number(rev.margin.toFixed(2)), providerEarnings: Number(rev.provider.toFixed(2)),
      pendingSettlements, avgSuccessRate,
      daily: dailyAgg.map((d) => ({ date: d._id, requests: d.requests, revenue: Number(d.revenue.toFixed(2)), platformRevenue: Number(d.margin.toFixed(2)) })),
    });
  } catch (err) {
    fail(res, err, 500);
  }
});

manualProvidersRouter.get("/admin/providers", requireAdmin, async (_req, res) => {
  try {
    const col = await providersCol();
    const rows = await col.find({}).sort({ createdAt: -1 }).toArray();
    const users = await getCollection<UserDoc>("users");
    const userIds = rows.map((r) => r.userId);
    const userDocs = userIds.length ? await users.find({ _id: { $in: userIds } }).toArray() : [];
    const userById = new Map(userDocs.map((u) => [u._id, u]));
    res.json(rows.map((r) => mapProviderForAdmin(r, userById.get(r.userId))));
  } catch (err) {
    fail(res, err, 500);
  }
});

function mapProviderForAdmin(r: ManualProviderDoc, user?: UserDoc) {
  const totalOutcomes = (r.completedRequests ?? 0) + (r.failedRequests ?? 0);
  const successRate = totalOutcomes > 0 ? Math.round(((r.completedRequests ?? 0) / totalOutcomes) * 100) : null;
  return {
    id: r._id, userId: r.userId, email: user?.email ?? null, companyName: r.companyName, contactPhone: r.contactPhone ?? null,
    country: r.country ?? null, status: r.status, online: r.online, priority: r.priority,
    pendingBalance: r.pendingBalance, availableBalance: r.availableBalance, totalEarnings: r.totalEarnings, totalPaidOut: r.totalPaidOut,
    completedRequests: r.completedRequests, failedRequests: r.failedRequests, successRate,
    avgRating: r.avgRating ?? null, ratingCount: r.ratingCount ?? 0,
    upiId: r.upiId ?? null, bankAccountName: r.bankAccountName ?? null, bankAccountNumber: r.bankAccountNumber ?? null, bankIfsc: r.bankIfsc ?? null,
    createdAt: r.createdAt.toISOString(),
  };
}

manualProvidersRouter.get("/admin/providers/:id", requireAdmin, async (req, res) => {
  try {
    const col = await providersCol();
    const row = await col.findOne({ _id: req.params.id });
    if (!row) throw new Error("Provider not found");
    const users = await getCollection<UserDoc>("users");
    const user = await users.findOne({ _id: row.userId });
    const svcCol = await servicesCol();
    const services = await svcCol.find({ providerId: row._id }).sort({ createdAt: -1 }).toArray();
    const reqCol = await requestsCol();
    const recentRequests = await reqCol.find({ providerId: row._id }).sort({ createdAt: -1 }).limit(20).toArray();
    const settings = await loadManualProviderSettings();
    res.json({
      ...mapProviderForAdmin(row, user ?? undefined),
      services: services.map(mapServiceForSeller),
      recentRequests: recentRequests.map((r) => mapRequestForBuyer(r, settings.assignExpiryMinutes, settings.otpAutoConfirmMinutes)),
    });
  } catch (err) {
    fail(res, err);
  }
});

manualProvidersRouter.post("/admin/providers", requireAdmin, async (req, res) => {
  try {
    const email = String(req.body?.email ?? "").trim().toLowerCase();
    const companyName = String(req.body?.companyName ?? "").trim();
    if (!email) throw new Error("User email is required");
    if (!companyName) throw new Error("Company name is required");
    const users = await getCollection<UserDoc>("users");
    const user = await users.findOne({ emailLower: email });
    if (!user) throw new Error("No user with that email — they must sign up for a normal TenOTP account first");
    const col = await providersCol();
    if (await col.findOne({ userId: user._id })) throw new Error("This user is already a provider");

    const now = new Date();
    const doc: ManualProviderDoc = {
      _id: crypto.randomUUID(), userId: user._id, companyName, contactPhone: req.body?.contactPhone ?? null,
      country: req.body?.country ?? null, status: "active", online: false, priority: Number(req.body?.priority) || 0,
      pendingBalance: 0, availableBalance: 0, totalEarnings: 0, totalPaidOut: 0, completedRequests: 0, failedRequests: 0,
      avgRating: null, ratingCount: 0,
      createdAt: now, updatedAt: now,
    };
    await col.insertOne(doc);
    if (!user.roles.includes("provider")) {
      await users.updateOne({ _id: user._id }, { $addToSet: { roles: "provider" }, $set: { updatedAt: now } });
    }
    res.json(mapProviderForAdmin(doc, user));
  } catch (err) {
    fail(res, err);
  }
});

manualProvidersRouter.patch("/admin/providers/:id", requireAdmin, async (req, res) => {
  try {
    const col = await providersCol();
    const set: Record<string, unknown> = { updatedAt: new Date() };
    if (req.body?.companyName !== undefined) set.companyName = String(req.body.companyName).trim();
    if (req.body?.contactPhone !== undefined) set.contactPhone = req.body.contactPhone;
    if (req.body?.country !== undefined) set.country = req.body.country;
    if (req.body?.priority !== undefined) set.priority = Number(req.body.priority) || 0;
    if (req.body?.status !== undefined && ["active", "disabled"].includes(req.body.status)) set.status = req.body.status;
    const result = await col.findOneAndUpdate({ _id: req.params.id }, { $set: set }, { returnDocument: "after" });
    if (!result) throw new Error("Provider not found");
    res.json(mapProviderForAdmin(result));
  } catch (err) {
    fail(res, err);
  }
});

manualProvidersRouter.get("/admin/requests", requireAdmin, async (req, res) => {
  try {
    const status = String(req.query.status ?? "");
    const filter: Record<string, unknown> = {};
    if (status) filter.status = status;
    const col = await requestsCol();
    const rows = await col.find(filter).sort({ createdAt: -1 }).limit(300).toArray();
    const users = await getCollection<UserDoc>("users");
    const buyerIds = Array.from(new Set(rows.map((r) => r.buyerUserId)));
    const buyers = buyerIds.length ? await users.find({ _id: { $in: buyerIds } }).toArray() : [];
    const buyerById = new Map(buyers.map((u) => [u._id, u]));
    const settings = await loadManualProviderSettings();
    res.json(rows.map((r) => ({ ...mapRequestForBuyer(r, settings.assignExpiryMinutes, settings.otpAutoConfirmMinutes), buyerEmail: buyerById.get(r.buyerUserId)?.email ?? null })));
  } catch (err) {
    fail(res, err, 500);
  }
});

manualProvidersRouter.post("/admin/requests/:id/refund", requireAdmin, async (req, res) => {
  try {
    const reason = String(req.body?.reason ?? "Admin refund");
    const newBalance = await adminCancelManualProviderRequest(req.params.id, req.auth.userId, reason);
    res.json({ ok: true, newBalance });
  } catch (err) {
    fail(res, err);
  }
});

// Safety valve for a stuck in_progress/assigned request whose seller went
// unresponsive after already sending a number — completes it on their
// behalf (still credits their pendingBalance) instead of only being able
// to refund. Use /refund above instead if the buyer should get their
// money back rather than the job being force-closed.
manualProvidersRouter.post("/admin/requests/:id/force-complete", requireAdmin, async (req, res) => {
  try {
    const otpCode = String(req.body?.otpCode ?? "");
    const note = req.body?.note ? String(req.body.note) : undefined;
    await adminForceCompleteRequest(req.params.id, req.auth.userId, otpCode, note);
    res.json({ ok: true });
  } catch (err) {
    fail(res, err);
  }
});

manualProvidersRouter.get("/admin/settlements", requireAdmin, async (req, res) => {
  try {
    const status = String(req.query.status ?? "");
    const filter: Record<string, unknown> = {};
    if (status) filter.status = status;
    const col = await getCollection<ManualProviderSettlementDoc>("manual_provider_settlements");
    const rows = await col.find(filter).sort({ createdAt: -1 }).toArray();
    const provCol = await providersCol();
    const providerIds = Array.from(new Set(rows.map((r) => r.providerId)));
    const providers = providerIds.length ? await provCol.find({ _id: { $in: providerIds } }).toArray() : [];
    const providerById = new Map(providers.map((p) => [p._id, p]));
    res.json(rows.map((r) => {
      const p = providerById.get(r.providerId);
      return {
        ...mapSettlement(r), providerName: p?.companyName ?? null,
        upiId: p?.upiId ?? null, bankAccountName: p?.bankAccountName ?? null, bankAccountNumber: p?.bankAccountNumber ?? null, bankIfsc: p?.bankIfsc ?? null,
      };
    }));
  } catch (err) {
    fail(res, err, 500);
  }
});

manualProvidersRouter.post("/admin/settlements", requireAdmin, async (req, res) => {
  try {
    const providerId = String(req.body?.providerId ?? "");
    if (!providerId) throw new Error("Select a provider first");
    const settlement = await createSettlement(providerId, req.body?.note ? String(req.body.note) : undefined);
    res.json(mapSettlement(settlement));
  } catch (err) {
    fail(res, err);
  }
});

manualProvidersRouter.post("/admin/settlements/:id/decide", requireAdmin, async (req, res) => {
  try {
    const decision = String(req.body?.decision ?? "");
    if (!["approved", "paid", "rejected"].includes(decision)) throw new Error("Invalid decision");
    const settlement = await decideSettlement(req.params.id, decision as "approved" | "paid" | "rejected", req.auth.userId, req.body?.txnRef ? String(req.body.txnRef) : undefined);
    res.json(mapSettlement(settlement));
  } catch (err) {
    fail(res, err);
  }
});

manualProvidersRouter.get("/admin/settings", requireAdmin, async (_req, res) => {
  try {
    const s = await loadManualProviderSettings();
    res.json({ marginPercent: s.marginPercent, minCancelMs: s.minCancelMs, maxDisputeRefunds: s.maxDisputeRefunds, assignExpiryMinutes: s.assignExpiryMinutes, otpAutoConfirmMinutes: s.otpAutoConfirmMinutes });
  } catch (err) {
    fail(res, err);
  }
});

manualProvidersRouter.post("/admin/settings", requireAdmin, async (req, res) => {
  try {
    const s = await saveManualProviderSettings({
      marginPercent: req.body?.marginPercent !== undefined ? Number(req.body.marginPercent) : undefined,
      minCancelMs: req.body?.minCancelMs !== undefined ? Number(req.body.minCancelMs) : undefined,
      maxDisputeRefunds: req.body?.maxDisputeRefunds !== undefined ? Number(req.body.maxDisputeRefunds) : undefined,
      assignExpiryMinutes: req.body?.assignExpiryMinutes !== undefined ? Number(req.body.assignExpiryMinutes) : undefined,
      otpAutoConfirmMinutes: req.body?.otpAutoConfirmMinutes !== undefined ? Number(req.body.otpAutoConfirmMinutes) : undefined,
    });
    res.json({ marginPercent: s.marginPercent, minCancelMs: s.minCancelMs, maxDisputeRefunds: s.maxDisputeRefunds, assignExpiryMinutes: s.assignExpiryMinutes, otpAutoConfirmMinutes: s.otpAutoConfirmMinutes });
  } catch (err) {
    fail(res, err);
  }
});

// ---- Admin dispute oversight — can override either party's decision ----
manualProvidersRouter.get("/admin/disputes", requireAdmin, async (req, res) => {
  try {
    const status = String(req.query.status ?? "");
    const filter: Record<string, unknown> = {};
    if (status) filter.status = status;
    const col = await getCollection<ManualProviderDisputeDoc>("manual_provider_disputes");
    const rows = await col.find(filter).sort({ createdAt: -1 }).toArray();
    const users = await getCollection<UserDoc>("users");
    const provCol = await providersCol();
    const buyerIds = Array.from(new Set(rows.map((r) => r.buyerUserId)));
    const providerIds = Array.from(new Set(rows.map((r) => r.providerId)));
    const [buyers, providers] = await Promise.all([
      buyerIds.length ? users.find({ _id: { $in: buyerIds } }).toArray() : [],
      providerIds.length ? provCol.find({ _id: { $in: providerIds } }).toArray() : [],
    ]);
    const buyerById = new Map(buyers.map((u) => [u._id, u]));
    const providerById = new Map(providers.map((p) => [p._id, p]));
    res.json(rows.map((r) => ({ ...mapDispute(r), buyerEmail: buyerById.get(r.buyerUserId)?.email ?? null, providerName: providerById.get(r.providerId)?.companyName ?? null })));
  } catch (err) {
    fail(res, err, 500);
  }
});
manualProvidersRouter.post("/admin/disputes/:id/decide", requireAdmin, async (req, res) => {
  try {
    const decision = req.body?.decision === "approved" ? "approved" : req.body?.decision === "rejected" ? "rejected" : null;
    if (!decision) throw new Error("Invalid decision");
    await resolveDispute(req.params.id, decision, req.auth.userId, "admin");
    res.json({ ok: true });
  } catch (err) {
    fail(res, err);
  }
});
