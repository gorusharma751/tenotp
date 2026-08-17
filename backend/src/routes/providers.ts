// Providers REST routes — ported from src/api/providers.ts, src/api/providerLogs.ts,
// src/api/providerCatalog.ts, src/api/priceRules.ts, src/api/syncJobs.ts,
// src/lib/provider-health.functions.ts and src/lib/live-prices.functions.ts.
// Business logic is copied near-verbatim; only the framework glue changed.
import { Router } from "express";
import { getCollection } from "../lib/mongo.ts";
import { requireAdmin, optionalAuth } from "../middleware/auth.ts";
import { getSmsClientByKind } from "../lib/grizzly.ts";
import { getAdapterByKind } from "../lib/providers/registry.ts";
import type { RawExternalService, RawExternalCategory } from "../lib/providers/adapter.ts";

export const providersRouter = Router();

function fail(res: import("express").Response, err: unknown, code = 400) {
  res.status(code).json({ error: err instanceof Error ? err.message : "Request failed" });
}

// =====================================================================
// src/api/providers.ts — providersApi
// =====================================================================

type ProviderStatus = string;
type ProviderConfig = {
  id: string;
  name: string;
  slug: string;
  serverName?: string;
  kind?: string;
  category: "sms" | "email" | "push" | "payment" | "storage" | "otp";
  logo: string;
  status: ProviderStatus;
  environment: "production" | "sandbox";
  baseUrl: string;
  apiKey: string;
  apiSecret: string;
  timeoutMs: number;
  retries: number;
  rateLimitPerMinute: number;
  markupPercent: number;
  health: "healthy" | "degraded" | "down" | "unknown";
  lastCheckAt: string;
  enabledInSandbox: boolean;
  enabledInProduction: boolean;
  successRate: number;
  latencyMs: number;
  createdAt: string;
  updatedAt: string;
};

type ProviderDoc = {
  _id: string;
  name: string;
  serverName?: string | null;
  category?: string | null;
  status: string;
  enabledInProduction: boolean;
  enabledInSandbox: boolean;
  apiBaseUrl?: string | null;
  apiKeyMasked?: string | null;
  latencyMs?: number | null;
  config?: Record<string, unknown> | null;
  notes?: string | null;
  kind?: string | null;
  authType?: string | null;
  priority?: number | null;
  archivedAt?: Date | null;
  lastSyncAt?: Date | null;
  timeoutMs?: number | null;
  retries?: number | null;
  createdAt: Date;
  updatedAt: Date;
};

async function providersCol() {
  return getCollection<ProviderDoc>("providers");
}

function mapRow(r: ProviderDoc): ProviderConfig {
  const cat = (r.category ?? "otp") as ProviderConfig["category"];
  const text = `${r.name ?? ""} ${r.serverName ?? ""} ${r.kind ?? ""}`;
  const providerLogo = /grizzly/i.test(text)
    ? "🐻"
    : /tiger/i.test(text)
      ? "🐯"
      : /bower/i.test(text)
        ? "🏹"
        : /sasta/i.test(text)
          ? "💸"
          : /5sim|fivesim/i.test(text)
            ? "5⃣"
            : "🔌";
  const config = r.config ?? {};
  return {
    id: r._id,
    name: r.name,
    slug: (r.name || "provider").toLowerCase().replace(/[^a-z0-9]+/g, "-"),
    serverName: r.serverName ?? undefined,
    kind: r.kind ?? undefined,
    category: (["sms", "email", "push", "payment", "storage", "otp"].includes(cat) ? cat : "otp") as ProviderConfig["category"],
    logo: providerLogo,
    status: r.status,
    environment: r.enabledInProduction ? "production" : "sandbox",
    baseUrl: r.apiBaseUrl ?? "",
    apiKey: r.apiKeyMasked ?? "",
    apiSecret: "",
    timeoutMs: (config.timeoutMs as number | undefined) ?? r.timeoutMs ?? 10000,
    retries: (config.retries as number | undefined) ?? r.retries ?? 3,
    rateLimitPerMinute: (config.rateLimitPerMinute as number | undefined) ?? 120,
    markupPercent: (config.markupPercent as number | undefined) ?? 0,
    health: (r.status === "connected" ? "healthy" : r.status === "error" ? "down" : "unknown") as ProviderConfig["health"],
    lastCheckAt: r.updatedAt.toISOString(),
    enabledInSandbox: r.enabledInSandbox,
    enabledInProduction: r.enabledInProduction,
    successRate: (config.successRate as number | undefined) ?? 0,
    latencyMs: r.latencyMs ?? 0,
    createdAt: r.createdAt.toISOString(),
    updatedAt: r.updatedAt.toISOString(),
  };
}

function serverSortRank(p: ProviderConfig) {
  const text = `${p.serverName ?? ""} ${p.name ?? ""}`.toLowerCase();
  const n = /server\s*(\d+)/i.exec(text)?.[1];
  if (n) return Number(n);
  const kind = (p.kind ?? "").toLowerCase();
  if (kind === "smsbower") return 1;
  if (kind === "sastasms") return 2;
  if (kind === "tigersms") return 3;
  if (kind === "grizzlysms") return 4;
  if (kind === "fivesim") return 5;
  return 99;
}

function sortServers<T extends ProviderConfig>(items: T[]) {
  return [...items].sort((a, b) => serverSortRank(a) - serverSortRank(b) || a.name.localeCompare(b.name));
}

async function fetchAll(): Promise<ProviderConfig[]> {
  const col = await providersCol();
  const rows = await col.find({}).sort({ createdAt: -1 }).toArray();
  return sortServers(rows.map(mapRow));
}

function applyListFilters(items: ProviderConfig[], query: { q?: string; category?: string; status?: string; env?: string }) {
  let out = items;
  if (query.q) {
    const s = query.q.toLowerCase();
    out = out.filter((p) => (p.name + p.baseUrl).toLowerCase().includes(s));
  }
  if (query.category && query.category !== "all") out = out.filter((p) => p.category === query.category);
  if (query.status && query.status !== "all") out = out.filter((p) => p.status === query.status);
  if (query.env === "sandbox") out = out.filter((p) => p.enabledInSandbox);
  if (query.env === "production") out = out.filter((p) => p.enabledInProduction);
  return out;
}

// Public listing (no auth) — safe fields only (mapRow already masks apiKey/config).
providersRouter.get("/public", optionalAuth, async (req, res) => {
  try {
    const items = await fetchAll();
    res.json(applyListFilters(items, req.query as Record<string, string>));
  } catch (err) {
    fail(res, err);
  }
});

// Live prices (public, GET, no middleware in the original) — src/lib/live-prices.functions.ts
type LivePrice = { price: number; count: number };
type LivePriceMap = Record<string, LivePrice>;
let livePriceCache: { at: number; data: LivePriceMap } | null = null;
const LIVE_PRICE_TTL_MS = 60_000;

providersRouter.get("/live-prices", async (_req, res) => {
  try {
    if (livePriceCache && Date.now() - livePriceCache.at < LIVE_PRICE_TTL_MS) {
      return res.json(livePriceCache.data);
    }
    const providersColl = await getCollection<{ _id: string; name: string; apiBaseUrl?: string | null; config: Record<string, unknown>; status: string }>("providers");
    const providers = await providersColl.find({ status: "connected" }).toArray();
    if (!providers.length) return res.json(livePriceCache?.data ?? ({} as LivePriceMap));

    const out: LivePriceMap = {};
    await Promise.all(
      providers.map(async (provider) => {
        const cfg = (provider.config ?? {}) as { api_key?: string; markup_percent?: number; timeout_ms?: number };
        const apiKey = cfg.api_key;
        if (!apiKey || !provider.apiBaseUrl) return;
        const markup = 1 + Number(cfg.markup_percent ?? 0) / 100;
        let base = provider.apiBaseUrl.trim();
        if (/handler_api$/.test(base)) base = base + ".php";
        const url = `${base}?api_key=${encodeURIComponent(apiKey)}&action=getPrices`;
        try {
          const ctrl = new AbortController();
          const to = setTimeout(() => ctrl.abort(), cfg.timeout_ms ?? 10_000);
          const resp = await fetch(url, { signal: ctrl.signal });
          clearTimeout(to);
          if (!resp.ok) return;
          const raw = (await resp.json()) as Record<string, Record<string, { cost: number; count: number }>>;
          for (const country of Object.values(raw ?? {})) {
            if (!country || typeof country !== "object") continue;
            for (const [svc, info] of Object.entries(country)) {
              if (!info || typeof info !== "object") continue;
              const cost = Number(info.cost);
              const count = Number(info.count);
              if (!Number.isFinite(cost) || cost <= 0 || count <= 0) continue;
              const priced = Number((cost * markup).toFixed(4));
              const prev = out[svc];
              if (!prev) out[svc] = { price: priced, count };
              else out[svc] = { price: Math.min(prev.price, priced), count: prev.count + count };
            }
          }
        } catch {
          /* ignore this provider, keep others */
        }
      }),
    );

    if (Object.keys(out).length === 0) return res.json(livePriceCache?.data ?? {});
    livePriceCache = { at: Date.now(), data: out };
    res.json(out);
  } catch (err) {
    fail(res, err, 500);
  }
});

// Everything else under /providers is admin-only.
providersRouter.use(requireAdmin);

providersRouter.get("/", async (req, res) => {
  try {
    const items = await fetchAll();
    res.json(applyListFilters(items, req.query as Record<string, string>));
  } catch (err) {
    fail(res, err);
  }
});

// providersApi.effectivePrice(basePrice) — trivial passthrough (rounds to 2dp).
providersRouter.get("/effective-price", async (req, res) => {
  const basePrice = Number(req.query.basePrice ?? 0);
  res.json({ price: Number(basePrice.toFixed(2)) });
});

providersRouter.get("/summary", async (_req, res) => {
  try {
    const items = await fetchAll();
    const by = (c: ProviderConfig["category"]) => items.filter((p) => p.category === c).length;
    const avg = (arr: number[]) => (arr.length ? Math.round(arr.reduce((a, b) => a + b, 0) / arr.length) : 0);
    res.json({
      total: items.length,
      connected: items.filter((p) => p.status === "connected").length,
      disconnected: items.filter((p) => p.status !== "connected").length,
      healthy: items.filter((p) => p.health === "healthy").length,
      degraded: items.filter((p) => p.health === "degraded").length,
      avgLatency: avg(items.map((p) => p.latencyMs)),
      avgSuccess: avg(items.map((p) => p.successRate)),
      byCategory: { sms: by("sms"), email: by("email"), push: by("push"), payment: by("payment"), storage: by("storage"), otp: by("otp") },
    });
  } catch (err) {
    fail(res, err);
  }
});

// price-rules and sync/log/catalog sub-resources are mounted below under
// paths that don't collide with the /:id provider routes.

// ----- price rules (src/api/priceRules.ts) -----
interface PriceRuleRow {
  id: string; provider_id: string | null; scope: "global" | "provider" | "category" | "service"; scope_ref: string | null;
  markup_type: "percent" | "fixed"; markup_value: number; min_price: number | null; max_price: number | null;
  currency: string; region: string | null; priority: number; active: boolean; created_at: string; updated_at: string;
}
type PriceRuleDoc = {
  _id: string; providerId: string | null; scope: "global" | "provider" | "category" | "service"; scopeRef: string | null;
  markupType: "percent" | "fixed"; markupValue: number; minPrice: number | null; maxPrice: number | null;
  currency: string; region: string | null; priority: number; active: boolean; createdAt: Date; updatedAt: Date;
};
async function priceRulesCol() {
  return getCollection<PriceRuleDoc>("price_rules");
}
function mapPriceRuleRow(r: PriceRuleDoc): PriceRuleRow {
  return {
    id: r._id, provider_id: r.providerId ?? null, scope: r.scope, scope_ref: r.scopeRef ?? null,
    markup_type: r.markupType, markup_value: Number(r.markupValue), min_price: r.minPrice ?? null,
    max_price: r.maxPrice ?? null, currency: r.currency, region: r.region ?? null, priority: r.priority,
    active: r.active, created_at: r.createdAt.toISOString(), updated_at: r.updatedAt.toISOString(),
  };
}
function priceRuleToDoc(row: Partial<PriceRuleRow>): Partial<PriceRuleDoc> {
  const doc: Partial<PriceRuleDoc> = {};
  if (row.provider_id !== undefined) doc.providerId = row.provider_id;
  if (row.scope !== undefined) doc.scope = row.scope;
  if (row.scope_ref !== undefined) doc.scopeRef = row.scope_ref;
  if (row.markup_type !== undefined) doc.markupType = row.markup_type;
  if (row.markup_value !== undefined) doc.markupValue = row.markup_value;
  if (row.min_price !== undefined) doc.minPrice = row.min_price;
  if (row.max_price !== undefined) doc.maxPrice = row.max_price;
  if (row.currency !== undefined) doc.currency = row.currency;
  if (row.region !== undefined) doc.region = row.region;
  if (row.priority !== undefined) doc.priority = row.priority;
  if (row.active !== undefined) doc.active = row.active;
  return doc;
}

providersRouter.get("/price-rules", async (req, res) => {
  try {
    const providerId = (req.query.providerId as string | undefined) ?? null;
    const c = await priceRulesCol();
    const filter: Record<string, unknown> = {};
    if (providerId) filter.providerId = providerId;
    const rows = await c.find(filter).sort({ priority: 1 }).toArray();
    res.json(rows.map(mapPriceRuleRow));
  } catch (err) {
    fail(res, err);
  }
});

providersRouter.post("/price-rules", async (req, res) => {
  try {
    const row = req.body as Partial<PriceRuleRow>;
    const c = await priceRulesCol();
    const now = new Date();
    const doc: PriceRuleDoc = {
      _id: crypto.randomUUID(),
      providerId: row.provider_id ?? null,
      scope: row.scope ?? "global",
      scopeRef: row.scope_ref ?? null,
      markupType: row.markup_type ?? "percent",
      markupValue: row.markup_value ?? 0,
      minPrice: row.min_price ?? null,
      maxPrice: row.max_price ?? null,
      currency: row.currency ?? "INR",
      region: row.region ?? null,
      priority: row.priority ?? 100,
      active: row.active ?? true,
      createdAt: now,
      updatedAt: now,
    };
    await c.insertOne(doc);
    res.json(mapPriceRuleRow(doc));
  } catch (err) {
    fail(res, err);
  }
});

providersRouter.patch("/price-rules/:id", async (req, res) => {
  try {
    const c = await priceRulesCol();
    const set = { ...priceRuleToDoc(req.body ?? {}), updatedAt: new Date() };
    const result = await c.findOneAndUpdate({ _id: req.params.id }, { $set: set }, { returnDocument: "after" });
    if (!result) throw new Error("Price rule not found");
    res.json(mapPriceRuleRow(result));
  } catch (err) {
    fail(res, err);
  }
});

providersRouter.delete("/price-rules/:id", async (req, res) => {
  try {
    const c = await priceRulesCol();
    await c.deleteOne({ _id: req.params.id });
    res.json({ ok: true });
  } catch (err) {
    fail(res, err);
  }
});

// ----- service mappings (src/api/providerCatalog.ts — serviceMappingsApi) -----
interface ServiceMappingRow {
  id: string; internal_service_id: string; provider_id: string; provider_service_id: string;
  priority: number; enabled: boolean; created_at: string; updated_at: string;
}
type ServiceMappingDoc = {
  _id: string; internalServiceId: string; providerId: string; providerServiceId: string;
  priority: number; enabled: boolean; createdAt: Date; updatedAt: Date;
};
async function mappingsCol() {
  return getCollection<ServiceMappingDoc>("service_mappings");
}
function mapMappingRow(r: ServiceMappingDoc): ServiceMappingRow {
  return {
    id: r._id, internal_service_id: r.internalServiceId, provider_id: r.providerId,
    provider_service_id: r.providerServiceId, priority: r.priority, enabled: r.enabled,
    created_at: r.createdAt.toISOString(), updated_at: r.updatedAt.toISOString(),
  };
}

providersRouter.post("/mappings", async (req, res) => {
  try {
    const row = req.body as { internal_service_id: string; provider_id: string; provider_service_id: string; priority?: number; enabled?: boolean };
    const c = await mappingsCol();
    const now = new Date();
    const result = await c.findOneAndUpdate(
      { internalServiceId: row.internal_service_id, providerServiceId: row.provider_service_id },
      {
        $set: { providerId: row.provider_id, priority: row.priority ?? 100, enabled: row.enabled ?? true, updatedAt: now },
        $setOnInsert: { _id: crypto.randomUUID(), internalServiceId: row.internal_service_id, providerServiceId: row.provider_service_id, createdAt: now },
      },
      { upsert: true, returnDocument: "after" },
    );
    if (!result) throw new Error("Upsert failed");
    res.json(mapMappingRow(result));
  } catch (err) {
    fail(res, err);
  }
});

providersRouter.delete("/mappings/:id", async (req, res) => {
  try {
    const c = await mappingsCol();
    await c.deleteOne({ _id: req.params.id });
    res.json({ ok: true });
  } catch (err) {
    fail(res, err);
  }
});

// ----- category mapping / service active toggles (providerCatalogApi) -----
type ProviderCategoryDoc = {
  _id: string; providerId: string; externalId: string; externalName: string;
  internalCategory: string | null; active: boolean; createdAt: Date; updatedAt: Date;
};
async function categoriesCol() {
  return getCollection<ProviderCategoryDoc>("provider_categories");
}
type ProviderServiceDoc = {
  _id: string; providerId: string; externalId: string; externalName: string; externalCategory: string | null;
  baseCost: number; currency: string; region: string | null; meta: Record<string, unknown>; active: boolean;
  lastSeenAt: Date; createdAt: Date; updatedAt: Date;
};
async function servicesCatalogCol() {
  return getCollection<ProviderServiceDoc>("provider_services");
}

providersRouter.post("/catalog/categories/:catId/mapping", async (req, res) => {
  try {
    const c = await categoriesCol();
    await c.updateOne({ _id: req.params.catId }, { $set: { internalCategory: req.body?.internalCategory ?? null, updatedAt: new Date() } });
    res.json({ ok: true });
  } catch (err) {
    fail(res, err);
  }
});

providersRouter.post("/catalog/services/:svcId/active", async (req, res) => {
  try {
    const c = await servicesCatalogCol();
    await c.updateOne({ _id: req.params.svcId }, { $set: { active: Boolean(req.body?.active), updatedAt: new Date() } });
    res.json({ ok: true });
  } catch (err) {
    fail(res, err);
  }
});

// ----- per-provider routes (must come after the fixed sub-paths above) -----

providersRouter.get("/:id", async (req, res) => {
  try {
    const c = await providersCol();
    const row = await c.findOne({ _id: req.params.id });
    res.json(row ? mapRow(row) : null);
  } catch (err) {
    fail(res, err);
  }
});

providersRouter.patch("/:id", async (req, res) => {
  try {
    const patch = (req.body ?? {}) as Partial<ProviderConfig>;
    const c = await providersCol();
    const set: Record<string, unknown> = { updatedAt: new Date() };
    if (patch.name !== undefined) set.name = patch.name;
    if (patch.serverName !== undefined) set.serverName = patch.serverName;
    if (patch.baseUrl !== undefined) set.apiBaseUrl = patch.baseUrl;
    if (patch.apiKey !== undefined) set.apiKeyMasked = patch.apiKey;
    if (patch.status !== undefined) set.status = patch.status;
    if (patch.enabledInSandbox !== undefined) set.enabledInSandbox = patch.enabledInSandbox;
    if (patch.enabledInProduction !== undefined) set.enabledInProduction = patch.enabledInProduction;
    if (patch.category !== undefined) set.category = patch.category;
    if (patch.latencyMs !== undefined) set.latencyMs = patch.latencyMs;
    if (patch.timeoutMs !== undefined || patch.retries !== undefined || patch.rateLimitPerMinute !== undefined || patch.markupPercent !== undefined) {
      const cur = await c.findOne({ _id: req.params.id });
      const existing = (cur?.config as Record<string, unknown> | null) ?? {};
      set.config = {
        ...existing,
        ...(patch.timeoutMs !== undefined ? { timeoutMs: patch.timeoutMs } : {}),
        ...(patch.retries !== undefined ? { retries: patch.retries } : {}),
        ...(patch.rateLimitPerMinute !== undefined ? { rateLimitPerMinute: patch.rateLimitPerMinute } : {}),
        ...(patch.markupPercent !== undefined ? { markupPercent: patch.markupPercent } : {}),
      };
    }
    const result = await c.findOneAndUpdate({ _id: req.params.id }, { $set: set }, { returnDocument: "after" });
    if (!result) throw new Error("Provider not found");
    res.json(mapRow(result));
  } catch (err) {
    fail(res, err);
  }
});

providersRouter.delete("/:id", async (req, res) => {
  try {
    const c = await providersCol();
    await c.deleteOne({ _id: req.params.id });
    res.json({ ok: true });
  } catch (err) {
    fail(res, err);
  }
});

providersRouter.post("/", async (req, res) => {
  try {
    const input = req.body as {
      name: string; serverName?: string; baseUrl: string; apiKey?: string; apiSecret?: string;
      markupPercent?: number; category?: ProviderConfig["category"]; environment?: ProviderConfig["environment"]; kind?: string;
    };
    if (!input.name?.trim()) throw new Error("Name is required");
    if (!input.baseUrl?.trim() || !/^https?:\/\//.test(input.baseUrl)) throw new Error("Valid Base URL required");
    const allowed = ["otp", "payment", "sms", "other"] as const;
    const dbCat = (allowed as readonly string[]).includes(input.category as string) ? (input.category as (typeof allowed)[number]) : "otp";
    const kind = (
      input.kind?.trim() ||
      (/grizzly/i.test(input.name) ? "grizzlysms"
        : /tiger/i.test(input.name) ? "tigersms"
        : /bower/i.test(input.name) ? "smsbower"
        : /sasta/i.test(input.name) ? "sastasms"
        : /5sim|fivesim/i.test(input.name) ? "fivesim"
        : "custom")
    ).toLowerCase();
    const c = await providersCol();
    const now = new Date();
    const doc: ProviderDoc = {
      _id: crypto.randomUUID(),
      name: input.name.trim(),
      serverName: input.serverName?.trim() ?? null,
      category: dbCat,
      kind,
      apiBaseUrl: input.baseUrl.trim(),
      apiKeyMasked: input.apiKey ? `${input.apiKey.slice(0, 4)}••••${input.apiKey.slice(-2)}` : null,
      status: "connected",
      enabledInProduction: (input.environment ?? "production") === "production",
      enabledInSandbox: true,
      config: { markupPercent: Number.isFinite(input.markupPercent) ? Math.max(0, Number(input.markupPercent)) : 15 },
      createdAt: now,
      updatedAt: now,
    };
    await c.insertOne(doc);
    res.json(mapRow(doc));
  } catch (err) {
    fail(res, err);
  }
});

providersRouter.post("/:id/health-check", async (req, res) => {
  try {
    const latencyMs = 100 + Math.floor(Math.random() * 200);
    const c = await providersCol();
    await c.updateOne({ _id: req.params.id }, { $set: { latencyMs, updatedAt: new Date() } });
    res.json({ ok: true, latencyMs, message: "OK" });
  } catch (err) {
    fail(res, err);
  }
});

providersRouter.post("/:id/test", async (_req, res) => {
  res.json({ ok: true, id: `snd_${Date.now()}`, message: "Test call queued" });
});

// providersApi.logs() stub — always returns [] in the original monolith.
providersRouter.get("/:id/logs", async (_req, res) => {
  res.json([]);
});

providersRouter.post("/:id/toggle", async (req, res) => {
  try {
    const { env, enabled } = req.body as { env: "sandbox" | "production"; enabled: boolean };
    const c = await providersCol();
    const patch = env === "sandbox" ? { enabledInSandbox: enabled } : { enabledInProduction: enabled };
    const result = await c.findOneAndUpdate({ _id: req.params.id }, { $set: { ...patch, updatedAt: new Date() } }, { returnDocument: "after" });
    if (!result) throw new Error("Provider not found");
    res.json(mapRow(result));
  } catch (err) {
    fail(res, err);
  }
});

// =====================================================================
// src/api/providerLogs.ts — providerLogsApi (request/response log entries,
// distinct from the providersApi.logs() stub above)
// =====================================================================
type JsonValue = string | number | boolean | null | JsonValue[] | { [key: string]: JsonValue };
interface ProviderLogRow {
  id: string; provider_id: string; direction: "in" | "out"; method: string; path: string;
  status: number; latency_ms: number; request: Record<string, JsonValue>; response: Record<string, JsonValue>; at: string;
}
type ProviderLogDoc = {
  _id: string; providerId: string; direction: "in" | "out"; method: string; path: string; status: number;
  latencyMs: number; request: Record<string, JsonValue>; response: Record<string, JsonValue>; at: Date;
  createdAt: Date; updatedAt: Date;
};
async function providerLogsCol() {
  return getCollection<ProviderLogDoc>("provider_logs");
}
function mapProviderLogRow(r: ProviderLogDoc): ProviderLogRow {
  return {
    id: r._id, provider_id: r.providerId, direction: r.direction, method: r.method, path: r.path,
    status: r.status, latency_ms: r.latencyMs, request: r.request ?? {}, response: r.response ?? {}, at: r.at.toISOString(),
  };
}

providersRouter.get("/:id/log-entries", async (req, res) => {
  try {
    const limit = Number(req.query.limit ?? 100);
    const c = await providerLogsCol();
    const rows = await c.find({ providerId: req.params.id }).sort({ at: -1 }).limit(limit).toArray();
    res.json(rows.map(mapProviderLogRow));
  } catch (err) {
    fail(res, err);
  }
});

providersRouter.post("/:id/log-entries", async (req, res) => {
  try {
    const row = req.body as Partial<ProviderLogRow>;
    const c = await providerLogsCol();
    const now = new Date();
    await c.insertOne({
      _id: crypto.randomUUID(),
      providerId: req.params.id,
      direction: row.direction ?? "out",
      method: row.method ?? "GET",
      path: row.path ?? "",
      status: row.status ?? 0,
      latencyMs: row.latency_ms ?? 0,
      request: row.request ?? {},
      response: row.response ?? {},
      at: row.at ? new Date(row.at) : now,
      createdAt: now,
      updatedAt: now,
    });
    res.json({ ok: true });
  } catch (err) {
    fail(res, err);
  }
});

providersRouter.delete("/:id/log-entries", async (req, res) => {
  try {
    const c = await providerLogsCol();
    await c.deleteMany({ providerId: req.params.id });
    res.json({ ok: true });
  } catch (err) {
    fail(res, err);
  }
});

// =====================================================================
// src/api/providerCatalog.ts — providerCatalogApi (service/category listing)
// =====================================================================
interface ProviderServiceRow {
  id: string; provider_id: string; external_id: string; external_name: string; external_category: string | null;
  base_cost: number; currency: string; region: string | null; active: boolean; last_seen_at: string;
  meta: Record<string, JsonValue>; created_at: string; updated_at: string;
}
interface ProviderCategoryRow {
  id: string; provider_id: string; external_id: string; external_name: string; internal_category: string | null;
  active: boolean; created_at: string; updated_at: string;
}
function mapServiceRow(r: ProviderServiceDoc): ProviderServiceRow {
  return {
    id: r._id, provider_id: r.providerId, external_id: r.externalId, external_name: r.externalName,
    external_category: r.externalCategory ?? null, base_cost: Number(r.baseCost), currency: r.currency,
    region: r.region ?? null, active: r.active, last_seen_at: r.lastSeenAt.toISOString(),
    meta: (r.meta ?? {}) as Record<string, JsonValue>, created_at: r.createdAt.toISOString(), updated_at: r.updatedAt.toISOString(),
  };
}
function mapCategoryRow(r: ProviderCategoryDoc): ProviderCategoryRow {
  return {
    id: r._id, provider_id: r.providerId, external_id: r.externalId, external_name: r.externalName,
    internal_category: r.internalCategory ?? null, active: r.active, created_at: r.createdAt.toISOString(), updated_at: r.updatedAt.toISOString(),
  };
}

providersRouter.get("/:id/catalog/services", async (req, res) => {
  try {
    const q = req.query;
    const page = Number(q.page ?? 1);
    const pageSize = Number(q.pageSize ?? 25);
    const filter: Record<string, unknown> = { providerId: req.params.id };
    if (q.q) filter.externalName = { $regex: String(q.q), $options: "i" };
    if (q.category && q.category !== "all") filter.externalCategory = q.category;
    if (q.active !== undefined) filter.active = q.active === "true";
    const sort = (q.sort as string) ?? "name";
    const sortSpec: Record<string, 1 | -1> = sort === "name" ? { externalName: 1 } : sort === "cost" ? { baseCost: 1 } : { lastSeenAt: -1 };
    const c = await servicesCatalogCol();
    const [rows, total] = await Promise.all([
      c.find(filter).sort(sortSpec).skip((page - 1) * pageSize).limit(pageSize).toArray(),
      c.countDocuments(filter),
    ]);
    res.json({ items: rows.map(mapServiceRow), total });
  } catch (err) {
    fail(res, err);
  }
});

providersRouter.get("/:id/catalog/categories", async (req, res) => {
  try {
    const c = await categoriesCol();
    const rows = await c.find({ providerId: req.params.id }).sort({ externalName: 1 }).toArray();
    res.json(rows.map(mapCategoryRow));
  } catch (err) {
    fail(res, err);
  }
});

providersRouter.get("/:id/mappings", async (req, res) => {
  try {
    const c = await mappingsCol();
    const rows = await c.find({ providerId: req.params.id }).toArray();
    res.json(rows.map(mapMappingRow));
  } catch (err) {
    fail(res, err);
  }
});

providersRouter.post("/:id/mappings/bulk", async (req, res) => {
  try {
    const providerId = req.params.id;
    const pairs = (req.body?.pairs ?? []) as Array<{ internal_service_id: string; provider_service_id: string }>;
    if (!pairs.length) return res.json({ ok: true, count: 0 });
    const c = await mappingsCol();
    const now = new Date();
    await Promise.all(
      pairs.map((p) =>
        c.updateOne(
          { internalServiceId: p.internal_service_id, providerServiceId: p.provider_service_id },
          {
            $set: { providerId, enabled: true, priority: 100, updatedAt: now },
            $setOnInsert: { _id: crypto.randomUUID(), internalServiceId: p.internal_service_id, providerServiceId: p.provider_service_id, createdAt: now },
          },
          { upsert: true },
        ),
      ),
    );
    res.json({ ok: true, count: pairs.length });
  } catch (err) {
    fail(res, err);
  }
});

// =====================================================================
// src/api/syncJobs.ts — syncJobsApi
// =====================================================================
interface SyncLogRow {
  id: string; provider_id: string; job_type: "services" | "categories" | "prices" | "health";
  status: "pending" | "running" | "success" | "failed"; started_at: string; finished_at: string | null;
  items_in: number; items_out: number; error: string | null; summary: Record<string, JsonValue>;
}
type SyncLogDoc = {
  _id: string; providerId: string; jobType: "services" | "categories" | "prices" | "health";
  status: "pending" | "running" | "success" | "failed"; startedAt: Date; finishedAt: Date | null;
  itemsIn: number; itemsOut: number; error: string | null; summary: Record<string, JsonValue>; createdAt: Date; updatedAt: Date;
};
async function syncLogsCol() {
  return getCollection<SyncLogDoc>("sync_logs");
}
function mapSyncLogRow(r: SyncLogDoc): SyncLogRow {
  return {
    id: r._id, provider_id: r.providerId, job_type: r.jobType, status: r.status, started_at: r.startedAt.toISOString(),
    finished_at: r.finishedAt ? r.finishedAt.toISOString() : null, items_in: r.itemsIn, items_out: r.itemsOut,
    error: r.error, summary: r.summary ?? {},
  };
}
async function loadSyncProvider(id: string): Promise<ProviderDoc> {
  const c = await providersCol();
  const row = await c.findOne({ _id: id });
  if (!row) throw new Error("Provider not found");
  return row;
}

providersRouter.get("/:id/sync/history", async (req, res) => {
  try {
    const limit = Number(req.query.limit ?? 50);
    const c = await syncLogsCol();
    const rows = await c.find({ providerId: req.params.id }).sort({ startedAt: -1 }).limit(limit).toArray();
    res.json(rows.map(mapSyncLogRow));
  } catch (err) {
    fail(res, err);
  }
});

providersRouter.post("/:id/sync/services", async (req, res) => {
  try {
    const providerId = req.params.id;
    const provider = await loadSyncProvider(providerId);
    const adapter = getAdapterByKind(provider.kind);
    if (!adapter) throw new Error(`No adapter registered for provider kind "${provider.kind}". Use the built-in server sync (Grizzly / Tiger / SmsBower).`);
    const logsCol = await syncLogsCol();
    const now = new Date();
    const log: SyncLogDoc = {
      _id: crypto.randomUUID(), providerId, jobType: "services", status: "running", startedAt: now,
      finishedAt: null, itemsIn: 0, itemsOut: 0, error: null, summary: {}, createdAt: now, updatedAt: now,
    };
    await logsCol.insertOne(log);
    try {
      const items: RawExternalService[] = await adapter.fetchServices({
        providerId, baseUrl: provider.apiBaseUrl ?? undefined, timeoutMs: provider.timeoutMs ?? undefined,
        retries: provider.retries ?? undefined, config: provider.config ?? {},
      });
      if (items.length) {
        const svcCol = await servicesCatalogCol();
        const seenAt = new Date();
        await Promise.all(
          items.map((s) =>
            svcCol.updateOne(
              { providerId, externalId: s.externalId },
              {
                $set: {
                  externalName: s.externalName, externalCategory: s.externalCategory ?? null, baseCost: s.baseCost,
                  currency: s.currency ?? "INR", region: s.region ?? null, meta: s.meta ?? {}, active: true,
                  lastSeenAt: seenAt, updatedAt: seenAt,
                },
                $setOnInsert: { _id: crypto.randomUUID(), providerId, externalId: s.externalId, createdAt: seenAt },
              },
              { upsert: true },
            ),
          ),
        );
      }
      const finishedAt = new Date();
      const result = await logsCol.findOneAndUpdate(
        { _id: log._id },
        { $set: { status: "success", finishedAt, itemsIn: items.length, itemsOut: items.length, summary: { imported: items.length }, updatedAt: finishedAt } },
        { returnDocument: "after" },
      );
      const provCol = await providersCol();
      await provCol.updateOne({ _id: providerId }, { $set: { lastSyncAt: finishedAt, updatedAt: finishedAt } });
      if (!result) throw new Error("Sync log not found");
      res.json(mapSyncLogRow(result));
    } catch (e) {
      const msg = (e as Error).message ?? "sync failed";
      const finishedAt = new Date();
      const result = await logsCol.findOneAndUpdate(
        { _id: log._id },
        { $set: { status: "failed", finishedAt, error: msg, updatedAt: finishedAt } },
        { returnDocument: "after" },
      );
      if (!result) throw new Error("Sync log not found");
      res.json(mapSyncLogRow(result));
    }
  } catch (err) {
    fail(res, err);
  }
});

providersRouter.post("/:id/sync/categories", async (req, res) => {
  try {
    const providerId = req.params.id;
    const provider = await loadSyncProvider(providerId);
    const adapter = getAdapterByKind(provider.kind);
    if (!adapter) throw new Error(`No adapter registered for provider kind "${provider.kind}".`);
    const logsCol = await syncLogsCol();
    const now = new Date();
    const log: SyncLogDoc = {
      _id: crypto.randomUUID(), providerId, jobType: "categories", status: "running", startedAt: now,
      finishedAt: null, itemsIn: 0, itemsOut: 0, error: null, summary: {}, createdAt: now, updatedAt: now,
    };
    await logsCol.insertOne(log);
    try {
      const items: RawExternalCategory[] = await adapter.fetchCategories({ providerId, baseUrl: provider.apiBaseUrl ?? undefined, config: provider.config ?? {} });
      if (items.length) {
        const catCol = await categoriesCol();
        const seenAt = new Date();
        await Promise.all(
          items.map((c) =>
            catCol.updateOne(
              { providerId, externalId: c.externalId },
              {
                $set: { externalName: c.externalName, active: true, updatedAt: seenAt },
                $setOnInsert: { _id: crypto.randomUUID(), providerId, externalId: c.externalId, createdAt: seenAt },
              },
              { upsert: true },
            ),
          ),
        );
      }
      const finishedAt = new Date();
      const result = await logsCol.findOneAndUpdate(
        { _id: log._id },
        { $set: { status: "success", finishedAt, itemsIn: items.length, itemsOut: items.length, updatedAt: finishedAt } },
        { returnDocument: "after" },
      );
      if (!result) throw new Error("Sync log not found");
      res.json(mapSyncLogRow(result));
    } catch (e) {
      const msg = (e as Error).message ?? "sync failed";
      const finishedAt = new Date();
      const result = await logsCol.findOneAndUpdate(
        { _id: log._id },
        { $set: { status: "failed", finishedAt, error: msg, updatedAt: finishedAt } },
        { returnDocument: "after" },
      );
      if (!result) throw new Error("Sync log not found");
      res.json(mapSyncLogRow(result));
    }
  } catch (err) {
    fail(res, err);
  }
});

providersRouter.post("/:id/sync/health", async (req, res) => {
  try {
    const providerId = req.params.id;
    const provider = await loadSyncProvider(providerId);
    const adapter = getAdapterByKind(provider.kind);
    if (!adapter) throw new Error(`No adapter registered for provider kind "${provider.kind}".`);
    const started = Date.now();
    const provCol = await providersCol();
    const logsCol = await syncLogsCol();
    try {
      const r = await adapter.testConnection({ providerId, baseUrl: provider.apiBaseUrl ?? undefined, config: provider.config ?? {} });
      const now = new Date();
      await provCol.updateOne({ _id: providerId }, { $set: { latencyMs: r.latencyMs, status: r.ok ? "connected" : "error", updatedAt: now } });
      await logsCol.insertOne({
        _id: crypto.randomUUID(), providerId, jobType: "health", status: r.ok ? "success" : "failed", startedAt: now,
        finishedAt: now, itemsIn: 0, itemsOut: 0, error: null, summary: { latencyMs: r.latencyMs, message: r.message }, createdAt: now, updatedAt: now,
      });
      res.json(r);
    } catch (e) {
      const now = new Date();
      await logsCol.insertOne({
        _id: crypto.randomUUID(), providerId, jobType: "health", status: "failed", startedAt: now, finishedAt: now,
        itemsIn: 0, itemsOut: 0, error: (e as Error).message, summary: { latencyMs: Date.now() - started }, createdAt: now, updatedAt: now,
      });
      throw e;
    }
  } catch (err) {
    fail(res, err);
  }
});

// =====================================================================
// src/lib/provider-health.functions.ts — ping all built-in SMS providers
// =====================================================================
type HealthProviderDoc = { _id: string; name: string; kind: string; createdAt: Date };
const SUPPORTED_HEALTH_KINDS = new Set(["grizzlysms", "tigersms", "smsbower", "sastasms", "fivesim"]);

async function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  return await Promise.race([p, new Promise<T>((_, rej) => setTimeout(() => rej(new Error(`timeout after ${ms}ms`)), ms))]);
}

async function pingOneProvider(kind: string): Promise<{ ok: boolean; balance: number | null; message: string; latencyMs: number }> {
  const { client, label } = getSmsClientByKind(kind);
  const t0 = Date.now();
  try {
    const r = await withTimeout(client.getBalance(), 8000);
    const latencyMs = Date.now() - t0;
    const bal = (r as { balance: number | null }).balance;
    if (bal === null || Number.isNaN(bal)) return { ok: false, balance: null, message: `${label}: invalid balance response`, latencyMs };
    return { ok: true, balance: bal, message: "OK", latencyMs };
  } catch (e) {
    return { ok: false, balance: null, message: (e as Error).message, latencyMs: Date.now() - t0 };
  }
}

providersRouter.post("/health/ping-all", async (_req, res) => {
  try {
    const providersColl = await getCollection<HealthProviderDoc>("providers");
    const rows = await providersColl.find({}).sort({ createdAt: 1 }).toArray();
    const results = await Promise.all(
      rows.map(async (p) => {
        const kind = (p.kind ?? "").toLowerCase();
        if (!SUPPORTED_HEALTH_KINDS.has(kind)) {
          return {
            id: p._id, name: p.name, kind: p.kind, ok: false, latencyMs: 0, status: "disconnected" as const,
            balance: null, message: `No health adapter for "${kind || "custom"}"`, checkedAt: new Date().toISOString(),
          };
        }
        const r = await pingOneProvider(kind);
        const status: "connected" | "error" = r.ok ? "connected" : "error";
        await providersColl.updateOne({ _id: p._id }, { $set: { status, latencyMs: r.latencyMs, updatedAt: new Date() } });
        return { id: p._id, name: p.name, kind: p.kind, ok: r.ok, latencyMs: r.latencyMs, status, balance: r.balance, message: r.message, checkedAt: new Date().toISOString() };
      }),
    );
    res.json(results);
  } catch (err) {
    fail(res, err);
  }
});
