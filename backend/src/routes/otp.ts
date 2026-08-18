import { Router } from "express";
import { getCollection } from "../lib/mongo.ts";
import { requireAuth } from "../middleware/auth.ts";
import { INR_PER_USDT, detectSmsKind, providerMarkup, splitVariant, stripGrizzlyPrefix } from "../lib/otp.ts";

export const otpRouter = Router();

type ProviderDoc = {
  _id: string; name: string; serverName?: string | null; kind: string; apiBaseUrl?: string | null;
  config: Record<string, unknown>; status: string; enabledInProduction: boolean;
};
type CountryDoc = { _id: string; name: string; enabled: boolean };

function escapeRegex(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

otpRouter.post("/services", requireAuth, async (req, res) => {
  try {
    const countryName = String(req.body?.countryName ?? "").trim().toLowerCase();
    const countryCode = String(req.body?.countryCode ?? "");
    const providerId = String(req.body?.providerId ?? "");
    const q = String(req.body?.q ?? "").trim().toLowerCase();
    if (!countryName && !countryCode) return res.json([]);

    const { getSmsClientByKind, serviceMeta, guessMetaFromName } = await import("../lib/grizzly.ts");
    const providersCol = await getCollection<ProviderDoc>("providers");
    const filter: Record<string, unknown> = { status: "connected", enabledInProduction: true };
    if (providerId) filter._id = providerId;
    const providers = await providersCol.find(filter).toArray();

    const kindOf = (p: ProviderDoc) => detectSmsKind({ name: p.name, server_name: p.serverName, kind: p.kind, api_base_url: p.apiBaseUrl });
    const smsProviders = providers.filter((p) => {
      const k = kindOf(p);
      return k === "grizzlysms" || k === "tigersms" || k === "smsbower" || k === "sastasms" || k === "fivesim";
    });
    if (smsProviders.length === 0) return res.json([]);

    const countriesCol = await getCollection<CountryDoc>("countries");
    const countryFilter: Record<string, unknown> = { enabled: true };
    if (countryName) countryFilter.name = { $regex: `^${escapeRegex(countryName)}$`, $options: "i" };
    else if (countryCode) countryFilter._id = countryCode;
    const countryRows = await countriesCol.find(countryFilter).toArray();
    const rawByPrefix = new Map<string, string>();
    for (const r of countryRows) {
      const m = /^([a-z]{2})_(.+)$/.exec(r._id);
      if (m) rawByPrefix.set(`${m[1]}_`, m[2]);
    }

    const kindRank = (k: string | null) => (k === "smsbower" ? 1 : k === "sastasms" ? 2 : k === "tigersms" ? 3 : k === "grizzlysms" ? 4 : k === "fivesim" ? 5 : 99);
    smsProviders.sort((a, b) => kindRank(kindOf(a)) - kindRank(kindOf(b)) || a.name.localeCompare(b.name));
    const serverNumByProvider = new Map<string, number>();
    smsProviders.forEach((p) => serverNumByProvider.set(p._id, kindRank(kindOf(p))));

    type Row = { id: string; externalId: string; name: string; icon: string; category: string; price: number; stock: number; providerId: string; providerName: string; serverLabel: string; countryCode: string; avgSpeedSec: number | null; supportsMulti: boolean };
    const rows: Row[] = [];

    await Promise.all(smsProviders.map(async (provider) => {
      const kind = kindOf(provider)!;
      const prefix = kind === "grizzlysms" ? "gr_" : kind === "tigersms" ? "ti_" : kind === "smsbower" ? "sb_" : kind === "sastasms" ? "ss_" : "fs_";
      const countryId = rawByPrefix.get(prefix);
      if (!countryId) return;
      const markupPercent = providerMarkup({ config: provider.config });
      try {
        const { client } = getSmsClientByKind(kind);
        const servicesList = (await client.getServicesList()) as { services?: Array<{ code: string; name: string; multi_sms?: boolean }> };
        const nameByCode = new Map<string, string>();
        const multiByCode = new Map<string, boolean>();
        for (const s of servicesList?.services ?? []) {
          if (s?.code && s?.name) nameByCode.set(s.code, s.name.trim());
          if (s?.code) multiByCode.set(s.code, Boolean(s.multi_sms));
        }
        const matchingCodes = q.length >= 2
          ? Array.from(nameByCode.entries()).filter(([code, name]) => `${name} ${code} ${serviceMeta(code).category}`.toLowerCase().includes(q)).map(([code]) => code)
          : [];
        let variants: Array<{ code: string; cost: number; stock: number; upstreamId: string | null }> = [];
        try {
          if (kind === "smsbower") {
            const v3Responses = matchingCodes.length > 0
              ? await Promise.all(matchingCodes.slice(0, 20).map((code) => client.getPricesV3({ country: countryId, service: code })))
              : [await client.getPricesV3({ country: countryId })];
            for (const v3 of v3Responses) {
              const byService = v3?.[countryId] ?? null;
              if (!byService) continue;
              for (const [code, tiers] of Object.entries(byService as Record<string, Record<string, { price: number; count: number; provider_id: number }>>)) {
                for (const [pid, info] of Object.entries(tiers)) {
                  const cost = Number(info?.price);
                  const stock = Number(info?.count) || 0;
                  if (!Number.isFinite(cost) || cost <= 0 || stock <= 0) continue;
                  variants.push({ code, cost, stock, upstreamId: String(info?.provider_id ?? pid) });
                }
              }
            }
          }
        } catch { /* v3 not supported */ }
        if (variants.length === 0) {
          const prices = matchingCodes.length === 1
            ? await client.getPrices({ country: countryId, service: matchingCodes[0] })
            : await client.getPrices({ country: countryId });
          const byService = prices[countryId] ?? {};
          for (const [code, info] of Object.entries(byService)) {
            const cost = Number(info.cost);
            const stock = Number(info.count) || 0;
            if (!Number.isFinite(cost) || cost <= 0 || stock <= 0) continue;
            variants.push({ code, cost, stock, upstreamId: null });
          }
        }
        for (const v of variants) {
          const friendly = nameByCode.get(v.code) ?? serviceMeta(v.code).name;
          if (!friendly) continue;
          const meta = serviceMeta(v.code);
          const guess = meta.icon !== "🔌" ? { icon: meta.icon, category: meta.category } : guessMetaFromName(friendly);
          const idSuffix = v.upstreamId ? `${v.code}@${v.upstreamId}` : v.code;
          const supportsMulti = Boolean(multiByCode.get(v.code)) || /(^|[^a-z])multi([^a-z]|$)/i.test(`${v.code} ${friendly}`);
          rows.push({
            id: `${prefix}${idSuffix}`, externalId: v.code, name: friendly, icon: guess.icon, category: guess.category,
            price: Number((v.cost * INR_PER_USDT * (1 + markupPercent / 100)).toFixed(2)), stock: Math.min(v.stock, 2_000_000_000),
            providerId: provider._id, providerName: provider.name, serverLabel: `Server ${serverNumByProvider.get(provider._id) ?? "?"}`,
            countryCode: `${prefix}${countryId}`,
            // Real rolling average recorded by otp.ts's /status route each
            // time an OTP actually arrives for this provider (see
            // lib/providers/stats.ts). null until at least one real
            // delivery has been observed — the frontend already treats
            // null as "unknown" and falls back to price-only sort.
            avgSpeedSec: (Number(provider.config?.avgSpeedSec) || 0) > 0 ? Number(provider.config!.avgSpeedSec) : null,
            supportsMulti,
          });
        }
      } catch { /* skip provider on error */ }
    }));

    const normalize = (n: string) => n.toLowerCase().replace(/\b(aws|new|old|alt|alternative|beta|test|v\d+)\b/g, " ").replace(/[^a-z0-9]+/g, " ").trim();
    const groups = new Map<string, Row[]>();
    for (const r of rows) {
      const key = `${r.providerId}::${normalize(r.name)}`;
      const g = groups.get(key) ?? [];
      g.push(r);
      groups.set(key, g);
    }
    const flattened: Row[] = [];
    const subLetters = ["A", "B", "C", "D", "E", "F", "G", "H", "I", "J"];
    for (const g of groups.values()) {
      if (g.length <= 1) { flattened.push(...g); continue; }
      const base = [...g].sort((a, b) => a.name.length - b.name.length)[0].name;
      const sorted = [...g].sort((a, b) => a.price - b.price);
      const serverNum = serverNumByProvider.get(sorted[0].providerId) ?? "?";
      sorted.forEach((s, i) => {
        const suffix = subLetters[i] ?? String(i + 1);
        flattened.push({ ...s, name: `${base} · Server ${serverNum}${suffix}`, serverLabel: `Server ${serverNum}${suffix}` });
      });
    }
    const out = flattened
      .filter((s) => !q || `${s.name} ${s.externalId} ${s.category}`.toLowerCase().includes(q))
      .sort((a, b) => {
        const base = a.name.replace(/\s*·\s*Server\s+\d+[A-Z]?$/i, "").localeCompare(b.name.replace(/\s*·\s*Server\s+\d+[A-Z]?$/i, ""));
        if (base !== 0) return base;
        return a.price - b.price;
      });
    res.json(out);
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : "Could not load services" });
  }
});

otpRouter.post("/buy", requireAuth, async (req, res) => {
  const sanitize = (msg: string): string => {
    let out = String(msg ?? "");
    const brands = [/grizzly\s*sms/gi, /grizzlysms/gi, /grizzly/gi, /tiger\s*sms/gi, /tigersms/gi, /tiger/gi, /sms\s*bower/gi, /smsbower/gi, /bower/gi, /sasta\s*sms/gi, /sastasms/gi, /sasta/gi, /5\s*sim/gi, /fivesim/gi, /5sim\.net/gi];
    for (const re of brands) out = out.replace(re, "server");
    out = out.replace(/https?:\/\/\S+/gi, "").replace(/\b[\w-]+\.(com|net|org|io|app|pro)\b/gi, "");
    if (/no_?balance/i.test(out)) return "This server is temporarily out of stock. Please try another.";
    if (/no_?numbers?/i.test(out)) return "No numbers available right now. Please try again.";
    if (/bad_?key|wrong_?key|unauthor/i.test(out)) return "Service temporarily unavailable. Please try again.";
    if (/error_?sql|internal/i.test(out)) return "Service temporarily unavailable. Please try again.";
    return out.replace(/\s+/g, " ").trim() || "Could not complete purchase. Please try again.";
  };
  try {
    const countryCode = String(req.body?.countryCode ?? "");
    const providerId = String(req.body?.providerId ?? "");
    const serviceId = String(req.body?.serviceId ?? "");
    if (!countryCode || !providerId || !serviceId) throw new Error("Select country, server and service first");

    const providersCol = await getCollection<ProviderDoc>("providers");
    const provider = await providersCol.findOne({ _id: providerId });
    if (!provider || provider.status !== "connected" || !provider.enabledInProduction) throw new Error("Selected server is not active");

    const markupPercent = providerMarkup({ config: provider.config });
    const kind = detectSmsKind({ name: provider.name, server_name: provider.serverName, kind: provider.kind, api_base_url: provider.apiBaseUrl })
      ?? (serviceId.startsWith("ti_") || countryCode.startsWith("ti_") ? "tigersms" : null)
      ?? (serviceId.startsWith("sb_") || countryCode.startsWith("sb_") ? "smsbower" : null)
      ?? (serviceId.startsWith("ss_") || countryCode.startsWith("ss_") ? "sastasms" : null)
      ?? (serviceId.startsWith("fs_") || countryCode.startsWith("fs_") ? "fivesim" : null)
      ?? (serviceId.startsWith("gr_") || countryCode.startsWith("gr_") ? "grizzlysms" : null);
    if (!kind) throw new Error("Live purchase is not available for this server yet");

    const { getSmsClientByKind, serviceMeta } = await import("../lib/grizzly.ts");
    const { client, prefix } = getSmsClientByKind(kind);
    const { base: baseServiceId, providerId: upstreamProviderId } = splitVariant(serviceId);
    const serviceCode = stripGrizzlyPrefix(baseServiceId);
    const countryId = stripGrizzlyPrefix(countryCode);

    const [countries, prices, servicesList, v3maybe] = await Promise.all([
      client.getCountries(),
      client.getPrices({ country: countryId, service: serviceCode }),
      client.getServicesList() as Promise<{ services?: Array<{ code: string; name: string }> }>,
      upstreamProviderId && kind === "smsbower" ? client.getPricesV3({ country: countryId, service: serviceCode }) : Promise.resolve(null),
    ]);

    let rawCost = 0;
    if (upstreamProviderId && v3maybe) {
      const tier = (v3maybe as Record<string, Record<string, Record<string, { price: number }>>>)?.[countryId]?.[serviceCode]?.[upstreamProviderId];
      rawCost = Number(tier?.price ?? 0);
    }
    if (!rawCost) rawCost = Number(prices[countryId]?.[serviceCode]?.cost ?? 0);
    if (!Number.isFinite(rawCost) || rawCost <= 0) throw new Error("Price is not available for this service now");
    const defaultPrice = Number((rawCost * INR_PER_USDT * (1 + markupPercent / 100)).toFixed(2));

    // Reseller sub-users pay the panel's own markup on top of the default
    // price — the difference is credited to the panel's wallet as the
    // reseller's commission (see purchaseOtp). Buyers with no panel, or
    // whose panel is suspended, are completely unaffected.
    let price = defaultPrice;
    let resellerCommission: { panelId: string; amount: number } | undefined;
    const buyer = await (await getCollection<{ _id: string; resellerPanelId?: string | null }>("users"))
      .findOne({ _id: req.auth.userId }, { projection: { resellerPanelId: 1 } });
    if (buyer?.resellerPanelId) {
      const panel = await (await getCollection<{ _id: string; markupPercent: number; status: string }>("reseller_panels"))
        .findOne({ _id: buyer.resellerPanelId });
      if (panel && panel.status === "active") {
        const retail = Number((defaultPrice * (1 + Number(panel.markupPercent) / 100)).toFixed(2));
        const commission = Number((retail - defaultPrice).toFixed(2));
        if (commission > 0) {
          price = retail;
          resellerCommission = { panelId: panel._id, amount: commission };
        }
      }
    }

    const serviceName = servicesList?.services?.find((s) => s.code === serviceCode)?.name?.trim() ?? serviceMeta(serviceCode).name;
    const countryInfo = countries[countryId];
    const countryName = countryInfo?.eng || countryInfo?.rus || countryCode;
    const expires = new Date(Date.now() + 20 * 60 * 1000).toISOString();

    const reservation = await client.getNumber(serviceCode, countryId, { providerIds: upstreamProviderId ?? undefined, maxPrice: rawCost });

    const { purchaseOtp } = await import("../lib/db/wallet.ts");
    let purchase: { orderId: string; newBalance: number };
    try {
      purchase = await purchaseOtp({
        userId: req.auth.userId, serviceId: `${prefix}${serviceCode}`, serviceName, countryCode: `${prefix}${countryId}`,
        countryName, providerId: provider._id, providerName: provider.name, operator: `${kind}:${reservation.activationId}`,
        number: reservation.number, price, expiresAt: expires, resellerCommission,
      });
    } catch (purchaseErr) {
      try { await client.setStatus(reservation.activationId, 8); } catch { /* best effort */ }
      const msg = purchaseErr instanceof Error ? purchaseErr.message : String(purchaseErr);
      throw new Error(/insufficient balance/i.test(msg) ? msg : sanitize(msg));
    }

    const orders = await getCollection<{ _id: string; number: string; serviceName: string; countryName: string; price: number; createdAt: Date; expiresAt: Date | null }>("orders");
    const inserted = await orders.findOne({ _id: purchase.orderId });
    if (!inserted) throw new Error("Could not load the created order");

    try {
      const orderEvents = await getCollection("order_events");
      await orderEvents.insertOne({
        _id: crypto.randomUUID(), orderId: inserted._id, action: "reserved", activationId: String(reservation.activationId),
        note: `Number reserved on ${provider.serverName ?? provider.name}`, createdAt: new Date(),
      } as never);
    } catch { /* best-effort */ }

    res.json({
      id: inserted._id, number: inserted.number, service: inserted.serviceName ?? serviceName, country: inserted.countryName ?? countryName,
      price: Number(inserted.price), createdAt: inserted.createdAt.toISOString(),
      expiresAt: inserted.expiresAt ? inserted.expiresAt.toISOString() : expires,
      providerName: provider.name, providerServer: provider.serverName ?? provider.name,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (/insufficient balance/i.test(msg) || /select country/i.test(msg) || /price is not available/i.test(msg) || /not active/i.test(msg)) {
      return res.status(400).json({ error: msg });
    }
    res.status(400).json({ error: sanitize(msg) });
  }
});

otpRouter.post("/status", requireAuth, async (req, res) => {
  try {
    const orderId = String(req.body?.orderId ?? "");
    if (!orderId) throw new Error("Order id required");
    const orders = await getCollection<{ _id: string; userId: string; operator?: string | null; otp?: string | null; status: string; providerId?: string | null; createdAt: Date }>("orders");
    const order = await orders.findOne({ _id: orderId });
    if (!order) throw new Error("Order not found");
    if (order.userId !== req.auth.userId && !req.auth.roles.includes("admin")) throw new Error("Forbidden");
    if (order.otp) return res.json({ status: "received", otp: order.otp });
    // Once refunded/cancelled the wallet has already been credited back —
    // never let a late-arriving upstream OTP flip the order back to
    // "received" (that would hand out a free OTP for a number the user was
    // already refunded for; most SMS-activation upstreams don't deactivate
    // a number instantly on cancel, so this is genuinely reachable).
    if (order.status === "refunded" || order.status === "cancelled") {
      return res.json({ status: order.status, otp: null });
    }

    const operator = String(order.operator ?? "");
    const kindMap: Array<[string, "grizzlysms" | "tigersms" | "smsbower" | "sastasms" | "fivesim"]> = [
      ["grizzly:", "grizzlysms"], ["grizzlysms:", "grizzlysms"], ["tigersms:", "tigersms"], ["tiger:", "tigersms"],
      ["smsbower:", "smsbower"], ["bower:", "smsbower"], ["sastasms:", "sastasms"], ["sasta:", "sastasms"],
      ["fivesim:", "fivesim"], ["5sim:", "fivesim"],
    ];
    let kind: "grizzlysms" | "tigersms" | "smsbower" | "sastasms" | "fivesim" | null = null;
    let activationId = "";
    for (const [p, k] of kindMap) { if (operator.startsWith(p)) { kind = k; activationId = operator.slice(p.length); break; } }
    if (!kind) return res.json({ status: order.status, otp: null });

    const { getSmsClientByKind } = await import("../lib/grizzly.ts");
    const { client } = getSmsClientByKind(kind);
    const status = await client.getStatus(activationId);
    if (status.code) {
      await orders.updateOne({ _id: orderId }, { $set: { otp: status.code, status: "received", completedAt: new Date() } });
      try {
        const orderEvents = await getCollection("order_events");
        await orderEvents.insertOne({ _id: crypto.randomUUID(), orderId, action: "otp_received", activationId, note: `OTP: ${status.code}`, createdAt: new Date() } as never);
      } catch { /* best-effort */ }
      if (order.providerId) {
        try {
          const { recordProviderSpeed } = await import("../lib/providers/stats.ts");
          await recordProviderSpeed(order.providerId, (Date.now() - order.createdAt.getTime()) / 1000);
        } catch { /* best-effort — never block handing the OTP back over a stats write */ }
      }
      return res.json({ status: "received", otp: status.code });
    }
    res.json({ status: status.status, otp: null });
  } catch (err) {
    res.status(400).json({ error: err instanceof Error ? err.message : "Status check failed" });
  }
});

otpRouter.post("/cancel", requireAuth, async (req, res) => {
  try {
    const orderId = String(req.body?.orderId ?? "");
    if (!orderId) throw new Error("Order id required");
    const orders = await getCollection<{ _id: string; userId: string; operator?: string | null; otp?: string | null; status: string; price: number; createdAt: Date }>("orders");
    const order = await orders.findOne({ _id: orderId });
    if (!order) throw new Error("Order not found");
    if (order.userId !== req.auth.userId) throw new Error("Forbidden");
    if (order.otp || order.status === "received") throw new Error("OTP already received, cannot cancel");
    if (order.status === "refunded" || order.status === "cancelled") return res.json({ status: order.status, refunded: false, newBalance: null });

    const ageMs = Date.now() - order.createdAt.getTime();
    const MIN_CANCEL_MS = 2 * 60 * 1000;
    if (ageMs < MIN_CANCEL_MS) throw new Error(`Please wait ${Math.ceil((MIN_CANCEL_MS - ageMs) / 1000)}s before cancelling this number.`);

    const operator = String(order.operator ?? "");
    const kindMap: Array<[string, "grizzlysms" | "tigersms" | "smsbower" | "sastasms" | "fivesim"]> = [
      ["grizzlysms:", "grizzlysms"], ["grizzly:", "grizzlysms"], ["tigersms:", "tigersms"], ["tiger:", "tigersms"],
      ["smsbower:", "smsbower"], ["bower:", "smsbower"], ["sastasms:", "sastasms"], ["sasta:", "sastasms"],
      ["fivesim:", "fivesim"], ["5sim:", "fivesim"],
    ];
    let kind: "grizzlysms" | "tigersms" | "smsbower" | "sastasms" | "fivesim" | null = null;
    let activationId = "";
    for (const [p, k] of kindMap) { if (operator.startsWith(p)) { kind = k; activationId = operator.slice(p.length); break; } }

    const orderEvents = await getCollection("order_events");
    await orderEvents.insertOne({ _id: crypto.randomUUID(), orderId, action: "cancel_requested", statusCode: 8, activationId: activationId || null, note: "User requested cancel", createdAt: new Date() } as never);
    if (kind && activationId) {
      try {
        const { getSmsClientByKind } = await import("../lib/grizzly.ts");
        const { client } = getSmsClientByKind(kind);
        try { await client.setStatus(activationId, 8); }
        catch { try { await client.setStatus(activationId, 6); } catch { /* ignore */ } try { await client.setStatus(activationId, 8); } catch { /* ignore */ } }
      } catch { /* refund still proceeds */ }
    }

    const { refundOrder } = await import("../lib/db/wallet.ts");
    const newBalance = await refundOrder(orderId, "user cancelled");
    await orderEvents.insertOne({ _id: crypto.randomUUID(), orderId, action: "cancelled", statusCode: 8, activationId: activationId || null, note: "Refunded to wallet", createdAt: new Date() } as never);
    res.json({ status: "refunded", refunded: true, newBalance });
  } catch (err) {
    res.status(400).json({ error: err instanceof Error ? err.message : "Cancel failed" });
  }
});

otpRouter.post("/events", requireAuth, async (req, res) => {
  const orderId = String(req.body?.orderId ?? "");
  if (!orderId) return res.json([]);
  const orders = await getCollection<{ _id: string; userId: string }>("orders");
  const order = await orders.findOne({ _id: orderId });
  if (!order) return res.json([]);
  if (order.userId !== req.auth.userId && !req.auth.roles.includes("admin")) return res.status(403).json({ error: "Forbidden" });
  const orderEvents = await getCollection<{ _id: string; action: string; statusCode?: number | null; activationId?: string | null; note?: string | null; createdAt: Date }>("order_events");
  const rows = await orderEvents.find({ orderId }).sort({ createdAt: 1 }).toArray();
  res.json(rows.map((r) => ({ id: r._id, action: r.action, statusCode: r.statusCode ?? null, activationId: r.activationId ?? null, note: r.note ?? null, createdAt: r.createdAt.toISOString() })));
});

otpRouter.get("/my-orders", requireAuth, async (req, res) => {
  const orders = await getCollection<{ _id: string; userId: string; serviceName?: string | null; serviceId?: string | null; countryName?: string | null; countryCode?: string | null; number: string; status: string; otp?: string | null; price: number; createdAt: Date; expiresAt?: Date | null }>("orders");
  const rows = await orders.find({ userId: req.auth.userId }).sort({ createdAt: -1 }).toArray();
  res.json(rows.map((o) => ({
    id: o._id, service: o.serviceName ?? o.serviceId ?? "", country: o.countryName ?? o.countryCode ?? "",
    number: o.number, status: o.status, otp: o.otp ?? undefined, price: Number(o.price),
    createdAt: o.createdAt.toISOString(), expiresAt: o.expiresAt ? o.expiresAt.toISOString() : "",
  })));
});
