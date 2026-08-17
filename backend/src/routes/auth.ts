import { Router } from "express";
import { getCollection } from "../lib/mongo.ts";
import { hashPassword, verifyPassword } from "../lib/auth/password.ts";
import { signSessionToken } from "../lib/auth/jwt.ts";
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
    const { signSessionToken: sign } = await import("../lib/auth/jwt.ts");
    const token = sign({ sub: doc._id, email: doc.email, roles: ["password_reset"] });
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
    const { verifySessionToken } = await import("../lib/auth/jwt.ts");
    let userId: string | null = null;
    if (req.body?.resetToken) {
      const claims = verifySessionToken(String(req.body.resetToken));
      if (claims?.roles.includes("password_reset")) userId = claims.sub;
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
    const users = await usersCollection();
    await users.updateOne({ _id: userId }, { $set: { passwordHash, updatedAt: new Date() } });
    res.json({ ok: true });
  } catch (err) {
    res.status(400).json({ error: err instanceof Error ? err.message : "Failed" });
  }
});
