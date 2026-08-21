// Bridges the same website into a Telegram Mini App — "jo kaam website me
// ho raha hai wahi Telegram me bhi ho". When this page is opened as a
// Telegram Mini App, `window.Telegram.WebApp.initData` is a fresh,
// Telegram-signed string identifying the user; POSTing it to
// /api/auth/telegram (server verifies the signature — see
// backend/src/lib/auth/telegram.ts) logs them into their TenOTP account
// (creating one on first launch) exactly like a normal signin, just with
// no email/password step. Outside Telegram, `window.Telegram` simply
// doesn't exist and every function here is a no-op.
import { api, setToken } from "@/lib/apiClient";
import type { User } from "@/types";

interface TelegramWebApp {
  initData: string;
  ready: () => void;
  expand: () => void;
  colorScheme: "light" | "dark";
  onEvent: (event: string, cb: () => void) => void;
}

declare global {
  interface Window {
    Telegram?: { WebApp?: TelegramWebApp };
  }
}

export function getTelegramWebApp(): TelegramWebApp | null {
  return window.Telegram?.WebApp ?? null;
}

export function isTelegramMiniApp(): boolean {
  const wa = getTelegramWebApp();
  return !!wa && !!wa.initData;
}

/** Logs into (or creates) the account tied to this Telegram user. Returns
 * the user on success, null if not actually running inside Telegram or the
 * login fails — callers fall back to the normal logged-out flow either way. */
export async function loginWithTelegram(): Promise<User | null> {
  const wa = getTelegramWebApp();
  if (!wa?.initData) return null;
  try {
    const res = await api.post<{ token: string; user: User }>("/api/auth/telegram", { initData: wa.initData });
    setToken(res.token);
    return res.user;
  } catch (error) {
    console.error("[telegram] login failed", error);
    return null;
  }
}

/** Call once on app boot, inside Telegram or not — makes the Mini App use
 * the full available height instead of a cramped half-sheet. No-op outside
 * Telegram. */
export function initTelegramWebApp() {
  const wa = getTelegramWebApp();
  if (!wa) return;
  wa.ready();
  wa.expand();
}
