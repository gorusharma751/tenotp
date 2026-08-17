// Creates every unique constraint / index the app relies on. Safe to re-run
// (createIndex is idempotent).
//
// Run with:  npm run db:indexes
import { MongoClient } from "mongodb";
import dns from "node:dns";

// `mongodb+srv://` needs a DNS SRV lookup, which Node's own resolver can fail
// even when the OS resolver works fine (seen on some Windows networks).
try {
  const current = dns.getServers();
  const fallback = ["8.8.8.8", "1.1.1.1"];
  dns.setServers([...current, ...fallback.filter((s) => !current.includes(s))]);
} catch {
  /* best-effort */
}

async function main() {
  const uri = process.env.MONGODB_URI;
  if (!uri) throw new Error("Missing MONGODB_URI");
  const dbName = process.env.MONGODB_DB_NAME || "tenotp";
  const client = new MongoClient(uri);
  await client.connect();
  const db = client.db(dbName);

  // users (was profiles + user_roles + auth.users)
  await db.collection("users").createIndex({ email: 1 }, { unique: true, collation: { locale: "en", strength: 2 } });
  await db.collection("users").createIndex({ referralCode: 1 }, { unique: true, sparse: true });
  await db.collection("users").createIndex({ referredBy: 1 });

  // countries / services (catalog)
  await db.collection("countries").createIndex({ code: 1 }, { unique: true });
  await db.collection("services").createIndex({ id: 1 }, { unique: true });

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

  console.log("[ensure-indexes] done.");
  await client.close();
}

main().catch((err) => {
  console.error("[ensure-indexes] failed:", err);
  process.exitCode = 1;
});
