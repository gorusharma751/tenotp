// User-facing referral routes — ported from src/api/referrals.ts's
// fetchReferralsFn (optionalAuth: admins see all, users see own) and
// fetchSettingsFn (public). The admin-only mutations (setPercent/setEnabled/
// remove) live in routes/admin.ts under /api/admin/referrals/* since
// admin.ts is entirely requireAdmin-guarded.
import { Router } from "express";
import { getCollection } from "../lib/mongo.ts";
import { optionalAuth } from "../middleware/auth.ts";
import type { UserDoc } from "../lib/types.ts";

export const referralsRouter = Router();

type ReferralDoc = {
  _id: string;
  referrerId: string;
  referredId: string;
  percent: number;
  totalEarned: number;
  createdAt: Date;
};

type ReferralSettingsDoc = {
  _id: "singleton";
  percent: number;
  minDeposit: number;
  enabled: boolean;
  updatedAt: Date;
};

referralsRouter.get("/", optionalAuth, async (req, res) => {
  try {
    if (!req.auth.userId) return res.json([]);
    const referrals = await getCollection<ReferralDoc>("referrals");
    // Mirrors the old Postgres RLS: admins see every row, regular users see
    // only referrals where they are the referrer.
    const filter = req.auth.roles.includes("admin") ? {} : { referrerId: req.auth.userId };
    const rows = await referrals.find(filter).sort({ createdAt: -1 }).toArray();
    const ids = Array.from(new Set(rows.flatMap((x) => [x.referrerId, x.referredId])));
    const users = await getCollection<UserDoc>("users");
    const userRows = ids.length ? await users.find({ _id: { $in: ids } }, { projection: { email: 1 } }).toArray() : [];
    const byId = new Map(userRows.map((u) => [u._id, u.email]));
    res.json(
      rows.map((x) => ({
        id: x._id,
        referrerId: x.referrerId,
        referrerEmail: byId.get(x.referrerId),
        refereeEmail: byId.get(x.referredId) ?? "—",
        earned: Number(x.totalEarned ?? 0),
        status: Number(x.totalEarned ?? 0) > 0 ? "active" : "pending",
        joinedAt: x.createdAt.toISOString(),
      })),
    );
  } catch (err) {
    res.status(400).json({ error: err instanceof Error ? err.message : "Failed to load referrals" });
  }
});

referralsRouter.get("/settings", async (_req, res) => {
  try {
    const settings = await getCollection<ReferralSettingsDoc>("referral_settings");
    const doc = await settings.findOne({ _id: "singleton" });
    res.json({ percent: Number(doc?.percent ?? 10), enabled: doc?.enabled ?? true });
  } catch (err) {
    res.status(400).json({ error: err instanceof Error ? err.message : "Failed to load referral settings" });
  }
});
