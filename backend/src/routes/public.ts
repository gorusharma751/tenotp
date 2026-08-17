import { Router } from "express";
import { timingSafeEqual } from "crypto";
import { getCollection } from "../lib/mongo.ts";
import { checkWebhookLimit, clientIpFrom } from "../lib/rateLimit.ts";
import { upiWebhookSchema } from "../lib/validation.ts";
import { grizzly, serviceMeta, guessMetaFromName, COUNTRY_FLAGS, getSmsClientByKind } from "../lib/grizzly.ts";

export const publicRouter = Router();

/** Constant-time compare of the `x-cron-secret` / `Authorization: Bearer` header against CRON_SECRET. */
function checkCronSecret(req: import("express").Request): boolean {
  const expected = process.env.CRON_SECRET ?? "";
  const headerBearer = req.headers.authorization?.replace(/^Bearer\s+/i, "");
  const provided = String((req.headers["x-cron-secret"] as string | undefined) ?? headerBearer ?? "");
  if (!expected || !provided) return false;
  const a = Buffer.from(expected);
  const b = Buffer.from(provided);
  return a.length === b.length && timingSafeEqual(a, b);
}

type CountryDoc = {
  _id: string;
  name: string;
  flag: string;
  numbersAvailable: number;
  priceFrom: number;
  enabled: boolean;
  operators: number;
  priority: number;
  createdAt: Date;
  updatedAt: Date;
};
type ServiceDoc = {
  _id: string;
  name: string;
  icon: string;
  category: string;
  price: number;
  successRate: number;
  enabled: boolean;
  countries: number;
  orders: number;
  createdAt: Date;
  updatedAt: Date;
};

type AppSettingDoc = { _id: string; value: unknown };

// Public (no auth) read of the same contact-link settings the admin panel
// manages via GET/POST /api/admin/contact-links — ContactButtons, the footer,
// and the Telegram join dialog on public pages need these without a session.
publicRouter.get("/contact-links", async (_req, res) => {
  try {
    const settingsCol = await getCollection<AppSettingDoc>("app_settings");
    const keys = [
      "telegram_group_url",
      "telegram_support_url",
      "whatsapp_url",
      "telegram_announcement_title",
      "telegram_announcement_text",
      "telegram_announcement_version",
    ];
    const rows = await settingsCol.find({ _id: { $in: keys } }).toArray();
    const map = new Map<string, unknown>(rows.map((r) => [r._id, r.value]));
    const val = (k: string) => (typeof map.get(k) === "string" ? (map.get(k) as string) : "");
    res.json({
      telegramGroup: val("telegram_group_url"),
      telegramSupport: val("telegram_support_url"),
      whatsapp: val("whatsapp_url"),
      announcementTitle: val("telegram_announcement_title"),
      announcementText: val("telegram_announcement_text"),
      announcementVersion: val("telegram_announcement_version"),
    });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : "Could not load contact links" });
  }
});

function safePriority(cid: string) {
  const n = Number(cid);
  return Number.isFinite(n) && n >= 0 && n < 100000 ? n + 1 : 999;
}

// Cron hook — invoke every 6 hours from an external scheduler to refresh the
// Grizzly catalog. Protected by the CRON_SECRET header check above.
publicRouter.post("/sync-grizzly", async (req, res) => {
  if (!checkCronSecret(req)) return res.status(401).json({ error: "unauthorized" });

  const body: { markupPercent?: number; usdtToInr?: number } = req.body ?? {};
  const markupPercent = Math.max(0, Number(body.markupPercent ?? 15));
  const usdtToInr = Number(body.usdtToInr ?? 102);

  try {
    const [countries, prices, servicesList] = await Promise.all([
      grizzly.getCountries(),
      grizzly.getPrices(),
      grizzly.getServicesList() as Promise<{ services?: Array<{ code: string; name: string }> }>,
    ]);
    const nameByCode = new Map<string, string>();
    for (const s of servicesList?.services ?? []) {
      if (s?.code && s?.name) nameByCode.set(s.code, s.name);
    }
    const markup = 1 + markupPercent / 100;

    const svcMinPrice = new Map<string, number>();
    const svcCountryCount = new Map<string, Set<string>>();
    const countryMinPrice = new Map<string, number>();
    const countryStock = new Map<string, number>();

    for (const [countryId, byService] of Object.entries(prices)) {
      for (const [code, info] of Object.entries(byService)) {
        const cost = Number(info.cost);
        const count = Number(info.count) || 0;
        if (!Number.isFinite(cost) || cost <= 0) continue;
        if (!nameByCode.has(code)) continue;
        const cur = svcMinPrice.get(code);
        if (cur === undefined || cost < cur) svcMinPrice.set(code, cost);
        if (!svcCountryCount.has(code)) svcCountryCount.set(code, new Set());
        svcCountryCount.get(code)!.add(countryId);
        const cCur = countryMinPrice.get(countryId);
        if (cCur === undefined || cost < cCur) countryMinPrice.set(countryId, cost);
        countryStock.set(countryId, (countryStock.get(countryId) ?? 0) + count);
      }
    }

    const prefix = (raw: string) => `gr_${raw}`;

    const countryRows = Array.from(countryMinPrice.entries()).map(([cid, minUsdt]) => {
      const info = countries[cid];
      const name = info?.eng || info?.rus || `Country ${cid}`;
      return {
        _id: prefix(cid),
        name,
        flag: COUNTRY_FLAGS[name] ?? "🌐",
        numbersAvailable: Math.min(countryStock.get(cid) ?? 0, 2_000_000_000),
        priceFrom: Number((minUsdt * usdtToInr * markup).toFixed(2)),
        enabled: info?.visible !== 0,
        operators: 1,
        priority: safePriority(cid),
      };
    });

    const serviceRows = Array.from(svcMinPrice.entries()).map(([code, minUsdt]) => {
      const meta = serviceMeta(code);
      const friendly = nameByCode.get(code) ?? meta.name;
      const hasCodeMeta = meta.icon !== "🔌";
      const guess = hasCodeMeta ? { icon: meta.icon, category: meta.category } : guessMetaFromName(friendly);
      return {
        _id: prefix(code),
        name: friendly,
        icon: guess.icon,
        category: guess.category,
        price: Number((minUsdt * usdtToInr * markup).toFixed(2)),
        successRate: 95,
        enabled: true,
        countries: svcCountryCount.get(code)?.size ?? 0,
        orders: 0,
      };
    });

    const countriesCol = await getCollection<CountryDoc>("countries");
    const servicesCol = await getCollection<ServiceDoc>("services");

    // Wipe previous Grizzly rows so removed services/countries disappear too.
    await servicesCol.deleteMany({ _id: { $regex: "^gr_" } });
    await countriesCol.deleteMany({ _id: { $regex: "^gr_" } });

    const now = new Date();
    if (countryRows.length > 0) {
      await countriesCol.bulkWrite(
        countryRows.map(({ _id, ...fields }) => ({
          updateOne: {
            filter: { _id },
            update: { $set: { ...fields, updatedAt: now }, $setOnInsert: { createdAt: now } },
            upsert: true,
          },
        })),
      );
    }
    if (serviceRows.length > 0) {
      await servicesCol.bulkWrite(
        serviceRows.map(({ _id, ...fields }) => ({
          updateOne: {
            filter: { _id },
            update: { $set: { ...fields, updatedAt: now }, $setOnInsert: { createdAt: now } },
            upsert: true,
          },
        })),
      );
    }

    res.json({
      ok: true,
      countries: countryRows.length,
      services: serviceRows.length,
      markupPercent,
      usdtToInr,
      at: new Date().toISOString(),
    });
  } catch (e) {
    console.error("sync-grizzly failed", e);
    res.status(500).json({ ok: false, error: e instanceof Error ? e.message : String(e) });
  }
});

// Keep-alive ping for the BharatPe dashboard session token. BharatPe issues
// unofficial, session-style access tokens (there's no documented long-lived
// API key) that appear to expire from inactivity — a periodic real request
// using the token may keep it alive longer than it would otherwise last.
// This does NOT prevent expiry forever (BharatPe could still time it out on
// their side regardless), it just exercises the token regularly instead of
// letting it sit idle. Schedule an external cron hitting this every 5-10
// minutes with `x-cron-secret: $CRON_SECRET` — the same hit conveniently
// also keeps a free-tier Render backend from spinning down on inactivity.
publicRouter.post("/bharatpe-keepalive", async (req, res) => {
  if (!checkCronSecret(req)) return res.status(401).json({ error: "unauthorized" });
  try {
    const { loadBharatpeConfig, fetchBharatpeTransactions, saveBharatpeTokenStatus } = await import(
      "../lib/paytm.ts"
    );
    const cfg = await loadBharatpeConfig();
    if (!cfg.enabled || !cfg.access_token) {
      return res.json({ ok: true, skipped: "BharatPe not enabled or no token configured" });
    }
    try {
      const txns = await fetchBharatpeTransactions(cfg);
      await saveBharatpeTokenStatus("working", `Keep-alive ping ok · ${txns.length} recent transactions`);
      res.json({ ok: true, status: "working", count: txns.length });
    } catch (err) {
      const { BharatpeApiError } = await import("../lib/paytm.ts");
      const status = err instanceof BharatpeApiError ? err.status : "unavailable";
      const message = err instanceof Error ? err.message : "Keep-alive ping failed";
      await saveBharatpeTokenStatus(status, message);
      res.json({ ok: false, status, message });
    }
  } catch (err) {
    res.status(500).json({ ok: false, error: err instanceof Error ? err.message : "Keep-alive failed" });
  }
});

// Unified cron: refreshes catalogs for every enabled sms-activate provider
// (grizzly, tiger, smsbower, sastasms, fivesim). Schedule from an external
// cron trigger hitting this endpoint with `x-cron-secret: $CRON_SECRET`
// every 2 minutes.
publicRouter.post("/sync-all", async (req, res) => {
  if (!checkCronSecret(req)) return res.status(401).json({ error: "unauthorized" });

  type ProviderDoc = {
    _id: string;
    name: string;
    kind: string;
    config: Record<string, unknown>;
    status: string;
    enabledInProduction: boolean;
  };
  const providersCol = await getCollection<ProviderDoc>("providers");
  const providers = await providersCol.find({ status: "connected", enabledInProduction: true }).toArray();

  const USDT_INR = 102;
  const results: Array<Record<string, unknown>> = [];
  const syncLogs = await getCollection("sync_logs");

  for (const p of providers ?? []) {
    const kind = String(p.kind ?? "").toLowerCase();
    if (!["grizzlysms", "tigersms", "smsbower", "sastasms", "fivesim"].includes(kind)) continue;
    const markupPercent = Math.max(0, Number((p.config as Record<string, unknown>)?.markupPercent ?? 50));
    const markup = 1 + markupPercent / 100;
    const { client, prefix } = getSmsClientByKind(kind);
    const startedAt = Date.now();
    try {
      const [countries, prices, servicesList] = await Promise.all([
        client.getCountries(),
        client.getPrices(),
        client.getServicesList() as Promise<{ services?: Array<{ code: string; name: string }> }>,
      ]);
      const nameByCode = new Map<string, string>();
      for (const s of servicesList?.services ?? []) if (s?.code && s?.name) nameByCode.set(s.code, s.name);

      const svcMin = new Map<string, number>();
      const svcCountries = new Map<string, Set<string>>();
      const cMin = new Map<string, number>();
      const cStock = new Map<string, number>();
      for (const [cid, byService] of Object.entries(prices)) {
        for (const [code, info] of Object.entries(byService)) {
          const cost = Number(info.cost);
          const count = Number(info.count) || 0;
          if (!Number.isFinite(cost) || cost <= 0) continue;
          if (!nameByCode.has(code)) continue;
          const cur = svcMin.get(code);
          if (cur === undefined || cost < cur) svcMin.set(code, cost);
          if (!svcCountries.has(code)) svcCountries.set(code, new Set());
          svcCountries.get(code)!.add(cid);
          const cc = cMin.get(cid);
          if (cc === undefined || cost < cc) cMin.set(cid, cost);
          cStock.set(cid, (cStock.get(cid) ?? 0) + count);
        }
      }
      const countryRows = Array.from(cMin.entries()).map(([cid, minUsdt]) => {
        const info = countries[cid];
        const name = info?.eng || info?.rus || `Country ${cid}`;
        return {
          _id: `${prefix}${cid}`,
          name,
          flag: COUNTRY_FLAGS[name] ?? "🌐",
          numbersAvailable: Math.min(cStock.get(cid) ?? 0, 2_000_000_000),
          priceFrom: Number((minUsdt * USDT_INR * markup).toFixed(2)),
          enabled: info?.visible !== 0,
          operators: 1,
          priority: safePriority(cid),
        };
      });
      const serviceRows = Array.from(svcMin.entries()).map(([code, minUsdt]) => {
        const meta = serviceMeta(code);
        const friendly = nameByCode.get(code) ?? meta.name;
        const guess = meta.icon !== "🔌" ? { icon: meta.icon, category: meta.category } : guessMetaFromName(friendly);
        return {
          _id: `${prefix}${code}`,
          name: friendly,
          icon: guess.icon,
          category: guess.category,
          price: Number((minUsdt * USDT_INR * markup).toFixed(2)),
          successRate: 95,
          enabled: true,
          countries: svcCountries.get(code)?.size ?? 0,
          orders: 0,
        };
      });

      const countriesCol = await getCollection<CountryDoc>("countries");
      const servicesCol = await getCollection<ServiceDoc>("services");
      const idPrefixRegex = `^${prefix}`;
      await servicesCol.deleteMany({ _id: { $regex: idPrefixRegex } });
      await countriesCol.deleteMany({ _id: { $regex: idPrefixRegex } });

      const now = new Date();
      if (countryRows.length > 0) {
        await countriesCol.bulkWrite(
          countryRows.map(({ _id, ...fields }) => ({
            updateOne: {
              filter: { _id },
              update: { $set: { ...fields, updatedAt: now }, $setOnInsert: { createdAt: now } },
              upsert: true,
            },
          })),
        );
      }
      if (serviceRows.length > 0) {
        await servicesCol.bulkWrite(
          serviceRows.map(({ _id, ...fields }) => ({
            updateOne: {
              filter: { _id },
              update: { $set: { ...fields, updatedAt: now }, $setOnInsert: { createdAt: now } },
              upsert: true,
            },
          })),
        );
      }

      await syncLogs.insertOne({
        _id: crypto.randomUUID(),
        providerId: p._id,
        jobType: "catalog_sync",
        status: "success",
        startedAt: new Date(startedAt),
        finishedAt: new Date(),
        itemsIn: countryRows.length,
        itemsOut: serviceRows.length,
        error: null,
        summary: { services_synced: serviceRows.length, countries_synced: countryRows.length, markupPercent },
        createdAt: new Date(),
        updatedAt: new Date(),
      } as never);
      results.push({ provider: p.name, kind, ok: true, services: serviceRows.length, countries: countryRows.length, markupPercent });
    } catch (e) {
      const err = e instanceof Error ? e.message : String(e);
      await syncLogs.insertOne({
        _id: crypto.randomUUID(),
        providerId: p._id,
        jobType: "catalog_sync",
        status: "failed",
        startedAt: new Date(startedAt),
        finishedAt: new Date(),
        itemsIn: 0,
        itemsOut: 0,
        error: err,
        summary: { message: `auto sync ${kind} failed: ${err}` },
        createdAt: new Date(),
        updatedAt: new Date(),
      } as never);
      results.push({ provider: p.name, kind, ok: false, error: err });
    }
  }

  res.json({ ok: true, at: new Date().toISOString(), results });
});

/** Pulls "₹123.45" / "Rs 123.45" and a UTR/RRN out of a raw payment SMS. */
function parseFromText(text: string) {
  const amt = text.match(/(?:rs\.?|inr|₹)\s*([0-9]+(?:\.[0-9]{1,2})?)/i);
  const utr =
    text.match(/\b(?:utr|rrn|ref(?:erence)?(?:\s*no)?\.?|txn(?:\s*id)?)\s*[:# ]\s*([A-Za-z0-9]{6,})/i) ||
    text.match(/\b([0-9]{12})\b/);
  return { amount: amt ? Number(amt[1]) : null, utr: utr ? utr[1] : null };
}

// Auto-credit hook for Paytm/BharatPe merchant UPI QR payments (no gateway
// key needed). An SMS / notification forwarder app on the merchant phone (or
// any automation) POSTs the incoming credit here; we match it to the unique
// QR amount and credit. This is money-crediting code — keep the exact same
// auth (shared webhook_token from Paytm/BharatPe config, NOT CRON_SECRET)
// and unique-amount matching logic as the monolith.
publicRouter.post("/paytm-upi", async (req, res) => {
  const gate = await checkWebhookLimit(clientIpFrom(req));
  if (!gate.allowed) {
    res.setHeader("retry-after", String(gate.retryAfter || 60));
    return res.status(429).json({ ok: false, error: "too many requests" });
  }

  const parsedBody = upiWebhookSchema.safeParse(req.body);
  if (!parsedBody.success) return res.status(400).json({ ok: false, error: "invalid payload" });
  const payload = parsedBody.data;

  const { loadPaytmConfig, loadBharatpeConfig, matchPendingUpiSession, creditPaytmSession } = await import(
    "../lib/paytm.ts"
  );
  const [cfg, bpe] = await Promise.all([loadPaytmConfig(), loadBharatpeConfig()]);
  const token = String(payload.token ?? req.headers["x-webhook-token"] ?? "");
  const valid = [cfg.webhook_token, bpe.webhook_token].filter(Boolean);
  if (!valid.length || !valid.includes(token)) return res.status(401).json({ ok: false, error: "unauthorized" });

  const text = String(payload.text ?? payload.message ?? "");
  const parsed = text ? parseFromText(text) : { amount: null, utr: null };
  const amount = Number(payload.amount ?? parsed.amount);
  const utr = String(payload.utr ?? parsed.utr ?? "").trim();
  if (!Number.isFinite(amount) || amount <= 0 || amount > 1_000_000) {
    return res.status(400).json({ ok: false, error: "amount not found" });
  }

  const session = await matchPendingUpiSession(amount);
  if (!session) {
    return res.status(404).json({ ok: false, matched: false, error: "no unique pending QR for this amount" });
  }

  const label = session.provider === "bharatpe" ? "BharatPe UPI QR" : "Paytm UPI QR";
  try {
    const balance = await creditPaytmSession(
      session._id,
      utr || `UPI${Date.now()}`,
      `${label} auto-credit · ${utr || "no UTR"}`,
    );
    res.json({ ok: true, matched: true, provider: session.provider ?? "paytm", order_id: session.orderId, balance });
  } catch (err) {
    console.error("[paytm-upi hook] credit failed", err);
    res.status(500).json({ ok: false, error: "credit failed" });
  }
});
