// Lets the bot act on a Telegram user's REAL TenOTP account by calling this
// same backend's own REST API — the exact endpoints the website itself
// calls (POST /api/otp/buy, /api/payments/paytm/create-qr, etc.) — instead
// of re-implementing pricing/upstream-provider/payment logic a second time
// inside the bot. Same account, same wallet, same money rules, zero drift.
import { signSessionToken } from "./auth/jwt.ts";

const SELF_BASE = `http://localhost:${process.env.PORT || 8787}`;

export class SelfApiError extends Error {}

export async function callSelfApi<T>(userId: string, roles: string[], method: "GET" | "POST" | "PATCH", path: string, body?: unknown): Promise<T> {
  const token = signSessionToken({ sub: userId, email: "", roles });
  const res = await fetch(`${SELF_BASE}${path}`, {
    method,
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new SelfApiError((json as { error?: string })?.error || `Request failed (${res.status})`);
  return json as T;
}
