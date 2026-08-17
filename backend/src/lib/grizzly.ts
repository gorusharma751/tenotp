// Server-only helpers for GrizzlySMS (sms-activate compatible).
// Docs: https://grizzlysms.com/docs/partner

// SMS-Activate compatible client factory. Works for Grizzly, Tiger, and clones.

export type CountryRow = { id: number; eng: string; rus?: string; visible?: number };
export type PricesResp = Record<string, Record<string, { cost: number; count: number }>>;
// getPricesV3 (SmsBower): country → service → providerId → {price,count,provider_id}
export type PricesV3Resp = Record<string, Record<string, Record<string, { price: number; count: number; provider_id: number }>>>;

export function createSmsActivateClient(opts: { base: string; label: string; apiKey?: string | null }) {
  const label = opts.label;
  const base = opts.base;
  async function call(action: string, extra: Record<string, string> = {}, o: { raw?: boolean } = {}) {
    const key = opts.apiKey;
    if (!key) throw new Error(`${label} API key not configured`);
    const params = new URLSearchParams({ api_key: key, action, ...extra });
    const res = await fetch(`${base}?${params.toString()}`, { method: "GET" });
    if (!res.ok) throw new Error(`${label} ${action} failed: ${res.status}`);
    const text = await res.text();
    if (o.raw) return text;
    try { return JSON.parse(text); }
    catch { throw new Error(`${label} ${action} non-JSON: ${text.slice(0, 120)}`); }
  }
  return {
    getBalance: async () => {
      const t = (await call("getBalance", {}, { raw: true })) as string;
      const m = /ACCESS_BALANCE:([\d.]+)/.exec(t);
      return { balance: m ? Number(m[1]) : null, raw: t };
    },
    getCountries: () => call("getCountries") as Promise<Record<string, CountryRow>>,
    getPrices: (params: { service?: string; country?: string } = {}) => {
      const extra: Record<string, string> = {};
      if (params.service) extra.service = params.service;
      if (params.country) extra.country = params.country;
      return call("getPrices", extra) as Promise<PricesResp>;
    },
    getPricesV3: (params: { service?: string; country?: string } = {}) => {
      const extra: Record<string, string> = {};
      if (params.service) extra.service = params.service;
      if (params.country) extra.country = params.country;
      return call("getPricesV3", extra) as Promise<PricesV3Resp>;
    },
    getServicesList: (country?: string) => call("getServicesList", country ? { country } : {}),
    getNumber: async (service: string, country: string, opts: { providerIds?: string | number; maxPrice?: number } = {}) => {
      const extra: Record<string, string> = { service, country };
      if (opts.providerIds !== undefined && opts.providerIds !== null && String(opts.providerIds) !== "") {
        extra.providerIds = String(opts.providerIds);
      }
      if (opts.maxPrice !== undefined && Number.isFinite(opts.maxPrice)) {
        extra.maxPrice = String(opts.maxPrice);
      }
      const t = (await call("getNumber", extra, { raw: true })) as string;
      const m = /^ACCESS_NUMBER:([^:]+):(.+)$/.exec(t.trim());
      if (!m) {
        const clean = t.trim().replace(/_/g, " ").toLowerCase();
        if (/no\s*balance/.test(clean)) {
          throw new Error(`${label} provider is out of balance. Please try another server or contact admin.`);
        }
        if (/no\s*numbers?/.test(clean)) {
          throw new Error(`No numbers available for this service on ${label} right now. Try another service or server.`);
        }
        throw new Error(clean ? `${label}: ${clean}` : `${label} did not reserve a number`);
      }
      return { activationId: m[1], number: m[2], raw: t };
    },
    getStatus: async (id: string) => {
      const t = (await call("getStatus", { id }, { raw: true })) as string;
      const raw = t.trim();
      const ok = /^STATUS_OK:(.+)$/.exec(raw);
      if (ok) return { status: "received", code: ok[1], raw };
      return { status: raw, code: null as string | null, raw };
    },
    setStatus: async (id: string, status: 1 | 3 | 6 | 8) => {
      const t = (await call("setStatus", { id, status: String(status) }, { raw: true })) as string;
      return { raw: t.trim() };
    },
  };
}

export const grizzly = createSmsActivateClient({
  base: "https://api.grizzlysms.com/stubs/handler_api.php",
  label: "GrizzlySMS",
  get apiKey() { return process.env.GRIZZLYSMS_API_KEY; },
} as any);

export const tiger = createSmsActivateClient({
  base: "https://api.tiger-sms.com/stubs/handler_api.php",
  label: "TigerSMS",
  get apiKey() { return process.env.TIGERSMS_API_KEY; },
} as any);

export const smsbower = createSmsActivateClient({
  base: "https://smsbower.online/stubs/handler_api.php",
  label: "SmsBower",
  get apiKey() { return process.env.SMSBOWER_API_KEY; },
} as any);

// SastaSMS has its own JSON catalog. Their docs define getServicesList as the
// source of truth: every active service includes live INR price, availability,
// and a per-country breakdown. Wrap that shape into the sms-activate-like
// interface used by the rest of the app. We expose costs as pseudo-USDT
// (INR / 102) so the shared pricing pipeline still produces INR correctly.
const SASTA_INR_PER_USDT = 102;
export const sastasms = (() => {
  const label = "SastaSMS";
  const base = "https://sastasms.pro/stubs/handler_api.php";
  async function call(action: string, extra: Record<string, string> = {}, o: { raw?: boolean } = {}) {
    const key = process.env.SASTASMS_API_KEY;
    if (!key) throw new Error(`${label} API key not configured`);
    const params = new URLSearchParams({ api_key: key, action, ...extra });
    if (!o.raw && !params.has("format")) params.set("format", "json");
    const res = await fetch(`${base}?${params.toString()}`);
    if (!res.ok) throw new Error(`${label} ${action} failed: ${res.status}`);
    const text = await res.text();
    if (o.raw) return text;
    try { return JSON.parse(text); } catch { throw new Error(`${label} ${action} non-JSON: ${text.slice(0,120)}`); }
  }
  type SastaCountry = {
    country_code?: string | number;
    country_name?: string;
    code?: string | number;
    id?: string | number;
    eng?: string;
    name?: string;
    flag?: string;
    price?: string | number;
    qty?: string | number;
    count?: string | number;
    available?: string | number;
  };
  type SastaService = {
    code?: string;
    name?: string;
    logo?: string;
    price?: string | number;
    currency?: string;
    available?: string | number;
    countries?: SastaCountry[];
    multi_sms?: boolean;
    expires_in?: number;
  };
  type SastaPricesApiResp = {
    status?: string;
    data?: Record<string, Record<string, { cost?: string | number; count?: string | number }>>;
  };
  type SastaServicesResp = {
    status?: string;
    total?: number;
    services?: Record<string, SastaService> | SastaService[];
  };
  function asServices(raw: unknown): Array<SastaService & { code: string }> {
    const services = (raw as SastaServicesResp | undefined)?.services ?? {};
    const entries = Array.isArray(services)
      ? services.map((svc) => [svc?.code ?? "", svc] as const)
      : Object.entries(services);
    return entries
      .map(([code, svc]) => ({ ...(svc ?? {}), code: String((svc as SastaService | undefined)?.code ?? code).trim() }))
      .filter((svc) => svc.code.length > 0);
  }
  async function loadServices(service?: string): Promise<Array<SastaService & { code: string }>> {
    const r = await call("getServicesList", service ? { service } : {}) as SastaServicesResp;
    return asServices(r);
  }
  function normalizeSastaPrices(raw: unknown, filter: { service?: string; country?: string } = {}): PricesResp {
    const data = ((raw as SastaPricesApiResp | undefined)?.data ?? raw) as Record<string, Record<string, { cost?: string | number; count?: string | number }>>;
    const out: PricesResp = {};
    for (const [cidRaw, byService] of Object.entries(data ?? {})) {
      const cid = String(cidRaw).trim();
      if (!cid || cid === "*" || cid.toLowerCase() === "any") continue;
      if (filter.country && cid !== String(filter.country)) continue;
      if (!byService || typeof byService !== "object") continue;
      for (const [codeRaw, info] of Object.entries(byService)) {
        const code = String(codeRaw).trim();
        if (!code || (filter.service && code !== filter.service)) continue;
        const priceInr = Number(info?.cost);
        const count = Number(info?.count) || 0;
        if (!Number.isFinite(priceInr) || priceInr <= 0 || count <= 0) continue;
        out[cid] ??= {};
        out[cid][code] = { cost: priceInr / SASTA_INR_PER_USDT, count };
      }
    }
    return out;
  }
  async function loadPricesFromApi(p: { service?: string; country?: string } = {}): Promise<PricesResp> {
    const extra: Record<string, string> = {};
    if (p.service) extra.service = p.service;
    if (p.country) extra.country = p.country;
    const r = await call("getPrices", extra) as SastaPricesApiResp;
    return normalizeSastaPrices(r, p);
  }
  let countriesCache: Record<string, CountryRow> | null = null;
  async function loadCountries(): Promise<Record<string, CountryRow>> {
    if (countriesCache) return countriesCache;
    const r = (await call("getCountries")) as { countries?: Record<string, { code?: string | number; id?: string | number; name?: string; eng?: string; flag?: string }> | Array<{ code?: string | number; id?: string | number; name?: string; eng?: string; flag?: string }> };
    const out: Record<string, CountryRow> = {};
    const raw = r?.countries ?? {};
    const entries = Array.isArray(raw) ? raw.map((info) => [String(info?.code ?? info?.id ?? ""), info] as const) : Object.entries(raw);
    for (const [key, info] of entries) {
      const cid = String(info?.code ?? info?.id ?? key).trim();
      if (!cid) continue;
      out[cid] = { id: Number(cid) || 0, eng: info?.eng ?? info?.name ?? `Country ${cid}`, visible: 1 };
    }
    countriesCache = out;
    return out;
  }
  return {
    getBalance: async () => {
      const t = (await call("getBalance", {}, { raw: true })) as string;
      const m = /ACCESS_BALANCE:([\d.]+)/.exec(t);
      return { balance: m ? Number(m[1]) : null, raw: t };
    },
    getCountries: async () => loadCountries(),
    getPrices: async (p: { service?: string; country?: string } = {}) => {
      try {
        const live = await loadPricesFromApi(p);
        if (Object.keys(live).length > 0) return live;
      } catch { /* fallback to getServicesList below */ }
      const [services, allCountries] = await Promise.all([loadServices(p.service), loadCountries()]);
      const out: PricesResp = {};
      for (const svc of services) {
        const code = svc.code;
        if (p.service && code !== p.service) continue;
        const servicePriceInr = Number(svc.price);
        const serviceStock = Number(svc.available) || 0;
        const countries = Array.isArray(svc.countries) ? svc.countries : [];
        if (countries.length === 0) {
          const countryIds = p.country ? [String(p.country)] : Object.keys(allCountries);
          if (Number.isFinite(servicePriceInr) && servicePriceInr > 0 && serviceStock > 0) {
            for (const cid of countryIds) {
              out[cid] ??= {};
              out[cid][code] = { cost: servicePriceInr / SASTA_INR_PER_USDT, count: serviceStock };
            }
          }
          continue;
        }
        for (const c of countries) {
          const cid = String(c.country_code ?? c.code ?? c.id ?? "").trim();
          if (!cid || (p.country && cid !== String(p.country))) continue;
          const priceInr = Number(c.price ?? svc.price);
          const count = Number(c.qty ?? c.count ?? c.available ?? 0);
          if (!Number.isFinite(priceInr) || priceInr <= 0 || count <= 0) continue;
          out[cid] ??= {};
          out[cid][code] = { cost: priceInr / SASTA_INR_PER_USDT, count };
        }
      }
      return out;
    },
    getPricesV3: async (_p: { service?: string; country?: string } = {}) => ({} as PricesV3Resp),
    getServicesList: async (_country?: string) => {
      const list = await loadServices();
      const services: Array<{
        code: string;
        name: string;
        price: number;
        available: number;
        currency: string;
        countries: SastaCountry[];
        multi_sms?: boolean;
      }> = list
        .map((s) => ({
          code: s.code,
          name: s.name ?? s.code,
          price: Number(s.price),
          available: Number(s.available) || 0,
          currency: s.currency ?? "INR",
          countries: Array.isArray(s.countries) ? s.countries : [],
          multi_sms: Boolean(s.multi_sms),
        }))
        .filter((s) => s.code && s.name);
      return { services };
    },
    getNumber: async (service: string, country: string, opts: { providerIds?: string | number; maxPrice?: number } = {}) => {
      const extra: Record<string, string> = { service, format: "json" };
      if (country) extra.country = country;
      if (opts.maxPrice !== undefined && Number.isFinite(opts.maxPrice)) {
        extra.maxPrice = String(Number((opts.maxPrice * SASTA_INR_PER_USDT).toFixed(2)));
      }
      const t = (await call("getNumber", extra, { raw: true })) as string;
      let parsed: { status?: string; activation_id?: string | number; order_id?: string | number; number?: string | number; phone_number?: string | number; error?: string; message?: string } | null = null;
      try { parsed = JSON.parse(t); } catch { parsed = null; }
      const activationId = parsed?.activation_id ?? parsed?.order_id;
      const number = parsed?.number ?? parsed?.phone_number;
      if (parsed && String(parsed.status ?? "").toUpperCase() === "OK" && activationId && number) {
        return { activationId: String(activationId), number: String(number).replace(/^\+/, ""), raw: t };
      }
      const m = /^ACCESS_NUMBER:([^:]+):(.+)$/.exec(t.trim());
      if (!m) {
        const clean = String(parsed?.error ?? parsed?.message ?? parsed?.status ?? t).trim().replace(/_/g, " ").toLowerCase();
        if (/no\s*balance/.test(clean)) throw new Error(`${label} provider is out of balance. Please try another server or contact admin.`);
        if (/no\s*numbers?/.test(clean)) throw new Error(`No numbers available for this service on ${label} right now. Try another server.`);
        if (/max\s*price/.test(clean)) throw new Error(`${label}: current price is higher than quoted. Search again for latest price.`);
        if (/service\s*unavailable/.test(clean)) throw new Error(`${label}: service is not available for this country right now.`);
        throw new Error(clean ? `${label}: ${clean}` : `${label} did not reserve a number`);
      }
      return { activationId: m[1], number: m[2], raw: t };
    },
    getStatus: async (id: string) => {
      const t = (await call("getStatus", { id }, { raw: true })) as string;
      const raw = t.trim();
      const ok = /^STATUS_OK:(.+)$/.exec(raw);
      if (ok) return { status: "received", code: ok[1], raw };
      return { status: raw, code: null as string | null, raw };
    },
    setStatus: async (id: string, status: 1 | 3 | 6 | 8) => {
      const t = (await call("setStatus", { id, status: String(status) }, { raw: true })) as string;
      return { raw: t.trim() };
    },
  };
})();

// ---------------- 5sim (REST) wrapped in the sms-activate interface ----------------
// Docs: https://5sim.net/docs. Prices are in RUB — we convert to a pseudo-USDT
// number so the existing pricing pipeline (raw * INR_PER_USDT * markup) yields
// a sensible INR amount. 1 USDT ≈ 90 RUB → raw = rub/90.
const RUB_PER_USDT = 90;

export function createFivesimClient(opts: { label: string; get apiKey(): string | undefined }) {
  const label = opts.label;
  const base = "https://5sim.net/v1";
  async function call(path: string, o: { auth?: boolean; method?: string } = {}) {
    const headers: Record<string, string> = { Accept: "application/json" };
    if (o.auth !== false) {
      const key = opts.apiKey;
      if (!key) throw new Error(`${label} API key not configured`);
      headers.Authorization = `Bearer ${key}`;
    }
    const res = await fetch(`${base}${path}`, { method: o.method ?? "GET", headers });
    const text = await res.text();
    if (!res.ok) throw new Error(`${label} ${path} failed: ${res.status} ${text.slice(0, 160)}`);
    try { return JSON.parse(text); } catch { return text as unknown; }
  }
  function slugId(s: string) {
    // 5sim uses country/product slugs (afghanistan, whatsapp). Hash to a stable
    // numeric-ish string only when we need to feed it into UI that expects one.
    return s;
  }
  return {
    getBalance: async () => {
      const p = (await call("/user/profile")) as { balance?: number };
      return { balance: Number(p?.balance ?? 0), raw: JSON.stringify(p) };
    },
    getCountries: async () => {
      const r = (await call("/guest/countries", { auth: false })) as Record<string, { text_en?: string; text_ru?: string }>;
      const out: Record<string, CountryRow> = {};
      let id = 0;
      for (const [slug, info] of Object.entries(r)) {
        out[slug] = { id: id++, eng: info?.text_en ?? slug, rus: info?.text_ru, visible: 1 };
      }
      return out;
    },
    getPrices: async (params: { service?: string; country?: string } = {}) => {
      const qs = new URLSearchParams();
      if (params.country) qs.set("country", params.country);
      if (params.service) qs.set("product", params.service);
      const path = qs.toString() ? `/guest/prices?${qs.toString()}` : "/guest/prices";
      const r = (await call(path, { auth: false })) as Record<string, Record<string, Record<string, { cost: number; count: number }>>>;
      const out: PricesResp = {};
      for (const [country, products] of Object.entries(r)) {
        out[country] = {};
        for (const [product, ops] of Object.entries(products)) {
          // Aggregate operators: min cost + total count.
          let minCost = Infinity; let count = 0;
          for (const info of Object.values(ops)) {
            const c = Number(info?.cost); const n = Number(info?.count) || 0;
            if (Number.isFinite(c) && c > 0 && c < minCost) minCost = c;
            count += n;
          }
          if (minCost === Infinity) continue;
          out[country][slugId(product)] = { cost: minCost / RUB_PER_USDT, count };
        }
      }
      return out;
    },
    getPricesV3: async (_p: { service?: string; country?: string } = {}) => ({} as PricesV3Resp),
    getServicesList: async (_country?: string) => {
      const r = (await call("/guest/products/any/any", { auth: false })) as Record<string, unknown>;
      const services = Object.keys(r ?? {}).map((code) => ({ code, name: code.replace(/[_-]+/g, " ").replace(/\b\w/g, (m) => m.toUpperCase()) }));
      return { services };
    },
    getNumber: async (service: string, country: string, _opts: { providerIds?: string | number; maxPrice?: number } = {}) => {
      const r = (await call(`/user/buy/activation/${encodeURIComponent(country)}/any/${encodeURIComponent(service)}`)) as { id?: number | string; phone?: string; error?: string };
      if (!r?.id || !r?.phone) {
        const msg = (r as { error?: string })?.error || JSON.stringify(r).slice(0, 160);
        if (/no free phones|no numbers/i.test(msg)) throw new Error(`No numbers available for this service on ${label} right now. Try another server.`);
        if (/no balance/i.test(msg)) throw new Error(`${label} provider is out of balance. Please try another server or contact admin.`);
        throw new Error(`${label}: ${msg}`);
      }
      return { activationId: String(r.id), number: String(r.phone).replace(/^\+/, ""), raw: JSON.stringify(r) };
    },
    getStatus: async (id: string) => {
      const r = (await call(`/user/check/${encodeURIComponent(id)}`)) as { sms?: Array<{ code?: string }>; status?: string };
      const code = r?.sms?.find((s) => s?.code)?.code ?? null;
      const raw = JSON.stringify(r);
      if (code) return { status: "received", code, raw };
      return { status: r?.status ?? "pending", code: null as string | null, raw };
    },
    setStatus: async (id: string, status: 1 | 3 | 6 | 8) => {
      const path = status === 6 ? `/user/finish/${encodeURIComponent(id)}` : status === 8 ? `/user/cancel/${encodeURIComponent(id)}` : null;
      if (!path) return { raw: "OK" };
      try { await call(path); } catch { /* best effort */ }
      return { raw: "OK" };
    },
  };
}

export const fivesim = createFivesimClient({
  label: "5sim",
  get apiKey() { return process.env.FIVESIM_API_KEY; },
});

export function getSmsClientByKind(kind?: string | null) {
  const k = String(kind ?? "").toLowerCase();
  if (k === "tigersms" || k === "tiger") return { client: tiger, prefix: "ti_", label: "TigerSMS" };
  if (k === "smsbower" || k === "bower") return { client: smsbower, prefix: "sb_", label: "SmsBower" };
  if (k === "sastasms" || k === "sasta") return { client: sastasms, prefix: "ss_", label: "SastaSMS" };
  if (k === "fivesim" || k === "5sim") return { client: fivesim as unknown as ReturnType<typeof createSmsActivateClient>, prefix: "fs_", label: "5sim" };
  return { client: grizzly, prefix: "gr_", label: "GrizzlySMS" };
}

// Best-effort friendly name + emoji for common service codes.
export const SERVICE_META: Record<string, { name: string; icon: string; category: string }> = {
  wa: { name: "WhatsApp", icon: "💬", category: "messaging" },
  tg: { name: "Telegram", icon: "✈️", category: "messaging" },
  ig: { name: "Instagram", icon: "📸", category: "social" },
  fb: { name: "Facebook", icon: "📘", category: "social" },
  go: { name: "Google", icon: "🔎", category: "productivity" },
  ds: { name: "Discord", icon: "🎮", category: "gaming" },
  tw: { name: "Twitter/X", icon: "🐦", category: "social" },
  vi: { name: "Viber", icon: "📞", category: "messaging" },
  wb: { name: "WeChat", icon: "💚", category: "messaging" },
  am: { name: "Amazon", icon: "🛒", category: "shopping" },
  mm: { name: "Microsoft", icon: "🪟", category: "productivity" },
  ub: { name: "Uber", icon: "🚗", category: "transport" },
  ot: { name: "Other", icon: "🔧", category: "other" },
  ap: { name: "Apple", icon: "🍎", category: "productivity" },
  nf: { name: "Netflix", icon: "🎬", category: "streaming" },
  ya: { name: "Yandex", icon: "🔤", category: "productivity" },
  ok: { name: "Ok.ru", icon: "🟠", category: "social" },
  vk: { name: "VK", icon: "💠", category: "social" },
  tn: { name: "LinkedIn", icon: "💼", category: "productivity" },
  sn: { name: "OLX", icon: "🏷️", category: "shopping" },
  pm: { name: "AOL", icon: "📧", category: "productivity" },
  lf: { name: "TikTok", icon: "🎵", category: "social" },
};

// Emoji fallback by keyword — used when a service code is missing from SERVICE_META
// but Grizzly returned a friendly name.
const NAME_ICON_HINTS: Array<[RegExp, string, string]> = [
  [/whatsapp/i, "💬", "messaging"],
  [/telegram/i, "✈️", "messaging"],
  [/instagram/i, "📸", "social"],
  [/facebook|meta/i, "📘", "social"],
  [/google|gmail|youtube/i, "🔎", "productivity"],
  [/discord/i, "🎮", "gaming"],
  [/twitter|^x$|\bx\b/i, "🐦", "social"],
  [/viber/i, "📞", "messaging"],
  [/wechat|weibo/i, "💚", "messaging"],
  [/amazon/i, "🛒", "shopping"],
  [/microsoft|outlook|hotmail|xbox/i, "🪟", "productivity"],
  [/uber|lyft|bolt|indriver|didi/i, "🚗", "transport"],
  [/apple|icloud/i, "🍎", "productivity"],
  [/netflix|hulu|disney|hbo|spotify|prime/i, "🎬", "streaming"],
  [/yandex/i, "🔤", "productivity"],
  [/linkedin/i, "💼", "productivity"],
  [/tiktok/i, "🎵", "social"],
  [/tinder|bumble|badoo|hinge|match/i, "❤️", "dating"],
  [/paypal|stripe|payoneer|revolut|wise|binance|coinbase|crypto/i, "💳", "finance"],
  [/bank|sberbank|paytm|phonepe|gpay/i, "🏦", "finance"],
  [/steam|epic|riot|blizzard|playstation|nintendo/i, "🎮", "gaming"],
  [/mail|email/i, "📧", "productivity"],
  [/shop|store|market|ebay|aliexpress|shopee|lazada|flipkart/i, "🛍️", "shopping"],
  [/food|delivery|zomato|swiggy|grab|glovo|doordash/i, "🍔", "food"],
  [/dropbox|drive|cloud/i, "☁️", "productivity"],
  [/vk|vkontakte/i, "💠", "social"],
  [/snapchat/i, "👻", "social"],
  [/pinterest/i, "📌", "social"],
  [/reddit/i, "👽", "social"],
  [/twitch/i, "🎥", "streaming"],
  [/signal/i, "🔒", "messaging"],
  [/line/i, "💚", "messaging"],
  [/kakao/i, "💛", "messaging"],
  [/imo/i, "🟣", "messaging"],
  [/1xbet|bet|casino|poker|slots|gamechanger|32red|888|stake|dafabet|melbet|pari|sportsbook/i, "🎲", "gaming"],
  [/binance|bybit|okx|kucoin|crypto|coin|wallet|cash|pay|bank|finance|trading|wise|revolut/i, "💳", "finance"],
  [/fave|foodpanda|ubereats|zomato|swiggy|restaurant|grocery|mart/i, "🍔", "food"],
  [/booking|airbnb|hotel|travel|flight|trip|agoda/i, "✈️", "travel"],
  [/chat|dating|meet|love|fave|tinder|bumble|badoo/i, "❤️", "dating"],
  [/game|play|fun|live|stream/i, "🎮", "gaming"],
  [/taxi|cab|ride|car|delivery/i, "🚗", "transport"],
  [/shop|store|market|sell|buy|deal|coupon|fave/i, "🛍️", "shopping"],
  [/mail|email|domain|host|cloud|office/i, "📧", "productivity"],
];

export function serviceMeta(code: string) {
  return SERVICE_META[code] ?? { name: code.toUpperCase(), icon: "🔌", category: "other" };
}

export function guessMetaFromName(name: string) {
  for (const [re, icon, category] of NAME_ICON_HINTS) {
    if (re.test(name)) return { icon, category };
  }
  return { icon: "🔌", category: "other" };
}

// Small emoji flag lookup for common countries (fallback 🌐).
export const COUNTRY_FLAGS: Record<string, string> = {
  Russia: "🇷🇺", Ukraine: "🇺🇦", Kazakhstan: "🇰🇿", China: "🇨🇳", India: "🇮🇳",
  USA: "🇺🇸", "United States": "🇺🇸", Indonesia: "🇮🇩", Philippines: "🇵🇭",
  Malaysia: "🇲🇾", Kenya: "🇰🇪", Tanzania: "🇹🇿", Vietnam: "🇻🇳", Kyrgyzstan: "🇰🇬",
  Nigeria: "🇳🇬", Poland: "🇵🇱", "Great Britain": "🇬🇧", UK: "🇬🇧",
  Madagascar: "🇲🇬", Congo: "🇨🇩", Cambodia: "🇰🇭", Burundi: "🇧🇮",
  Israel: "🇮🇱", "Hong Kong": "🇭🇰", Turkey: "🇹🇷", Germany: "🇩🇪", France: "🇫🇷",
  Spain: "🇪🇸", Italy: "🇮🇹", Egypt: "🇪🇬", Brazil: "🇧🇷", Mexico: "🇲🇽",
  Colombia: "🇨🇴", Argentina: "🇦🇷", Canada: "🇨🇦", Australia: "🇦🇺",
  Netherlands: "🇳🇱", Portugal: "🇵🇹", Romania: "🇷🇴", Belarus: "🇧🇾",
};