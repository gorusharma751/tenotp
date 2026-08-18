// Real catalog sync for the 5 built-in sms-activate-style providers
// (grizzly, tiger, smsbower, sastasms, fivesim) — fetches live
// countries/services/prices from the upstream and writes them into the
// `countries`/`services` collections that /otp/services and /otp/buy
// actually read from.
//
// This was previously only reachable via public.ts's CRON_SECRET-gated
// POST /api/public/sync-all (meant for an external cron), with no way for
// an admin to trigger it on demand from the UI. The admin Providers page's
// per-row "Sync services" button instead called a completely different,
// dead code path (POST /:id/sync/services → lib/providers/registry.ts's
// adapter registry, which nothing ever registers into — see registry.ts —
// and which, even if it worked, writes to an unrelated `provider_services`
// collection the real purchase flow never reads). Extracted here so both
// the cron route and a real admin-triggered route share one implementation
// instead of admin clicks going through a route that could never work.
import { getCollection } from "../mongo.ts";
import { serviceMeta, guessMetaFromName, COUNTRY_FLAGS, getSmsClientByKind } from "../grizzly.ts";

type CountryDoc = {
  _id: string; name: string; flag: string; numbersAvailable: number; priceFrom: number;
  enabled: boolean; operators: number; priority: number; createdAt: Date; updatedAt: Date;
};
type ServiceDoc = {
  _id: string; name: string; icon: string; category: string; price: number; successRate: number;
  enabled: boolean; countries: number; orders: number; createdAt: Date; updatedAt: Date;
};

export const SYNCABLE_KINDS = new Set(["grizzlysms", "tigersms", "smsbower", "sastasms", "fivesim"]);
const USDT_INR = 102;

function safePriority(cid: string) {
  const n = Number(cid);
  return Number.isFinite(n) && n >= 0 && n < 100000 ? n + 1 : 999;
}

export async function syncProviderCatalog(provider: { _id: string; name: string; kind: string; config?: Record<string, unknown> | null }) {
  const kind = String(provider.kind ?? "").toLowerCase();
  if (!SYNCABLE_KINDS.has(kind)) {
    throw new Error(`Live catalog sync isn't available for "${kind || "custom"}" providers — only GrizzlySMS/TigerSMS/SmsBower/SastaSMS/5sim are supported.`);
  }
  const markupPercent = Math.max(0, Number(provider.config?.markupPercent ?? 50));
  const markup = 1 + markupPercent / 100;
  const { client, prefix } = getSmsClientByKind(kind);

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
      _id: `${prefix}${cid}`, name, flag: COUNTRY_FLAGS[name] ?? "🌐",
      numbersAvailable: Math.min(cStock.get(cid) ?? 0, 2_000_000_000),
      priceFrom: Number((minUsdt * USDT_INR * markup).toFixed(2)),
      enabled: info?.visible !== 0, operators: 1, priority: safePriority(cid),
    };
  });
  const serviceRows = Array.from(svcMin.entries()).map(([code, minUsdt]) => {
    const meta = serviceMeta(code);
    const friendly = nameByCode.get(code) ?? meta.name;
    const guess = meta.icon !== "🔌" ? { icon: meta.icon, category: meta.category } : guessMetaFromName(friendly);
    return {
      _id: `${prefix}${code}`, name: friendly, icon: guess.icon, category: guess.category,
      price: Number((minUsdt * USDT_INR * markup).toFixed(2)), successRate: 95, enabled: true,
      countries: svcCountries.get(code)?.size ?? 0, orders: 0,
    };
  });

  const countriesCol = await getCollection<CountryDoc>("countries");
  const servicesCol = await getCollection<ServiceDoc>("services");
  const idPrefixRegex = `^${prefix}`;
  await servicesCol.deleteMany({ _id: { $regex: idPrefixRegex } });
  await countriesCol.deleteMany({ _id: { $regex: idPrefixRegex } });

  const now = new Date();
  if (countryRows.length > 0) {
    await countriesCol.bulkWrite(countryRows.map(({ _id, ...fields }) => ({
      updateOne: { filter: { _id }, update: { $set: { ...fields, updatedAt: now }, $setOnInsert: { createdAt: now } }, upsert: true },
    })));
  }
  if (serviceRows.length > 0) {
    await servicesCol.bulkWrite(serviceRows.map(({ _id, ...fields }) => ({
      updateOne: { filter: { _id }, update: { $set: { ...fields, updatedAt: now }, $setOnInsert: { createdAt: now } }, upsert: true },
    })));
  }

  return { kind, countries: countryRows.length, services: serviceRows.length, markupPercent };
}
