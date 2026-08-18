// Creates every unique constraint / index the app relies on, and drops any
// known-stale ones. createIndex/dropIndex (with the "already gone" catch)
// are both idempotent, so this is safe to call on every server boot — see
// index.ts, which does exactly that. It's also still runnable standalone
// via `npm run db:indexes` (scripts/ensure-indexes.ts) for local dev.
//
// Running this automatically on boot means a stale/incorrect index — like
// the countries/services one this file used to create — self-heals on the
// next deploy instead of needing someone to manually run a script (which,
// on a hosting plan without shell access, may not even be possible).
import type { Db } from "mongodb";

export async function ensureIndexes(db: Db): Promise<void> {
  // users (was profiles + user_roles + auth.users)
  await db.collection("users").createIndex({ email: 1 }, { unique: true, collation: { locale: "en", strength: 2 } });
  await db.collection("users").createIndex({ referralCode: 1 }, { unique: true, sparse: true });
  await db.collection("users").createIndex({ referredBy: 1 });

  // countries / services (catalog) — these collections key on their own
  // `_id` (e.g. "gr_7", "fs_wa"), set directly by lib/providers/catalogSync.ts
  // and routes/public.ts's sync jobs. There is no separate `code`/`id`
  // field on either doc — a stale unique index on those non-existent
  // fields used to sit here from an earlier schema; since every document
  // was missing the field, they all collided as duplicate `null`s the
  // moment a sync tried to upsert more than one country/service, throwing
  // "E11000 duplicate key error ... dup key: { code: null }" and silently
  // blocking the entire catalog sync feature. Dropped rather than kept —
  // _id is already unique and is the only key this data actually has.
  try { await db.collection("countries").dropIndex("code_1"); } catch { /* already gone */ }
  try { await db.collection("services").dropIndex("id_1"); } catch { /* already gone */ }

  // providers + sub-catalogs
  await db.collection("providers").createIndex({ kind: 1 });
  await db.collection("provider_services").createIndex({ providerId: 1, externalId: 1 }, { unique: true });
  await db.collection("provider_services").createIndex({ providerId: 1, externalCategory: 1 });
  await db.collection("provider_categories").createIndex({ providerId: 1, externalId: 1 }, { unique: true });
  await db.collection("service_mappings").createIndex({ internalServiceId: 1, providerServiceId: 1 }, { unique: true });
  await db.collection("price_rules").createIndex({ providerId: 1 });
  await db.collection("sync_logs").createIndex({ providerId: 1, startedAt: -1 });
  await db.collection("provider_logs").createIndex({ providerId: 1, at: -1 });

  // numbers / orders
  await db.collection("numbers_inventory").createIndex({ assignedTo: 1 });
  await db.collection("orders").createIndex({ userId: 1, createdAt: -1 });
  await db.collection("orders").createIndex({ status: 1 });
  await db.collection("order_events").createIndex({ orderId: 1, createdAt: 1 });

  // rentals
  await db.collection("rentals").createIndex({ userId: 1 });

  // wallet / money
  await db.collection("wallet_tx").createIndex({ userId: 1, createdAt: -1 });
  await db.collection("deposits").createIndex({ userId: 1, createdAt: -1 });
  // Closes the dedupe race in verifyRazorpayPayment/creditPaytmSession (check-then-insert
  // on utr): a partial unique index means only non-null UTRs are constrained, so manual
  // UPI deposits without a UTR yet aren't blocked from coexisting.
  await db.collection("deposits").createIndex(
    { utr: 1 },
    { unique: true, partialFilterExpression: { utr: { $type: "string" } }, collation: { locale: "en", strength: 2 } },
  );
  await db.collection("payments").createIndex({ userId: 1, createdAt: -1 });
  await db.collection("refunds").createIndex({ userId: 1 });
  await db.collection("refunds").createIndex({ orderId: 1 });

  // coupons
  await db.collection("coupons").createIndex({ code: 1 }, { unique: true });
  await db.collection("coupon_redemptions").createIndex({ couponId: 1, userId: 1 }, { unique: true });

  // referrals
  await db.collection("referrals").createIndex({ referrerId: 1, referredId: 1 }, { unique: true });
  // referral_settings is a fixed singleton doc: _id: "singleton" — no index needed.

  // support
  await db.collection("tickets").createIndex({ userId: 1 });
  await db.collection("ticket_messages").createIndex({ ticketId: 1, createdAt: 1 });

  // api keys
  await db.collection("api_keys").createIndex({ userId: 1 });

  // notifications
  await db.collection("notifications").createIndex({ userId: 1, createdAt: -1 });
  await db.collection("admin_notifications").createIndex({ status: 1 });

  // audit / media
  await db.collection("audit_logs").createIndex({ createdAt: -1 });
  await db.collection("media").createIndex({ uploadedAt: -1 });

  // settings (app_settings/admin_secrets use a fixed string _id = key, no extra index needed)

  // reseller
  await db.collection("reseller_panels").createIndex({ slug: 1 }, { unique: true });
  await db.collection("reseller_panels").createIndex({ ownerUserId: 1 });
  await db.collection("reseller_wallet_tx").createIndex({ panelId: 1, createdAt: -1 });

  // admin permissions
  await db.collection("admin_permissions").createIndex({ userId: 1, permissionKey: 1 }, { unique: true });

  // paytm / UPI sessions
  await db.collection("paytm_sessions").createIndex({ orderId: 1 }, { unique: true });
  await db.collection("paytm_sessions").createIndex({ userId: 1, createdAt: -1 });
  await db.collection("paytm_sessions").createIndex({ status: 1, expiresAt: 1 });
  // Defense-in-depth alongside the app-level duplicate-txnId check in
  // creditPaytmSession: no two *paid* sessions can ever share the same
  // txnId, even if a future code path forgets the application-level guard.
  await db.collection("paytm_sessions").createIndex(
    { txnId: 1 },
    { unique: true, partialFilterExpression: { status: "paid", txnId: { $type: "string" } } },
  );

  // rate limiting (service-only collection)
  await db.collection("rate_limits").createIndex({ bucket: 1, key: 1 }, { unique: true });

  // payment gateway (BharatPe-style)
  await db.collection("payment_orders").createIndex({ orderId: 1 }, { unique: true });
  await db.collection("payment_orders").createIndex({ userId: 1, createdAt: -1 });
  await db.collection("payment_transactions").createIndex({ utr: 1 }, { unique: true, collation: { locale: "en", strength: 2 } });
  await db.collection("payment_transactions").createIndex(
    { provider: 1, providerTransactionId: 1 },
    { unique: true, partialFilterExpression: { providerTransactionId: { $type: "string" } } },
  );
  await db.collection("payment_events").createIndex({ paymentOrderId: 1 });
  await db.collection("credit_ledger").createIndex({ userId: 1, createdAt: -1 });
}
