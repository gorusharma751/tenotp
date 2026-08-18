// Payment gateway routes — Express port of the monolith's payments.functions.ts,
// paytm.functions.ts and razorpay.functions.ts createServerFn handlers. All
// money movement still happens only inside the transactional wallet engine
// (lib/db/wallet.ts); this router is glue only.
import { Router } from "express";
import { getCollection } from "../lib/mongo.ts";
import { requireAuth, requireAdmin } from "../middleware/auth.ts";

export const paymentsRouter = Router();

/* =========================================================================
 * Paytm Business dynamic-QR + BharatPe unique-amount-QR auto-credit flow
 * (mirrors src/lib/paytm.functions.ts)
 * ========================================================================= */

paymentsRouter.get("/paytm/status", async (_req, res) => {
  try {
    const { loadPaytmConfig, loadBharatpeConfig, isPaytmReady } = await import("../lib/paytm.ts");
    const cfg = await loadPaytmConfig();
    const bpe = await loadBharatpeConfig();
    res.json({
      enabled: cfg.enabled && isPaytmReady(cfg),
      ttlMinutes: cfg.qr_ttl_minutes,
      mode: cfg.mode,
      bharatpeEnabled: bpe.enabled && isPaytmReady(bpe),
      bharatpeTtlMinutes: bpe.qr_ttl_minutes,
      bharatpeShowUpiApps: Boolean(bpe.show_upi_apps),
    });
  } catch (err) {
    res.status(400).json({ error: err instanceof Error ? err.message : "Failed" });
  }
});

paymentsRouter.post("/paytm/create-qr", requireAuth, async (req, res) => {
  try {
    const amt = Math.round(Number(req.body?.amount));
    if (!Number.isFinite(amt) || amt < 10 || amt > 200000) {
      throw new Error("Amount must be between ₹10 and ₹200000");
    }
    const provider = req.body?.provider === "bharatpe" ? ("bharatpe" as const) : ("paytm" as const);

    const { loadQrConfig, createDynamicQr, isPaytmReady, buildUpiLink, uniqueUpiAmount } =
      await import("../lib/paytm.ts");
    const cfg = await loadQrConfig(provider);
    if (!cfg.enabled || !isPaytmReady(cfg))
      throw new Error("This payment method is not live yet. Please contact admin.");

    const orderId = `TEN${Date.now()}${Math.floor(Math.random() * 900 + 100)}`;
    const expiresAt = new Date(Date.now() + cfg.qr_ttl_minutes * 60_000);

    let payAmount = amt;
    let qrData = "";
    let qrImage = "";
    let qrCodeId = "";

    if (cfg.mode === "gateway") {
      const qr = await createDynamicQr(cfg, orderId, amt);
      qrData = qr.qrData;
      qrImage = qr.image;
      qrCodeId = qr.qrCodeId;
    } else {
      // No gateway key needed: unique-paise UPI QR straight to the merchant VPA.
      payAmount = await uniqueUpiAmount(amt);
      qrData = buildUpiLink(cfg, orderId, payAmount);
      // Admin ne apna merchant QR upload kiya ho to wahi dikhao.
      qrImage = String(cfg.qr_image_url ?? "");
    }

    const sessions = await getCollection<import("../lib/paytm.ts").PaytmSessionDoc>("paytm_sessions");
    const sessionId = crypto.randomUUID();
    await sessions.insertOne({
      _id: sessionId,
      userId: req.auth.userId,
      orderId,
      amount: payAmount,
      qrData,
      qrImage,
      qrCodeId,
      status: "pending",
      txnId: null,
      utr: null,
      depositId: null,
      note: null,
      expiresAt,
      creditedAt: null,
      createdAt: new Date(),
      provider,
    });

    res.json({
      sessionId,
      orderId,
      amount: payAmount,
      qrData,
      qrImage,
      expiresAt: expiresAt.toISOString(),
      ttlMinutes: cfg.qr_ttl_minutes,
      mode: cfg.mode,
      provider,
      upiId: cfg.mode === "upi" ? cfg.upi_id : "",
    });
  } catch (err) {
    res.status(400).json({ error: err instanceof Error ? err.message : "Could not create QR" });
  }
});

paymentsRouter.post("/paytm/check-qr", requireAuth, async (req, res) => {
  try {
    const sessionId = String(req.body?.sessionId ?? "").trim();
    if (!sessionId) throw new Error("Missing payment session");
    const sessions = await getCollection<import("../lib/paytm.ts").PaytmSessionDoc>("paytm_sessions");
    const s = await sessions.findOne({ _id: sessionId });
    if (!s) throw new Error("Payment session not found");
    if (s.userId !== req.auth.userId) throw new Error("Forbidden");

    const users = await getCollection<{ _id: string; walletBalance: number }>("users");

    if (s.status === "paid") {
      const p = await users.findOne({ _id: req.auth.userId });
      return res.json({
        status: "paid" as const,
        credited: true,
        balance: Number(p?.walletBalance ?? 0),
        message: "Payment received",
      });
    }

    const { loadQrConfig, fetchPaytmOrderStatus, creditPaytmSession } = await import("../lib/paytm.ts");
    const cfg = await loadQrConfig(s.provider === "bharatpe" ? "bharatpe" : "paytm");

    if (cfg.mode === "upi") {
      // BharatPe access token configured? Verify straight from the merchant API.
      if (s.provider === "bharatpe" && cfg.access_token) {
        try {
          const { findBharatpeCredit } = await import("../lib/paytm.ts");
          const hit = await findBharatpeCredit(cfg, Number(s.amount), s.createdAt.toISOString(), s.utr ?? undefined);
          if (hit) {
            const balance = await creditPaytmSession(
              s._id,
              hit.utr || s.orderId,
              `BharatPe auto-credit · UTR ${hit.utr || s.orderId}`,
            );
            await sessions.updateOne({ _id: s._id }, { $set: { utr: hit.utr || null } });
            return res.json({ status: "paid" as const, credited: true, balance, message: "Payment received" });
          }
        } catch (error) {
          const { BharatpeApiError, saveBharatpeTokenStatus } = await import("../lib/paytm.ts");
          if (error instanceof BharatpeApiError) {
            await saveBharatpeTokenStatus(error.status, error.message);
          }
          if (error instanceof BharatpeApiError && (error.status === "expired" || error.status === "invalid")) {
            return res.json({
              status: "token_expired" as const,
              credited: false,
              balance: null,
              message: "Auto verification token expired — submit UTR for verification",
            });
          }
          // Temporary API issue — webhook + UTR fallback still works.
        }
      }
      // Otherwise the forwarder webhook (or admin) credits it.
      // UTR submit ho chuka ho to session expire mat karo — verification chalti rehni chahiye.
      if (s.status === "utr_submitted") {
        return res.json({
          status: "pending" as const,
          credited: false,
          balance: null,
          message: "UTR submitted — verifying payment",
        });
      }
      if (s.expiresAt.getTime() < Date.now()) {
        await sessions.updateOne({ _id: s._id, status: "pending" }, { $set: { status: "expired" } });
        return res.json({
          status: "expired" as const,
          credited: false,
          balance: null,
          message: "QR expired — generate a new one",
        });
      }
      return res.json({ status: "pending" as const, credited: false, balance: null, message: "Waiting for payment" });
    }

    const r = await fetchPaytmOrderStatus(cfg, s.orderId);

    if (r.resultStatus === "TXN_SUCCESS") {
      const paid = Number(r.txnAmount ?? s.amount);
      if (paid + 0.01 < Number(s.amount)) {
        return res.json({ status: "pending" as const, credited: false, balance: null, message: "Amount mismatch — contact support" });
      }
      const balance = await creditPaytmSession(s._id, r.txnId ?? s.orderId, `Paytm QR auto-credit · ${r.txnId ?? s.orderId}`);
      return res.json({ status: "paid" as const, credited: true, balance, message: "Payment received" });
    }

    if (r.resultStatus === "TXN_FAILURE") {
      await sessions.updateOne({ _id: s._id }, { $set: { status: "failed", note: r.resultMsg } });
      return res.json({ status: "failed" as const, credited: false, balance: null, message: r.resultMsg || "Payment failed" });
    }

    if (s.expiresAt.getTime() < Date.now()) {
      await sessions.updateOne({ _id: s._id, status: "pending" }, { $set: { status: "expired" } });
      return res.json({ status: "expired" as const, credited: false, balance: null, message: "QR expired — generate a new one" });
    }
    res.json({ status: "pending" as const, credited: false, balance: null, message: r.resultMsg || "Waiting for payment" });
  } catch (err) {
    res.status(400).json({ error: err instanceof Error ? err.message : "Could not check QR status" });
  }
});

// User already paid but auto-check missed it: submit the UTR / reference.
// We re-check with the provider first; if still not confirmed we log a pending deposit for admin.
paymentsRouter.post("/paytm/submit-utr", requireAuth, async (req, res) => {
  try {
    const utr = String(req.body?.utr ?? "").trim();
    if (utr.length < 6) throw new Error("Enter a valid UTR / reference number");
    const sessionId = String(req.body?.sessionId ?? "").trim();

    const sessions = await getCollection<import("../lib/paytm.ts").PaytmSessionDoc>("paytm_sessions");
    const s = await sessions.findOne({ _id: sessionId });
    if (!s) throw new Error("Payment session not found");
    if (s.userId !== req.auth.userId) throw new Error("Forbidden");
    if (s.status === "paid") {
      const users = await getCollection<{ _id: string; walletBalance: number }>("users");
      const p = await users.findOne({ _id: req.auth.userId });
      return res.json({ credited: true, pending: false, balance: Number(p?.walletBalance ?? 0) });
    }

    const { loadQrConfig, fetchPaytmOrderStatus, creditPaytmSession } = await import("../lib/paytm.ts");
    const provider = s.provider === "bharatpe" ? ("bharatpe" as const) : ("paytm" as const);
    const cfg = await loadQrConfig(provider);
    try {
      if (cfg.mode === "upi") {
        if (provider === "bharatpe" && cfg.access_token) {
          const { findBharatpeCredit } = await import("../lib/paytm.ts");
          const hit = await findBharatpeCredit(cfg, Number(s.amount), s.createdAt.toISOString(), utr);
          if (hit) {
            const balance = await creditPaytmSession(s._id, hit.utr || utr, `BharatPe auto-credit · UTR ${hit.utr || utr}`);
            await sessions.updateOne({ _id: s._id }, { $set: { utr } });
            return res.json({ credited: true, pending: false, balance });
          }
        }
        throw new Error("manual review");
      }

      const r = await fetchPaytmOrderStatus(cfg, s.orderId);
      if (r.resultStatus === "TXN_SUCCESS") {
        const balance = await creditPaytmSession(s._id, r.txnId ?? utr, `Paytm QR auto-credit · UTR ${utr}`);
        await sessions.updateOne({ _id: s._id }, { $set: { utr } });
        return res.json({ credited: true, pending: false, balance });
      }
    } catch {
      /* fall back to manual review */
    }

    await sessions.updateOne(
      { _id: s._id },
      { $set: { utr, status: "utr_submitted", note: "User submitted UTR — awaiting admin review" } },
    );
    const deposits = await getCollection<{
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
    // A deposit may already exist for this session (a previous UTR
    // submission — e.g. a retry after a slow response, or resubmitting a
    // corrected UTR — that also fell through to manual review). Update it
    // in place instead of minting a second one: repeated submissions used
    // to create a fresh orphaned "pending" deposit every time, each one
    // separately approvable from the admin queue — letting one real
    // payment get credited more than once.
    if (s.depositId) {
      const existing = await deposits.findOne({ _id: s.depositId });
      if (existing && existing.status === "pending") {
        await deposits.updateOne(
          { _id: s.depositId },
          {
            $set: {
              utr,
              adminNote: `${provider === "bharatpe" ? "BharatPe" : "Paytm"} QR ${s.orderId} — UTR re-submitted by user`,
            },
          },
        );
        return res.json({ credited: false, pending: true, balance: null });
      }
    }
    const depositId = crypto.randomUUID();
    await deposits.insertOne({
      _id: depositId,
      userId: req.auth.userId,
      amount: Number(s.amount),
      method: provider === "bharatpe" ? "BharatPe" : "Paytm",
      currency: "INR",
      network: null,
      utr,
      screenshotUrl: null,
      status: "pending",
      adminNote: `${provider === "bharatpe" ? "BharatPe" : "Paytm"} QR ${s.orderId} — UTR submitted by user`,
      approvedBy: null,
      approvedAt: null,
      createdAt: new Date(),
    });
    await sessions.updateOne({ _id: s._id }, { $set: { depositId } });
    res.json({ credited: false, pending: true, balance: null });
  } catch (err) {
    res.status(400).json({ error: err instanceof Error ? err.message : "Could not submit UTR" });
  }
});

paymentsRouter.get("/paytm/admin-config", requireAdmin, async (_req, res) => {
  try {
    const { ensureWebhookToken, maskSecret, isPaytmReady } = await import("../lib/paytm.ts");
    const cfg = await ensureWebhookToken();
    res.json({
      mid: cfg.mid,
      env: cfg.env,
      enabled: cfg.enabled,
      qr_ttl_minutes: cfg.qr_ttl_minutes,
      key_masked: maskSecret(cfg.merchant_key),
      mode: cfg.mode,
      upi_id: cfg.upi_id,
      payee_name: cfg.payee_name,
      webhook_token: cfg.webhook_token,
      configured: isPaytmReady(cfg),
    });
  } catch (err) {
    res.status(400).json({ error: err instanceof Error ? err.message : "Failed" });
  }
});

paymentsRouter.post("/paytm/admin-config", requireAdmin, async (req, res) => {
  try {
    const b = req.body ?? {};
    const data = {
      mid: String(b.mid ?? "").trim(),
      merchant_key: String(b.merchant_key ?? "").trim(),
      env: b.env === "staging" ? ("staging" as const) : ("production" as const),
      enabled: Boolean(b.enabled),
      qr_ttl_minutes: Math.min(30, Math.max(1, Math.round(Number(b.qr_ttl_minutes ?? 5)) || 5)),
      mode: b.mode === "gateway" ? ("gateway" as const) : ("upi" as const),
      upi_id: String(b.upi_id ?? "").trim(),
      payee_name: String(b.payee_name ?? "").trim(),
    };
    const { loadPaytmConfig, patchPaytmConfig } = await import("../lib/paytm.ts");
    const existing = await loadPaytmConfig();
    const mid = data.mid || existing.mid;
    const merchant_key = data.merchant_key || existing.merchant_key;
    const upi_id = data.upi_id || existing.upi_id;
    const payee_name = data.payee_name || existing.payee_name || "TenOTP";
    if (data.enabled && data.mode === "gateway" && (!mid || !merchant_key)) {
      throw new Error("Add MID and Merchant Key before going live");
    }
    if (data.enabled && data.mode === "upi" && !upi_id) {
      throw new Error("Add your Paytm merchant UPI ID before going live");
    }
    const webhook_token = existing.webhook_token || crypto.randomUUID().replace(/-/g, "");
    const saved = await patchPaytmConfig({
      mid,
      merchant_key,
      env: data.env,
      enabled: data.enabled,
      qr_ttl_minutes: data.qr_ttl_minutes,
      mode: data.mode,
      upi_id,
      payee_name,
      webhook_token,
    });
    res.json({ ok: true, webhook_token: saved.webhook_token });
  } catch (err) {
    res.status(400).json({ error: err instanceof Error ? err.message : "Could not save Paytm config" });
  }
});

/* ---------- BharatPe merchant (UPI QR auto-credit) ---------- */

paymentsRouter.get("/bharatpe/admin-config", requireAdmin, async (_req, res) => {
  try {
    const { loadBharatpeConfig, isPaytmReady, maskSecret, BHARATPE_DEFAULT_API_URL } = await import("../lib/paytm.ts");
    const cfg = await loadBharatpeConfig();
    const token_status = cfg.access_token ? cfg.token_status || "unavailable" : "not_configured";
    const token_message = cfg.access_token
      ? cfg.token_message || "Click Test to verify the saved access token"
      : "Access token not configured";
    res.json({
      merchant_id: cfg.merchant_id ?? "",
      upi_id: cfg.upi_id,
      payee_name: cfg.payee_name,
      enabled: cfg.enabled,
      qr_ttl_minutes: cfg.qr_ttl_minutes,
      webhook_token: cfg.webhook_token,
      access_token_masked: maskSecret(cfg.access_token ?? ""),
      has_access_token: Boolean(cfg.access_token),
      token_status,
      token_message,
      token_checked_at: cfg.token_checked_at || null,
      api_url: cfg.api_url || BHARATPE_DEFAULT_API_URL,
      qr_image_url: cfg.qr_image_url ?? "",
      show_upi_apps: Boolean(cfg.show_upi_apps),
      configured: isPaytmReady(cfg),
    });
  } catch (err) {
    res.status(400).json({ error: err instanceof Error ? err.message : "Failed" });
  }
});

/** Admin live feed: reads the transaction list using the saved merchant token. */
paymentsRouter.get("/bharatpe/admin-transactions", requireAdmin, async (_req, res) => {
  const { loadBharatpeConfig, fetchBharatpeTransactions, BharatpeApiError } = await import("../lib/paytm.ts");
  const cfg = await loadBharatpeConfig();
  if (!cfg.access_token) {
    return res.json({
      ok: false as const,
      transactions: [],
      error: "Access token not configured",
      status: "not_configured" as const,
      scannedAt: new Date().toISOString(),
    });
  }
  try {
    const transactions = await fetchBharatpeTransactions(cfg);
    res.json({ ok: true as const, transactions, error: null, status: "working" as const, scannedAt: new Date().toISOString() });
  } catch (error) {
    res.json({
      ok: false as const,
      transactions: [],
      error: error instanceof Error ? error.message : "Transaction scan failed",
      status: error instanceof BharatpeApiError ? error.status : ("unavailable" as const),
      scannedAt: new Date().toISOString(),
    });
  }
});

paymentsRouter.post("/bharatpe/admin-config", requireAdmin, async (req, res) => {
  try {
    const b = req.body ?? {};
    const qr = String(b.qr_image_url ?? "").trim();
    if (qr && qr !== "__clear__" && !/^(https:\/\/|data:image\/(png|jpe?g|webp);base64,)/i.test(qr)) {
      throw new Error("QR image must be an https URL or an uploaded image");
    }
    if (qr.length > 1_500_000) throw new Error("QR image is too large — upload a smaller image");
    const data = {
      merchant_id: String(b.merchant_id ?? "").trim(),
      upi_id: String(b.upi_id ?? "").trim(),
      payee_name: String(b.payee_name ?? "").trim(),
      enabled: Boolean(b.enabled),
      qr_ttl_minutes: Math.min(30, Math.max(1, Math.round(Number(b.qr_ttl_minutes ?? 5)) || 5)),
      webhook_token: String(b.webhook_token ?? "").trim(),
      access_token: String(b.access_token ?? "").trim(),
      api_url: String(b.api_url ?? "").trim(),
      qr_image_url: qr,
      show_upi_apps: Boolean(b.show_upi_apps),
    };

    const { loadBharatpeConfig, patchBharatpeConfig, BHARATPE_DEFAULT_API_URL } = await import("../lib/paytm.ts");
    const existing = await loadBharatpeConfig();
    // This is a fully-controlled form (the Settings page always submits its
    // whole current state), so a blank upi_id/merchant_id here means the
    // admin genuinely cleared the field — persist it as-is rather than
    // silently falling back to the old value (which made those two fields
    // impossible to clear via the form; unlike access_token/qr_image_url,
    // they don't need an explicit "__clear__" sentinel).
    const upi_id = data.upi_id;
    if (data.enabled && !upi_id) throw new Error("Add your BharatPe merchant UPI ID before going live");
    if (data.api_url) {
      let parsed: URL;
      try {
        parsed = new URL(data.api_url);
      } catch {
        throw new Error("Enter a valid Transactions API URL");
      }
      if (parsed.protocol !== "https:" || parsed.username || parsed.password || /\s/.test(data.api_url)) {
        throw new Error("Enter a valid secure Transactions API URL without spaces");
      }
    }
    const nextAccessToken = data.access_token === "__clear__" ? "" : data.access_token || existing.access_token || "";
    const tokenChanged = nextAccessToken !== (existing.access_token || "");
    const saved = await patchBharatpeConfig({
      merchant_id: data.merchant_id,
      upi_id,
      payee_name: data.payee_name || existing.payee_name || "TenOTP",
      enabled: data.enabled,
      qr_ttl_minutes: data.qr_ttl_minutes,
      webhook_token: data.webhook_token || existing.webhook_token || crypto.randomUUID().replace(/-/g, ""),
      // Blank input never wipes a saved token; use the clear button instead.
      access_token: nextAccessToken,
      ...(tokenChanged
        ? {
            token_status: nextAccessToken ? ("unavailable" as const) : undefined,
            token_message: nextAccessToken ? "New access token saved — testing connection" : "Access token not configured",
            token_checked_at: "",
          }
        : {}),
      api_url: data.api_url || existing.api_url?.trim() || BHARATPE_DEFAULT_API_URL,
      qr_image_url: data.qr_image_url === "__clear__" ? "" : data.qr_image_url || existing.qr_image_url || "",
      show_upi_apps: data.show_upi_apps,
    });
    res.json({ ok: true, webhook_token: saved.webhook_token });
  } catch (err) {
    res.status(400).json({ error: err instanceof Error ? err.message : "Could not save BharatPe config" });
  }
});

/** Admin "Test token" button: verifies the access token can read BharatPe transactions. */
paymentsRouter.post("/bharatpe/test-token", requireAdmin, async (req, res) => {
  try {
    const access_token = String(req.body?.access_token ?? "").trim();
    const merchant_id = String(req.body?.merchant_id ?? "").trim();
    const api_url = String(req.body?.api_url ?? "").trim();

    const { loadBharatpeConfig, fetchBharatpeTransactions, patchBharatpeConfig } = await import("../lib/paytm.ts");
    let cfg = await loadBharatpeConfig();
    if (access_token) {
      cfg = await patchBharatpeConfig({
        access_token,
        merchant_id: merchant_id || cfg.merchant_id,
        api_url: api_url || cfg.api_url,
        token_status: "unavailable",
        token_message: "Testing newly saved access token",
        token_checked_at: "",
      });
    }
    if (!cfg.access_token) throw new Error("Add the BharatPe access token first");
    try {
      const txns = await fetchBharatpeTransactions(cfg);
      const { saveBharatpeTokenStatus } = await import("../lib/paytm.ts");
      await saveBharatpeTokenStatus(
        "working",
        txns.length > 0
          ? `Access token is working · ${txns.length} recent transaction${txns.length === 1 ? "" : "s"} fetched`
          : "Access token is working · no recent transactions returned",
      );
      res.json({ ok: true, status: "working" as const, count: txns.length, latest: txns[0]?.amount ?? null });
    } catch (e) {
      const { BharatpeApiError, saveBharatpeTokenStatus } = await import("../lib/paytm.ts");
      const status = e instanceof BharatpeApiError ? e.status : ("unavailable" as const);
      await saveBharatpeTokenStatus(status, (e as Error).message);
      res.json({ ok: false, status, count: 0, latest: null, error: (e as Error).message });
    }
  } catch (err) {
    res.status(400).json({ error: err instanceof Error ? err.message : "Test failed" });
  }
});

/* =========================================================================
 * Razorpay (mirrors src/lib/razorpay.functions.ts)
 * ========================================================================= */

paymentsRouter.post("/razorpay/create-order", requireAuth, async (req, res) => {
  try {
    const amt = Math.floor(Number(req.body?.amount));
    if (!Number.isFinite(amt) || amt < 10 || amt > 500000) {
      throw new Error("Amount must be between ₹10 and ₹500000");
    }
    const { createRazorpayOrder } = await import("../lib/razorpay.ts");
    res.json(await createRazorpayOrder(req.auth.userId, amt));
  } catch (err) {
    res.status(400).json({ error: err instanceof Error ? err.message : "Could not create Razorpay order" });
  }
});

paymentsRouter.post("/razorpay/verify", requireAuth, async (req, res) => {
  try {
    const orderId = String(req.body?.razorpay_order_id ?? "").trim();
    const paymentId = String(req.body?.razorpay_payment_id ?? "").trim();
    const signature = String(req.body?.razorpay_signature ?? "").trim();
    if (!orderId || !paymentId || !signature) throw new Error("Missing Razorpay payment details");

    const { verifyRazorpayPayment } = await import("../lib/razorpay.ts");
    res.json(
      await verifyRazorpayPayment(req.auth.userId, {
        razorpay_order_id: orderId,
        razorpay_payment_id: paymentId,
        razorpay_signature: signature,
      }),
    );
  } catch (err) {
    res.status(400).json({ error: err instanceof Error ? err.message : "Razorpay verification failed" });
  }
});

paymentsRouter.get("/razorpay/config", async (_req, res) => {
  const { getRazorpayConfig } = await import("../lib/razorpay.ts");
  res.json(await getRazorpayConfig());
});

paymentsRouter.get("/razorpay/admin-status", requireAdmin, async (_req, res) => {
  const { getRazorpayAdminStatus } = await import("../lib/razorpay.ts");
  res.json(await getRazorpayAdminStatus());
});

paymentsRouter.post("/razorpay/admin-config", requireAdmin, async (req, res) => {
  try {
    const b = req.body ?? {};
    const { saveRazorpayConfig } = await import("../lib/razorpay.ts");
    res.json(
      await saveRazorpayConfig({
        key_id: b.key_id !== undefined ? String(b.key_id) : undefined,
        key_secret: b.key_secret !== undefined ? String(b.key_secret) : undefined,
        enabled: b.enabled !== undefined ? Boolean(b.enabled) : undefined,
      }),
    );
  } catch (err) {
    res.status(400).json({ error: err instanceof Error ? err.message : "Could not save Razorpay config" });
  }
});
