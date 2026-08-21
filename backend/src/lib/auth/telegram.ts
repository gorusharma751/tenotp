// Validates the `initData` string a Telegram Mini App hands the frontend
// on launch — https://core.telegram.org/bots/webapps#validating-data-received-via-the-mini-app.
// This is the ONLY thing that proves a request actually came from Telegram
// (not just someone POSTing a made-up user id): the hash is an HMAC over
// every other field, keyed off a secret derived from the bot token, which
// only Telegram and this backend ever see.
import crypto from "node:crypto";

export type TelegramWebAppUser = {
  id: number;
  first_name: string;
  last_name?: string;
  username?: string;
  photo_url?: string;
};

/** Returns the verified user payload, or null if the signature is invalid,
 * missing, or the auth_date is too old (replay protection — Telegram
 * re-signs initData fresh on every Mini App launch, so a stale one here
 * means it's being replayed, not a live launch). */
export function verifyTelegramInitData(initData: string, botToken: string, maxAgeSeconds = 86400): TelegramWebAppUser | null {
  if (!initData || !botToken) return null;
  let params: URLSearchParams;
  try {
    params = new URLSearchParams(initData);
  } catch {
    return null;
  }
  const hash = params.get("hash");
  if (!hash) return null;
  params.delete("hash");

  const dataCheckString = Array.from(params.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => `${k}=${v}`)
    .join("\n");

  const secretKey = crypto.createHmac("sha256", "WebAppData").update(botToken).digest();
  const computedHash = crypto.createHmac("sha256", secretKey).update(dataCheckString).digest("hex");

  // Constant-time compare — this is a security-sensitive equality check.
  const a = Buffer.from(computedHash, "hex");
  const b = Buffer.from(hash, "hex");
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;

  const authDate = Number(params.get("auth_date") ?? 0);
  if (!authDate || Date.now() / 1000 - authDate > maxAgeSeconds) return null;

  const userRaw = params.get("user");
  if (!userRaw) return null;
  try {
    const user = JSON.parse(userRaw) as TelegramWebAppUser;
    if (!user?.id) return null;
    return user;
  } catch {
    return null;
  }
}
