// Shared by both Telegram entry points — POST /api/auth/telegram (Mini App
// launch) and the bot webhook's /start handler — so "first thing that sees
// this Telegram user creates the account" only has ONE implementation to
// drift. Both key on the same telegramId, so whichever happens first (the
// user opening the Mini App, or messaging the bot) creates it; the other
// just finds the same account afterward.
import crypto from "node:crypto";
import { getCollection } from "../mongo.ts";
import { hashPassword } from "./password.ts";
import type { UserDoc } from "../types.ts";

async function generateReferralCode(users: Awaited<ReturnType<typeof getCollection<UserDoc>>>): Promise<string> {
  for (let attempt = 0; attempt < 5; attempt++) {
    const code = crypto.randomUUID().replace(/-/g, "").slice(0, 8).toUpperCase();
    const exists = await users.findOne({ referralCode: code }, { projection: { _id: 1 } });
    if (!exists) return code;
  }
  throw new Error("Could not generate a referral code, please try again");
}

async function generateUsername(users: Awaited<ReturnType<typeof getCollection<UserDoc>>>, seed: string): Promise<string> {
  const base = seed.toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 16) || "user";
  for (let attempt = 0; attempt < 8; attempt++) {
    const candidate = attempt === 0 ? base : `${base}${Math.floor(1000 + Math.random() * 9000)}`;
    const exists = await users.findOne({ username: candidate }, { projection: { _id: 1 } });
    if (!exists) return candidate;
  }
  return `${base}${crypto.randomUUID().replace(/-/g, "").slice(0, 6)}`;
}

export type TelegramProfile = { id: number; first_name?: string; last_name?: string; username?: string };

/** Finds the account already tied to this Telegram user, or creates one —
 * synthetic email, random unusable password (this account only ever logs
 * in via Telegram either way in), same as any other TenOTP account
 * otherwise: same wallet, same orders, same everything. */
export async function findOrCreateTelegramUser(tg: TelegramProfile): Promise<UserDoc> {
  const users = await getCollection<UserDoc>("users");
  const telegramId = String(tg.id);
  const existing = await users.findOne({ telegramId });
  if (existing) return existing;

  const now = new Date();
  const email = `tg_${telegramId}@telegram.local`;
  const name = [tg.first_name, tg.last_name].filter(Boolean).join(" ").trim() || tg.username || `Telegram User ${telegramId}`;
  const doc: UserDoc = {
    _id: crypto.randomUUID(), email, emailLower: email.toLowerCase(),
    passwordHash: await hashPassword(crypto.randomUUID()),
    name, username: await generateUsername(users, telegramId),
    telegramId, referralCode: await generateReferralCode(users), referredBy: null, walletBalance: 0,
    status: "active", roles: ["user"], createdAt: now, updatedAt: now,
  };
  await users.insertOne(doc);
  return doc;
}
