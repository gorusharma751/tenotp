import { Router } from "express";
import { getCollection } from "../lib/mongo.ts";
import { hashPassword, verifyPassword } from "../lib/auth/password.ts";
import { signSessionToken } from "../lib/auth/jwt.ts";
import { verifyTelegramInitData } from "../lib/auth/telegram.ts";
import { checkAuthLimit, clientIpFrom } from "../lib/rateLimit.ts";
import { emailSchema, passwordSchema, nameSchema, referralCodeSchema } from "../lib/validation.ts";
import { toPublicUser, type UserDoc } from "../lib/types.ts";
import { requireAuth } from "../middleware/auth.ts";

export const authRouter = Router();

async function usersCollection() {
  return getCollection<UserDoc>("users");
}

async function gate(req: import("express").Request, action: "login" | "signup" | "password_reset", account?: string) {
  const ip = clientIpFrom(req as never);
  try {
    const res = await checkAuthLimit(action, ip, account ?? null);
    if (!res.allowed) {
      const wait = res.retryAfter > 60 ? `${Math.ceil(res.retryAfter / 60)} minute(s)` : `${res.retryAfter} second(s)`;
      throw new Error(`Too many attempts. Please try again in ${wait}.`);
    }
  } catch (e) {
    if (e instanceof Error && e.message.startsWith("Too many attempts")) throw e;
    console.error("[auth] rate-limit check failed", e);
  }
}

async function generateReferralCode(users: Awaited<ReturnType<typeof usersCollection>>): Promise<string> {
  for (let attempt = 0; attempt < 5; attempt++) {
    const code = crypto.randomUUID().replace(/-/g, "").slice(0, 8).toUpperCase();
    const exists = await users.findOne({ referralCode: code }, { projection: { _id: 1 } });
    if (!exists) return code;
  }
  throw new Error("Could not generate a referral code, please try again");
}

/** Every user gets a unique @handle at signup — shown on Manual Provider
 * profiles instead of their real name/email/phone. Seeded from the email
 * so it's recognizable to the user themselves, with a random numeric
 * suffix appended only on a collision. */
async function generateUsername(users: Awaited<ReturnType<typeof usersCollection>>, seed: string): Promise<string> {
  const base = seed.toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 16) || "user";
  for (let attempt = 0; attempt < 8; attempt++) {
    const candidate = attempt === 0 ? base : `${base}${Math.floor(1000 + Math.random() * 9000)}`;
    const exists = await users.findOne({ username: candidate }, { projection: { _id: 1 } });
    if (!exists) return candidate;
  }
  return `${base}${crypto.randomUUID().replace(/-/g, "").slice(0, 6)}`;
}

authRouter.post("/signup", async (req, res) => {
  try {
    const email = emailSchema.parse(req.body?.email);
    const password = passwordSchema.parse(req.body?.password);
    const name = req.body?.name ? nameSchema.parse(req.body.name) : email.split("@")[0];
    const referralCode = req.body?.referralCode ? referralCodeSchema.parse(req.body.referralCode) : undefined;
    await gate(req, "signup", email);

    const users = await usersCollection();
    const emailLower = email.toLowerCase();
    if (await users.findOne({ emailLower })) throw new Error("User already registered");

    let referredBy: string | null = null;
    if (referralCode) {
      const referrer = await users.findOne({ referralCode: referralCode.toUpperCase() });
      if (referrer) referredBy = referrer._id;
    }

    const passwordHash = await hashPassword(password);
    const now = new Date();
    const doc: UserDoc = {
      _id: crypto.randomUUID(), email, emailLower, passwordHash, name,
      username: await generateUsername(users, emailLower.split("@")[0]),
      referralCode: await generateReferralCode(users), referredBy, walletBalance: 0,
      status: "active", roles: ["user"], createdAt: now, updatedAt: now,
    };
    await users.insertOne(doc);

    if (referredBy) {
      const referrals = await getCollection("referrals");
      await referrals.insertOne({
        _id: crypto.randomUUID(), referrerId: referredBy, referredId: doc._id, percent: 10, totalEarned: 0, createdAt: now,
      } as never);
    }

    const token = signSessionToken({ sub: doc._id, email: doc.email, roles: doc.roles });
    res.json({ token, user: toPublicUser(doc) });
  } catch (err) {
    res.status(400).json({ error: err instanceof Error ? err.message : "Sign up failed" });
  }
});

authRouter.post("/signin", async (req, res) => {
  try {
    const email = emailSchema.parse(req.body?.email);
    const password = passwordSchema.parse(req.body?.password);
    await gate(req, "login", email);

    const users = await usersCollection();
    const doc = await users.findOne({ emailLower: email.toLowerCase() });
    if (!doc) throw new Error("Invalid login credentials");
    const ok = await verifyPassword(password, doc.passwordHash);
    if (!ok) throw new Error("Invalid login credentials");
    if (doc.status === "blocked") throw new Error("This account has been blocked. Contact support.");

    await users.updateOne({ _id: doc._id }, { $set: { lastLogin: new Date() } });
    const token = signSessionToken({ sub: doc._id, email: doc.email, roles: doc.roles });
    res.json({ token, user: toPublicUser(doc) });
  } catch (err) {
    res.status(400).json({ error: err instanceof Error ? err.message : "Sign in failed" });
  }
});

/** Telegram Mini App login — the ONLY way in is a fresh, signature-verified
 * `initData` string handed over by the Telegram client itself when the Mini
 * App launches (see lib/auth/telegram.ts). First launch creates an account
 * (synthetic email, random unusable password — this account only ever logs
 * in via Telegram), every launch after that finds it by telegramId and just
 * signs a normal session token. From here on it's the exact same account/
 * session/wallet/everything as the website — no separate Telegram-only data. */
authRouter.post("/telegram", async (req, res) => {
  try {
    const botToken = process.env.TELEGRAM_BOT_TOKEN;
    if (!botToken) throw new Error("Telegram login isn't configured on this server yet");
    const initData = String(req.body?.initData ?? "");
    const tgUser = verifyTelegramInitData(initData, botToken);
    if (!tgUser) throw new Error("Could not verify Telegram login — please relaunch the app");

    const users = await usersCollection();
    const telegramId = String(tgUser.id);
    let doc = await users.findOne({ telegramId });

    if (!doc) {
      const now = new Date();
      const email = `tg_${telegramId}@telegram.local`;
      const name = [tgUser.first_name, tgUser.last_name].filter(Boolean).join(" ").trim() || tgUser.username || `Telegram User ${telegramId}`;
      doc = {
        _id: crypto.randomUUID(), email, emailLower: email.toLowerCase(),
        passwordHash: await hashPassword(crypto.randomUUID()), // unusable — this account only ever logs in via Telegram
        name: nameSchema.safeParse(name).success ? name : `Telegram User ${telegramId}`,
        telegramId, referralCode: await generateReferralCode(users), referredBy: null, walletBalance: 0,
        status: "active", roles: ["user"], createdAt: now, updatedAt: now,
      };
      await users.insertOne(doc);
    } else if (doc.status === "blocked") {
      throw new Error("This account has been blocked. Contact support.");
    }

    await users.updateOne({ _id: doc._id }, { $set: { lastLogin: new Date() } });
    const token = signSessionToken({ sub: doc._id, email: doc.email, roles: doc.roles });
    res.json({ token, user: toPublicUser(doc) });
  } catch (err) {
    res.status(400).json({ error: err instanceof Error ? err.message : "Telegram login failed" });
  }
});

authRouter.get("/session", requireAuth, async (req, res) => {
  const users = await usersCollection();
  const doc = await users.findOne({ _id: req.auth.userId });
  if (!doc) return res.status(404).json({ error: "Not found" });
  res.json(toPublicUser(doc));
});

authRouter.post("/password-reset/request", async (req, res) => {
  try {
    const email = emailSchema.parse(req.body?.email);
    await gate(req, "password_reset", email);
    const users = await usersCollection();
    const doc = await users.findOne({ emailLower: email.toLowerCase() });
    if (!doc) return res.json({ ok: true }); // no user enumeration
    const { signPasswordResetToken } = await import("../lib/auth/jwt.ts");
    // Requesting a fresh link invalidates any earlier one for this user —
    // bump the version now, not just on confirm, so an old leaked/cached
    // reset email stops working the moment a newer one is requested.
    const nextVersion = (doc.passwordResetVersion ?? 0) + 1;
    await users.updateOne({ _id: doc._id }, { $set: { passwordResetVersion: nextVersion } });
    const token = signPasswordResetToken({ sub: doc._id, email: doc.email, roles: ["password_reset"] }, nextVersion);
    const { sendPasswordResetEmail } = await import("../lib/email.ts");
    const appUrl = process.env.APP_URL || "";
    await sendPasswordResetEmail({ to: doc.email, resetUrl: `${appUrl}/reset-password?token=${token}` });
    res.json({ ok: true });
  } catch (err) {
    res.status(400).json({ error: err instanceof Error ? err.message : "Failed" });
  }
});

authRouter.post("/password-reset/confirm", async (req, res) => {
  try {
    const newPassword = passwordSchema.parse(req.body?.newPassword);
    const { verifyPasswordResetToken, verifySessionToken } = await import("../lib/auth/jwt.ts");
    const users = await usersCollection();
    let userId: string | null = null;
    if (req.body?.resetToken) {
      // Single-use: the token's embedded resetVersion must still match the
      // user's current version. It won't if this exact link was already
      // used once (confirm below bumps the version on success) or if a
      // newer reset was requested since (request bumps it too) — either
      // way the token 400s here instead of quietly working again.
      const claims = verifyPasswordResetToken(String(req.body.resetToken));
      if (claims) {
        const doc = await users.findOne({ _id: claims.sub });
        if (doc && (doc.passwordResetVersion ?? 0) === claims.resetVersion) userId = claims.sub;
        else if (doc) throw new Error("This reset link was already used or has been superseded — request a new one");
      }
    }
    if (!userId) {
      const header = req.headers.authorization;
      if (header?.startsWith("Bearer ")) {
        const claims = verifySessionToken(header.slice(7).trim());
        if (claims) userId = claims.sub;
      }
    }
    if (!userId) throw new Error("Your session expired — please sign in again");
    const passwordHash = await hashPassword(newPassword);
    const doc = await users.findOne({ _id: userId });
    await users.updateOne(
      { _id: userId },
      { $set: { passwordHash, updatedAt: new Date(), passwordResetVersion: (doc?.passwordResetVersion ?? 0) + 1 } },
    );
    res.json({ ok: true });
  } catch (err) {
    res.status(400).json({ error: err instanceof Error ? err.message : "Failed" });
  }
});
