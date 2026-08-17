// Rate limiting — sliding window + exponential backoff, backed by MongoDB.
export type LimitRule = { limit: number; window_seconds: number; backoff_seconds: number; max_backoff_seconds: number };
export type RateLimitConfig = { enabled: boolean; auth_ip: LimitRule; auth_account: LimitRule; webhook_ip: LimitRule };

export const DEFAULT_RATE_LIMITS: RateLimitConfig = {
  enabled: true,
  auth_ip: { limit: 20, window_seconds: 600, backoff_seconds: 15, max_backoff_seconds: 3600 },
  auth_account: { limit: 6, window_seconds: 600, backoff_seconds: 30, max_backoff_seconds: 3600 },
  webhook_ip: { limit: 60, window_seconds: 60, backoff_seconds: 5, max_backoff_seconds: 300 },
};

function mergeRule(base: LimitRule, override: unknown): LimitRule {
  if (!override || typeof override !== "object") return base;
  const o = override as Partial<LimitRule>;
  const num = (v: unknown, d: number) => (typeof v === "number" && Number.isFinite(v) && v >= 0 ? v : d);
  return {
    limit: Math.max(1, num(o.limit, base.limit)),
    window_seconds: Math.max(1, num(o.window_seconds, base.window_seconds)),
    backoff_seconds: num(o.backoff_seconds, base.backoff_seconds),
    max_backoff_seconds: Math.max(1, num(o.max_backoff_seconds, base.max_backoff_seconds)),
  };
}

export async function loadRateLimitConfig(): Promise<RateLimitConfig> {
  try {
    const { getCollection } = await import("./mongo.ts");
    const settings = await getCollection<{ _id: string; value: Partial<RateLimitConfig> }>("app_settings");
    const doc = await settings.findOne({ _id: "rate_limits" });
    const v = doc?.value ?? {};
    return {
      enabled: typeof v.enabled === "boolean" ? v.enabled : DEFAULT_RATE_LIMITS.enabled,
      auth_ip: mergeRule(DEFAULT_RATE_LIMITS.auth_ip, v.auth_ip),
      auth_account: mergeRule(DEFAULT_RATE_LIMITS.auth_account, v.auth_account),
      webhook_ip: mergeRule(DEFAULT_RATE_LIMITS.webhook_ip, v.webhook_ip),
    };
  } catch (err) {
    console.error("[rate-limit] config load failed", err);
    return DEFAULT_RATE_LIMITS;
  }
}

export type LimitResult = { allowed: boolean; retryAfter: number };
type RateLimitDoc = { _id: string; bucket: string; key: string; hits: number; strikes: number; windowStart: Date; blockedUntil: Date | null; updatedAt: Date };

async function consume(bucket: string, key: string, rule: LimitRule): Promise<LimitResult> {
  try {
    const { getCollection } = await import("./mongo.ts");
    const col = await getCollection<RateLimitDoc>("rate_limits");
    const id = `${bucket}::${key}`;
    const now = new Date();
    const existing = await col.findOne({ _id: id });
    if (existing?.blockedUntil && existing.blockedUntil.getTime() > now.getTime()) {
      return { allowed: false, retryAfter: Math.ceil((existing.blockedUntil.getTime() - now.getTime()) / 1000) };
    }
    const windowMs = rule.window_seconds * 1000;
    const windowExpired = !existing || now.getTime() - existing.windowStart.getTime() > windowMs;
    const nextHits = windowExpired ? 1 : existing.hits + 1;
    const nextWindowStart = windowExpired ? now : existing.windowStart;
    if (nextHits > rule.limit) {
      const strikes = (windowExpired ? 0 : (existing?.strikes ?? 0)) + 1;
      const backoffSeconds = rule.backoff_seconds > 0
        ? Math.min(rule.backoff_seconds * 2 ** (strikes - 1), rule.max_backoff_seconds)
        : Math.min(rule.window_seconds, rule.max_backoff_seconds);
      const blockedUntil = new Date(now.getTime() + backoffSeconds * 1000);
      await col.updateOne({ _id: id }, { $set: { bucket, key, hits: nextHits, strikes, windowStart: nextWindowStart, blockedUntil, updatedAt: now } }, { upsert: true });
      return { allowed: false, retryAfter: backoffSeconds };
    }
    await col.updateOne(
      { _id: id },
      { $set: { bucket, key, hits: nextHits, windowStart: nextWindowStart, blockedUntil: null, updatedAt: now }, $setOnInsert: { strikes: 0 } },
      { upsert: true },
    );
    return { allowed: true, retryAfter: 0 };
  } catch (err) {
    console.error("[rate-limit] consume failed", err);
    return { allowed: true, retryAfter: 0 };
  }
}

export function clientIpFrom(req: { headers: Record<string, string | string[] | undefined>; socket?: { remoteAddress?: string } }): string {
  const xff = req.headers["x-forwarded-for"];
  const xffStr = Array.isArray(xff) ? xff[0] : xff;
  return (
    (Array.isArray(req.headers["cf-connecting-ip"]) ? req.headers["cf-connecting-ip"][0] : (req.headers["cf-connecting-ip"] as string)) ||
    (xffStr ? xffStr.split(",")[0]!.trim() : "") ||
    req.socket?.remoteAddress ||
    "unknown"
  );
}

export async function checkAuthLimit(action: string, ip: string, account: string | null): Promise<LimitResult> {
  const cfg = await loadRateLimitConfig();
  if (!cfg.enabled) return { allowed: true, retryAfter: 0 };
  const ipRes = await consume(`auth:${action}:ip`, ip, cfg.auth_ip);
  if (!ipRes.allowed) return ipRes;
  if (!account) return ipRes;
  return consume(`auth:${action}:account`, account.toLowerCase(), cfg.auth_account);
}

export async function checkWebhookLimit(ip: string): Promise<LimitResult> {
  const cfg = await loadRateLimitConfig();
  if (!cfg.enabled) return { allowed: true, retryAfter: 0 };
  return consume("webhook:upi:ip", ip, cfg.webhook_ip);
}
