export const INR_PER_USDT = 102;

export function cleanProviderText(v: unknown) {
  return String(v ?? "").trim().toLowerCase();
}

export function isGrizzlyProvider(provider: { name?: unknown; server_name?: unknown; kind?: unknown; api_base_url?: unknown }) {
  return [provider.name, provider.server_name, provider.kind, provider.api_base_url].map(cleanProviderText).some((v) => v.includes("grizzly"));
}
export function isTigerProvider(provider: { name?: unknown; server_name?: unknown; kind?: unknown; api_base_url?: unknown }) {
  return [provider.name, provider.server_name, provider.kind, provider.api_base_url].map(cleanProviderText).some((v) => v.includes("tiger"));
}
export function isSmsBowerProvider(provider: { name?: unknown; server_name?: unknown; kind?: unknown; api_base_url?: unknown }) {
  return [provider.name, provider.server_name, provider.kind, provider.api_base_url].map(cleanProviderText).some((v) => v.includes("smsbower") || v.includes("bower"));
}
export function isSastaProvider(provider: { name?: unknown; server_name?: unknown; kind?: unknown; api_base_url?: unknown }) {
  return [provider.name, provider.server_name, provider.kind, provider.api_base_url].map(cleanProviderText).some((v) => v.includes("sasta"));
}
export function isFivesimProvider(provider: { name?: unknown; server_name?: unknown; kind?: unknown; api_base_url?: unknown }) {
  return [provider.name, provider.server_name, provider.kind, provider.api_base_url].map(cleanProviderText).some((v) => v.includes("5sim") || v.includes("fivesim"));
}

export type SmsKind = "grizzlysms" | "tigersms" | "smsbower" | "sastasms" | "fivesim";

export function detectSmsKind(provider: { name?: unknown; server_name?: unknown; kind?: unknown; api_base_url?: unknown }): SmsKind | null {
  if (isFivesimProvider(provider)) return "fivesim";
  if (isSastaProvider(provider)) return "sastasms";
  if (isSmsBowerProvider(provider)) return "smsbower";
  if (isTigerProvider(provider)) return "tigersms";
  if (isGrizzlyProvider(provider)) return "grizzlysms";
  return null;
}

export function stripGrizzlyPrefix(v: string) {
  if (/^(gr|ti|sb|ss|fs)_/.test(v)) return v.slice(3);
  return v;
}

export function splitVariant(id: string): { base: string; providerId: string | null } {
  const i = id.indexOf("@");
  if (i === -1) return { base: id, providerId: null };
  return { base: id.slice(0, i), providerId: id.slice(i + 1) || null };
}

export function providerMarkup(provider: { config?: unknown }) {
  const cfg = (provider.config ?? {}) as Record<string, unknown>;
  const raw = cfg.markupPercent ?? cfg.markup_percent ?? cfg.markup ?? 15;
  const n = Number(raw);
  return Number.isFinite(n) ? Math.max(0, n) : 15;
}

export function toInrFromProviderCost(cost: number, currency: string | null | undefined, markupPercent: number) {
  const cur = String(currency ?? "INR").trim().toUpperCase();
  const baseInr = cur === "USDT" || cur === "USD" ? cost * INR_PER_USDT : cost;
  return Number((baseInr * (1 + markupPercent / 100)).toFixed(2));
}
