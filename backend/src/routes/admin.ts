// Admin REST routes — ported from src/lib/admin-manage.functions.ts,
// src/lib/admin-wallet.functions.ts, src/lib/reseller.functions.ts,
// src/api/index.ts (adminApi + promotionsApi), src/api/orderManagement.ts
// and the admin-only parts of src/api/referrals.ts.
// Business logic is copied near-verbatim from the already-Mongo-converted
// TanStack createServerFn handlers; only the framework glue changed.
import { Router } from "express";
import { getCollection } from "../lib/mongo.ts";
import { requireAdmin } from "../middleware/auth.ts";
import { hashPassword } from "../lib/auth/password.ts";
import type { UserDoc } from "../lib/types.ts";
import type { OrderDoc } from "../lib/db/wallet.ts";
import {
  setWalletFrozen as setFrozen,
  adminUpdateProfile,
  adminAdjustWallet,
  adjustResellerWallet as adjustResellerWalletTx,
} from "../lib/db/wallet.ts";

export const adminRouter = Router();
adminRouter.use(requireAdmin);

function fail(res: import("express").Response, err: unknown, code = 400) {
  res.status(code).json({ error: err instanceof Error ? err.message : "Request failed" });
}

// =====================================================================
// admin-manage.functions.ts — wallet freeze, admin role grant/revoke,
// permissions, profile edit, password reset, reseller creation, service update
// =====================================================================

adminRouter.post("/wallet/freeze", async (req, res) => {
  try {
    const { user_id, frozen } = req.body ?? {};
    if (!user_id) throw new Error("user_id required");
    const status = await setFrozen(String(user_id), Boolean(frozen));
    res.json({ status });
  } catch (err) {
    fail(res, err);
  }
});

export type AdminRoleName = "admin" | "sub_admin";
export type AdminRow = {
  user_id: string;
  email: string;
  name: string | null;
  role: AdminRoleName;
  created_at: string;
};

adminRouter.get("/admins", async (_req, res) => {
  try {
    const users = await getCollection<UserDoc>("users");
    const rows = await users.find({ roles: { $in: ["admin", "sub_admin"] } }).toArray();
    const out: AdminRow[] = [];
    for (const u of rows) {
      for (const role of u.roles) {
        if (role === "admin" || role === "sub_admin") {
          out.push({
            user_id: u._id,
            email: u.email ?? "—",
            name: u.name ?? null,
            role: role as AdminRoleName,
            created_at: u.createdAt.toISOString(),
          });
        }
      }
    }
    res.json(out);
  } catch (err) {
    fail(res, err);
  }
});

adminRouter.post("/admins/grant", async (req, res) => {
  try {
    const { email, role } = req.body ?? {};
    if (!email || !role) throw new Error("email and role required");
    const users = await getCollection<UserDoc>("users");
    const user = await users.findOne({ emailLower: String(email).trim().toLowerCase() });
    if (!user) throw new Error("No user with that email — they must sign up first");
    await users.updateOne({ _id: user._id }, { $addToSet: { roles: role } });
    res.json({ ok: true });
  } catch (err) {
    fail(res, err);
  }
});

adminRouter.post("/admins/revoke", async (req, res) => {
  try {
    const { user_id, role } = req.body ?? {};
    if (!user_id || !role) throw new Error("user_id and role required");
    const users = await getCollection<UserDoc>("users");
    const result = await users.updateOne({ _id: String(user_id) }, { $pull: { roles: role } });
    if (result.matchedCount === 0) throw new Error("User not found");
    res.json({ ok: true });
  } catch (err) {
    fail(res, err);
  }
});

adminRouter.post("/users/:id/role", async (req, res) => {
  try {
    const { role, add } = req.body ?? {};
    if (!role) throw new Error("role required");
    const users = await getCollection<UserDoc>("users");
    const result = await users.updateOne(
      { _id: req.params.id },
      add ? { $addToSet: { roles: role } } : { $pull: { roles: role } },
    );
    if (result.matchedCount === 0) throw new Error("User not found");
    res.json({ ok: true });
  } catch (err) {
    fail(res, err);
  }
});

type PermissionDoc = {
  _id: string;
  userId: string;
  permissionKey: string;
  allowed: boolean;
  createdAt: Date;
  updatedAt: Date;
};

adminRouter.post("/users/:id/permissions", async (req, res) => {
  try {
    const { key, allowed } = req.body ?? {};
    if (!key) throw new Error("key required");
    const perms = await getCollection<PermissionDoc>("admin_permissions");
    const now = new Date();
    await perms.updateOne(
      { userId: req.params.id, permissionKey: key },
      {
        $set: { allowed: Boolean(allowed), updatedAt: now },
        $setOnInsert: { _id: crypto.randomUUID(), userId: req.params.id, permissionKey: key, createdAt: now },
      },
      { upsert: true },
    );
    res.json({ ok: true });
  } catch (err) {
    fail(res, err);
  }
});

adminRouter.get("/users/:id/permissions", async (req, res) => {
  try {
    const perms = await getCollection<PermissionDoc>("admin_permissions");
    const rows = await perms.find({ userId: req.params.id }).toArray();
    res.json(rows.map((r) => ({ permission_key: r.permissionKey, allowed: r.allowed })));
  } catch (err) {
    fail(res, err);
  }
});

adminRouter.post("/users/:id/profile", async (req, res) => {
  try {
    const { name, email, phone, status, wallet_balance } = req.body ?? {};
    await adminUpdateProfile(req.params.id, {
      name,
      email,
      phone,
      status,
      walletBalance: wallet_balance,
    });
    res.json({ ok: true });
  } catch (err) {
    fail(res, err);
  }
});

adminRouter.post("/users/:id/reset-password", async (req, res) => {
  try {
    const newPassword = String(req.body?.new_password ?? "");
    if (!newPassword || newPassword.length < 8) throw new Error("Password must be ≥ 8 chars");
    const users = await getCollection<UserDoc>("users");
    const passwordHash = await hashPassword(newPassword);
    const result = await users.updateOne(
      { _id: req.params.id },
      { $set: { passwordHash, updatedAt: new Date() } },
    );
    if (result.matchedCount === 0) throw new Error("User not found");
    res.json({ ok: true });
  } catch (err) {
    fail(res, err);
  }
});

adminRouter.post("/resellers", async (req, res) => {
  try {
    const { email, password, name, slug, markup } = req.body ?? {};
    if (!email || !password || String(password).length < 6) throw new Error("Email + password (≥6) required");
    if (!name || !slug) throw new Error("Panel name + slug required");

    const users = await getCollection<UserDoc>("users");
    const emailLower = String(email).trim().toLowerCase();
    const passwordHash = await hashPassword(String(password));

    let userId: string;
    const existing = await users.findOne({ emailLower });
    if (existing) {
      userId = existing._id;
      await users.updateOne({ _id: userId }, { $set: { passwordHash, updatedAt: new Date() } });
    } else {
      userId = crypto.randomUUID();
      const now = new Date();
      await users.insertOne({
        _id: userId,
        email: String(email).trim(),
        emailLower,
        passwordHash,
        name: String(name),
        referralCode: crypto.randomUUID().replace(/-/g, "").slice(0, 8).toUpperCase(),
        referredBy: null,
        walletBalance: 0,
        status: "active",
        roles: ["user"],
        createdAt: now,
        updatedAt: now,
      });
    }

    const cleanSlug = String(slug)
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9-]+/g, "-")
      .replace(/^-+|-+$/g, "");
    if (!cleanSlug) throw new Error("Invalid slug");

    const panels = await getCollection<{ _id: string; slug: string }>("reseller_panels");
    if (await panels.findOne({ slug: cleanSlug })) throw new Error("That slug is already taken");
    const panelId = crypto.randomUUID();
    const now = new Date();
    await panels.insertOne({
      _id: panelId,
      ownerUserId: userId,
      name: String(name).trim(),
      slug: cleanSlug,
      markupPercent: Number(markup) || 20,
      walletBalance: 0,
      status: "active",
      branding: {},
      createdAt: now,
      updatedAt: now,
    } as never);

    await users.updateOne(
      { _id: userId },
      { $addToSet: { roles: "reseller" }, $set: { resellerPanelId: panelId, updatedAt: now } },
    );

    res.json({ id: panelId, user_id: userId, email });
  } catch (err) {
    fail(res, err);
  }
});

adminRouter.patch("/services/:id", async (req, res) => {
  try {
    const data = req.body ?? {};
    const patch: Record<string, unknown> = {};
    const fieldMap: Record<string, string> = {
      name: "name",
      icon: "icon",
      category: "category",
      base_price: "price",
      markup_type: "markupType",
      markup_value: "markupValue",
      enabled_servers: "enabledServers",
      enabled: "enabled",
      active: "active",
    };
    for (const [inputKey, dbKey] of Object.entries(fieldMap)) {
      const v = data[inputKey];
      if (v !== undefined) patch[dbKey] = v;
    }
    const services = await getCollection("services");
    const result = await services.updateOne({ _id: req.params.id } as never, { $set: patch });
    if (result.matchedCount === 0) throw new Error("Service not found");
    res.json({ ok: true });
  } catch (err) {
    fail(res, err);
  }
});

// =====================================================================
// admin-wallet.functions.ts — wallet balance adjustment
// =====================================================================

adminRouter.post("/wallet/adjust", async (req, res) => {
  try {
    const body = req.body ?? {};
    if (!body.user_id) throw new Error("user_id required");
    const amt = Number(body.amount);
    if (!Number.isFinite(amt) || amt <= 0) throw new Error("Amount must be > 0");
    if (body.direction !== "credit" && body.direction !== "debit") throw new Error("Invalid direction");
    const note = String(body.note ?? "").slice(0, 200);
    const newBalance = await adminAdjustWallet(String(body.user_id), amt, body.direction, note);
    res.json({ new_balance: newBalance });
  } catch (err) {
    fail(res, err);
  }
});

// =====================================================================
// reseller.functions.ts — reseller panel CRUD, contact links settings
// =====================================================================

export interface ResellerPanelDto {
  id: string;
  owner_user_id: string;
  name: string;
  slug: string;
  markup_percent: number;
  wallet_balance: number;
  status: string;
  branding_json: string;
  created_at: string;
  owner_email?: string;
  users_count?: number;
}

type ResellerPanelDoc = {
  _id: string;
  ownerUserId: string;
  name: string;
  slug: string;
  markupPercent: number;
  walletBalance: number;
  status: string;
  branding: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
};

type AppSettingDoc = {
  _id: string;
  value: unknown;
  updatedAt: Date;
  updatedBy?: string | null;
};

adminRouter.get("/reseller-panels", async (_req, res) => {
  try {
    const panelsCol = await getCollection<ResellerPanelDoc>("reseller_panels");
    const panels = await panelsCol.find({}).sort({ createdAt: -1 }).toArray();

    const ownerIds = panels.map((p) => p.ownerUserId);
    const usersCol = await getCollection<UserDoc>("users");
    const owners = ownerIds.length ? await usersCol.find({ _id: { $in: ownerIds } }).toArray() : [];
    const emailById = new Map(owners.map((u) => [u._id, u.email]));

    const countMap = new Map<string, number>();
    if (panels.length) {
      const withPanel = await usersCol
        .find({ resellerPanelId: { $in: panels.map((p) => p._id) } })
        .toArray();
      for (const u of withPanel) {
        const k = u.resellerPanelId as string;
        countMap.set(k, (countMap.get(k) ?? 0) + 1);
      }
    }

    const out: ResellerPanelDto[] = panels.map((p) => ({
      id: p._id,
      owner_user_id: p.ownerUserId,
      name: p.name,
      slug: p.slug,
      markup_percent: Number(p.markupPercent),
      wallet_balance: Number(p.walletBalance),
      status: p.status,
      branding_json: JSON.stringify(p.branding ?? {}),
      created_at: p.createdAt.toISOString(),
      owner_email: emailById.get(p.ownerUserId) ?? undefined,
      users_count: countMap.get(p._id) ?? 0,
    }));
    res.json(out);
  } catch (err) {
    fail(res, err);
  }
});

adminRouter.post("/reseller-panels", async (req, res) => {
  try {
    const { ownerEmail, name, slug, markup } = req.body ?? {};
    const usersCol = await getCollection<UserDoc>("users");
    const user = await usersCol.findOne({ emailLower: String(ownerEmail ?? "").trim().toLowerCase() });
    if (!user) throw new Error(`No user with email ${ownerEmail}`);
    const cleanSlug = String(slug ?? "")
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9-]+/g, "-")
      .replace(/^-+|-+$/g, "");
    if (!cleanSlug) throw new Error("Invalid slug");

    const panelsCol = await getCollection<ResellerPanelDoc>("reseller_panels");
    if (await panelsCol.findOne({ slug: cleanSlug })) throw new Error("That slug is already taken");

    const now = new Date();
    const panelId = crypto.randomUUID();
    await panelsCol.insertOne({
      _id: panelId,
      ownerUserId: user._id,
      name: String(name).trim(),
      slug: cleanSlug,
      markupPercent: Number(markup) || 20,
      walletBalance: 0,
      status: "active",
      branding: {},
      createdAt: now,
      updatedAt: now,
    });

    await usersCol.updateOne(
      { _id: user._id },
      { $addToSet: { roles: "reseller" }, $set: { resellerPanelId: panelId, updatedAt: now } },
    );

    res.json({ id: panelId });
  } catch (err) {
    fail(res, err);
  }
});

adminRouter.patch("/reseller-panels/:id", async (req, res) => {
  try {
    const { markup, name, status, branding } = req.body ?? {};
    const patch: Record<string, unknown> = { updatedAt: new Date() };
    if (markup !== undefined) patch.markupPercent = Number(markup);
    if (name !== undefined) patch.name = String(name).trim();
    if (status !== undefined) {
      if (status !== "active" && status !== "suspended") throw new Error("Status must be active or suspended");
      patch.status = status;
    }
    if (branding !== undefined && branding !== null && typeof branding === "object") {
      const b = branding as Record<string, unknown>;
      patch.branding = {
        logoUrl: String(b.logoUrl ?? "").trim().slice(0, 500),
        primaryColor: String(b.primaryColor ?? "").trim().slice(0, 20),
        supportContact: String(b.supportContact ?? "").trim().slice(0, 200),
      };
    }
    const panelsCol = await getCollection<ResellerPanelDoc>("reseller_panels");
    const result = await panelsCol.updateOne({ _id: req.params.id }, { $set: patch });
    if (result.matchedCount === 0) throw new Error("Reseller panel not found");
    res.json({ ok: true });
  } catch (err) {
    fail(res, err);
  }
});

adminRouter.post("/reseller-panels/:id/wallet", async (req, res) => {
  try {
    const { amount, note } = req.body ?? {};
    const newBalance = await adjustResellerWalletTx(req.params.id, Number(amount), note ?? "");
    res.json({ balance: Number(newBalance) });
  } catch (err) {
    fail(res, err);
  }
});

adminRouter.delete("/reseller-panels/:id", async (req, res) => {
  try {
    const panelsCol = await getCollection<ResellerPanelDoc>("reseller_panels");
    const result = await panelsCol.deleteOne({ _id: req.params.id });
    if (result.deletedCount === 0) throw new Error("Reseller panel not found");
    // Detach every member so a stale resellerPanelId never silently keeps
    // applying a deleted panel's markup on future purchases.
    const usersCol = await getCollection<UserDoc>("users");
    await usersCol.updateMany({ resellerPanelId: req.params.id }, { $set: { resellerPanelId: null, updatedAt: new Date() } });
    res.json({ ok: true });
  } catch (err) {
    fail(res, err);
  }
});

/** Panel detail — same shape as one row of GET /reseller-panels, for a detail view. */
adminRouter.get("/reseller-panels/:id", async (req, res) => {
  try {
    const panelsCol = await getCollection<ResellerPanelDoc>("reseller_panels");
    const p = await panelsCol.findOne({ _id: req.params.id });
    if (!p) throw new Error("Reseller panel not found");
    const usersCol = await getCollection<UserDoc>("users");
    const owner = await usersCol.findOne({ _id: p.ownerUserId });
    const membersCount = await usersCol.countDocuments({ resellerPanelId: p._id });
    const out: ResellerPanelDto = {
      id: p._id, owner_user_id: p.ownerUserId, name: p.name, slug: p.slug,
      markup_percent: Number(p.markupPercent), wallet_balance: Number(p.walletBalance), status: p.status,
      branding_json: JSON.stringify(p.branding ?? {}), created_at: p.createdAt.toISOString(),
      owner_email: owner?.email, users_count: membersCount,
    };
    res.json(out);
  } catch (err) {
    fail(res, err);
  }
});

/** Every user tagged to this panel (the owner plus anyone an admin has assigned as a member). */
adminRouter.get("/reseller-panels/:id/members", async (req, res) => {
  try {
    const panelsCol = await getCollection<ResellerPanelDoc>("reseller_panels");
    const panel = await panelsCol.findOne({ _id: req.params.id });
    if (!panel) throw new Error("Reseller panel not found");
    const usersCol = await getCollection<UserDoc>("users");
    const members = await usersCol.find({ resellerPanelId: req.params.id }).sort({ createdAt: -1 }).toArray();
    res.json(
      members.map((u) => ({
        id: u._id, name: u.name, email: u.email, wallet_balance: Number(u.walletBalance ?? 0),
        is_owner: u._id === panel.ownerUserId, joined_at: (u.updatedAt ?? u.createdAt).toISOString(),
      })),
    );
  } catch (err) {
    fail(res, err);
  }
});

/** Tags an existing user as a member of this panel — their future purchases
 * are then charged at the panel's markup, with the margin credited to the
 * panel's wallet as commission (see routes/otp.ts POST /buy). Doesn't touch
 * roles: only the panel owner needs the "reseller" role. */
adminRouter.post("/reseller-panels/:id/members", async (req, res) => {
  try {
    const panelsCol = await getCollection<ResellerPanelDoc>("reseller_panels");
    const panel = await panelsCol.findOne({ _id: req.params.id });
    if (!panel) throw new Error("Reseller panel not found");
    const email = String(req.body?.email ?? "").trim().toLowerCase();
    if (!email) throw new Error("Email required");
    const usersCol = await getCollection<UserDoc>("users");
    const user = await usersCol.findOne({ emailLower: email });
    if (!user) throw new Error(`No user with email ${email}`);
    if (user.resellerPanelId && user.resellerPanelId !== panel._id) {
      throw new Error("That user already belongs to a different reseller panel");
    }
    await usersCol.updateOne({ _id: user._id }, { $set: { resellerPanelId: panel._id, updatedAt: new Date() } });
    res.json({ ok: true });
  } catch (err) {
    fail(res, err);
  }
});

adminRouter.delete("/reseller-panels/:id/members/:userId", async (req, res) => {
  try {
    const panelsCol = await getCollection<ResellerPanelDoc>("reseller_panels");
    const panel = await panelsCol.findOne({ _id: req.params.id });
    if (!panel) throw new Error("Reseller panel not found");
    if (panel.ownerUserId === req.params.userId) {
      throw new Error("Can't remove the panel owner — delete the panel instead");
    }
    const usersCol = await getCollection<UserDoc>("users");
    const result = await usersCol.updateOne(
      { _id: req.params.userId, resellerPanelId: req.params.id },
      { $set: { resellerPanelId: null, updatedAt: new Date() } },
    );
    if (result.matchedCount === 0) throw new Error("User is not a member of this panel");
    res.json({ ok: true });
  } catch (err) {
    fail(res, err);
  }
});

/** Wallet transaction history for a panel — deposits/deductions the admin
 * made plus reseller commission credits from members' purchases. */
adminRouter.get("/reseller-panels/:id/ledger", async (req, res) => {
  try {
    const ledger = await getCollection<{
      _id: string; panelId: string; type: "credit" | "debit"; amount: number;
      balanceAfter: number; note: string | null; createdAt: Date;
    }>("reseller_wallet_tx");
    const rows = await ledger.find({ panelId: req.params.id }).sort({ createdAt: -1 }).limit(200).toArray();
    res.json(
      rows.map((r) => ({
        id: r._id, type: r.type, amount: Number(r.amount), balance_after: Number(r.balanceAfter),
        note: r.note, created_at: r.createdAt.toISOString(),
      })),
    );
  } catch (err) {
    fail(res, err);
  }
});

adminRouter.post("/contact-links", async (req, res) => {
  try {
    const data = req.body ?? {};
    const rows: Array<{ key: string; value: string }> = [
      { key: "telegram_group_url", value: String(data.telegramGroup ?? "") },
      { key: "telegram_support_url", value: String(data.telegramSupport ?? "") },
      { key: "whatsapp_url", value: String(data.whatsapp ?? "") },
    ];
    if (data.announcementTitle !== undefined)
      rows.push({ key: "telegram_announcement_title", value: String(data.announcementTitle) });
    if (data.announcementText !== undefined)
      rows.push({ key: "telegram_announcement_text", value: String(data.announcementText) });
    if (data.bumpVersion) rows.push({ key: "telegram_announcement_version", value: String(Date.now()) });

    const settingsCol = await getCollection<AppSettingDoc>("app_settings");
    const now = new Date();
    for (const r of rows) {
      await settingsCol.updateOne(
        { _id: r.key },
        { $set: { value: r.value, updatedAt: now, updatedBy: req.auth.userId } },
        { upsert: true },
      );
    }
    res.json({ ok: true });
  } catch (err) {
    fail(res, err);
  }
});

adminRouter.get("/contact-links", async (_req, res) => {
  try {
    const settingsCol = await getCollection<AppSettingDoc>("app_settings");
    const keys = [
      "telegram_group_url",
      "telegram_support_url",
      "whatsapp_url",
      "telegram_announcement_title",
      "telegram_announcement_text",
      "telegram_announcement_version",
    ];
    const rows = await settingsCol.find({ _id: { $in: keys } }).toArray();
    const map = new Map<string, unknown>(rows.map((r) => [r._id, r.value]));
    const val = (k: string) => (typeof map.get(k) === "string" ? (map.get(k) as string) : "");
    res.json({
      telegramGroup: val("telegram_group_url"),
      telegramSupport: val("telegram_support_url"),
      whatsapp: val("whatsapp_url"),
      announcementTitle: val("telegram_announcement_title"),
      announcementText: val("telegram_announcement_text"),
      announcementVersion: val("telegram_announcement_version"),
    });
  } catch (err) {
    fail(res, err);
  }
});

// =====================================================================
// api/referrals.ts — admin-only referral settings + removal
// (fetchReferrals / fetchSettings live in routes/referrals.ts since they
// are optionalAuth / public, not admin-only — see report)
// =====================================================================

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

adminRouter.post("/referrals/percent", async (req, res) => {
  try {
    const percent = Number(req.body?.percent);
    const settings = await getCollection<ReferralSettingsDoc>("referral_settings");
    await settings.updateOne(
      { _id: "singleton" },
      { $set: { percent, updatedAt: new Date() }, $setOnInsert: { enabled: true, minDeposit: 0 } },
      { upsert: true },
    );
    res.json({ ok: true });
  } catch (err) {
    fail(res, err);
  }
});

adminRouter.post("/referrals/enabled", async (req, res) => {
  try {
    const enabled = Boolean(req.body?.enabled);
    const settings = await getCollection<ReferralSettingsDoc>("referral_settings");
    await settings.updateOne(
      { _id: "singleton" },
      { $set: { enabled, updatedAt: new Date() }, $setOnInsert: { percent: 10, minDeposit: 0 } },
      { upsert: true },
    );
    res.json({ ok: true });
  } catch (err) {
    fail(res, err);
  }
});

adminRouter.delete("/referrals/:id", async (req, res) => {
  try {
    const referrals = await getCollection<ReferralDoc>("referrals");
    await referrals.deleteOne({ _id: req.params.id });
    res.json({ ok: true });
  } catch (err) {
    fail(res, err);
  }
});

// =====================================================================
// api/index.ts — adminApi (users/countries/services/numbers/orders/wallets/
// payments/refunds/coupons/promotions/roles/permissions/audit/media/
// notifications/tickets/rentals/analytics)
// =====================================================================

async function col<T extends import("mongodb").Document = import("mongodb").Document>(name: string) {
  return getCollection<T>(name);
}

function mapOrder(o: OrderDoc) {
  return {
    id: o._id,
    service: o.serviceName ?? o.serviceId ?? "",
    country: o.countryName ?? o.countryCode ?? "",
    number: o.number,
    status: o.status,
    otp: o.otp ?? undefined,
    price: Number(o.price),
    createdAt: o.createdAt.toISOString(),
    expiresAt: o.expiresAt ? o.expiresAt.toISOString() : "",
  };
}

async function countCollection(name: string): Promise<number> {
  const c = await col(name);
  return c.countDocuments();
}
async function sumWallet(): Promise<number> {
  const users = await col<UserDoc>("users");
  const rows = await users.find({}, { projection: { walletBalance: 1 } }).toArray();
  return rows.reduce((s, x) => s + Number(x.walletBalance ?? 0), 0);
}

adminRouter.get("/users", async (_req, res) => {
  try {
    const users = await col<UserDoc>("users");
    const rows = await users.find({}).sort({ createdAt: -1 }).toArray();
    res.json(
      rows.map((p) => ({
        id: p._id,
        name: p.name ?? "—",
        email: p.email ?? "—",
        country: p.country ?? "",
        role: p.roles.includes("admin") ? "admin" : p.roles.includes("reseller") ? "reseller" : "user",
        status: p.status ?? "active",
        wallet: Number(p.walletBalance ?? 0),
        orders: 0,
        referral: p.referredBy ?? undefined,
        createdAt: p.createdAt.toISOString(),
        lastLogin: (p.lastLogin ?? p.createdAt).toISOString(),
      })),
    );
  } catch (err) {
    fail(res, err);
  }
});

adminRouter.get("/users/:id", async (req, res) => {
  try {
    const users = await col<UserDoc>("users");
    const p = await users.findOne({ _id: req.params.id });
    if (!p) return res.json(null);
    res.json({
      id: p._id,
      name: p.name ?? "—",
      email: p.email ?? "—",
      country: p.country ?? "",
      role: p.roles.includes("admin") ? "admin" : p.roles.includes("reseller") ? "reseller" : "user",
      status: p.status ?? "active",
      wallet: Number(p.walletBalance ?? 0),
      orders: 0,
      referral: p.referredBy ?? undefined,
      createdAt: p.createdAt.toISOString(),
      lastLogin: (p.lastLogin ?? p.createdAt).toISOString(),
    });
  } catch (err) {
    fail(res, err);
  }
});

// A specific user's full wallet ledger (deposits, purchases, refunds,
// bonuses, admin adjustments) — the user-facing GET /api/wallet/transactions
// equivalent, for the admin User detail page's Wallet tab.
adminRouter.get("/users/:id/wallet-transactions", async (req, res) => {
  try {
    const tx = await col<{
      _id: string; userId: string; type: string; amount: number; balanceAfter: number | null;
      method?: string | null; note?: string | null; referenceId?: string | null; createdAt: Date;
    }>("wallet_tx");
    const rows = await tx.find({ userId: req.params.id }).sort({ createdAt: -1 }).limit(300).toArray();
    res.json(
      rows.map((x) => ({
        id: x._id,
        type: x.type,
        amount: Number(x.amount),
        balanceAfter: x.balanceAfter != null ? Number(x.balanceAfter) : null,
        method: x.method ?? "",
        note: x.note ?? "",
        referenceId: x.referenceId ?? "",
        createdAt: x.createdAt.toISOString(),
      })),
    );
  } catch (err) {
    fail(res, err);
  }
});

adminRouter.get("/countries", async (_req, res) => {
  try {
    const c = await col<{
      _id: string; name: string; flag?: string; numbersAvailable: number; priceFrom: number;
      enabled: boolean; operators: number; priority: number;
    }>("countries");
    const rows = await c.find({}).sort({ priority: 1 }).toArray();
    res.json(
      rows.map((r) => ({
        code: r._id, name: r.name, flag: r.flag ?? "", numbersAvailable: r.numbersAvailable,
        priceFrom: Number(r.priceFrom), enabled: r.enabled, operators: r.operators, priority: r.priority,
      })),
    );
  } catch (err) {
    fail(res, err);
  }
});

adminRouter.get("/countries/:code", async (req, res) => {
  try {
    const c = await col<{
      _id: string; name: string; flag?: string; numbersAvailable: number; priceFrom: number;
      enabled: boolean; operators: number; priority: number;
    }>("countries");
    const r = await c.findOne({ _id: req.params.code });
    if (!r) return res.json(null);
    res.json({
      code: r._id, name: r.name, flag: r.flag ?? "", numbersAvailable: r.numbersAvailable,
      priceFrom: Number(r.priceFrom), enabled: r.enabled, operators: r.operators, priority: r.priority,
    });
  } catch (err) {
    fail(res, err);
  }
});

adminRouter.get("/services", async (_req, res) => {
  try {
    const s = await col<{
      _id: string; name: string; icon?: string; category?: string; price: number;
      successRate: number; enabled: boolean; countries: number; orders: number;
    }>("services");
    const rows = await s.find({}).sort({ name: 1 }).toArray();
    res.json(
      rows.map((r) => ({
        id: r._id, name: r.name, icon: r.icon ?? "", category: r.category ?? "", price: Number(r.price),
        successRate: r.successRate, enabled: r.enabled, countries: r.countries, orders: r.orders,
      })),
    );
  } catch (err) {
    fail(res, err);
  }
});

adminRouter.get("/services/:id", async (req, res) => {
  try {
    const s = await col<{
      _id: string; name: string; icon?: string; category?: string; price: number;
      successRate: number; enabled: boolean; countries: number; orders: number;
    }>("services");
    const r = await s.findOne({ _id: req.params.id });
    if (!r) return res.json(null);
    res.json({
      id: r._id, name: r.name, icon: r.icon ?? "", category: r.category ?? "", price: Number(r.price),
      successRate: r.successRate, enabled: r.enabled, countries: r.countries, orders: r.orders,
    });
  } catch (err) {
    fail(res, err);
  }
});

adminRouter.get("/numbers", async (_req, res) => {
  try {
    const n = await col<{
      _id: string; number: string; countryCode?: string; serviceId?: string; operator?: string;
      status: string; assignedTo?: string; addedAt: Date;
    }>("numbers_inventory");
    const rows = await n.find({}).sort({ addedAt: -1 }).toArray();
    res.json(
      rows.map((x) => ({
        id: x._id, number: x.number, countryCode: x.countryCode ?? "", service: x.serviceId ?? "",
        operator: x.operator ?? "", status: x.status, assignedTo: x.assignedTo ?? undefined,
        addedAt: x.addedAt.toISOString(),
      })),
    );
  } catch (err) {
    fail(res, err);
  }
});

adminRouter.get("/orders", async (_req, res) => {
  try {
    const orders = await col<OrderDoc>("orders");
    const rows = await orders.find({}).sort({ createdAt: -1 }).toArray();
    const users = await col<UserDoc>("users");
    const userRows = await users.find({}, { projection: { name: 1, email: 1 } }).toArray();
    const byId = new Map(userRows.map((u) => [u._id, u]));
    res.json(
      rows.map((o) => {
        const u = byId.get(o.userId);
        return { ...mapOrder(o), user: u?.name ?? u?.email ?? "—", userId: o.userId, operator: o.operator ?? "" };
      }),
    );
  } catch (err) {
    fail(res, err);
  }
});

adminRouter.get("/orders/:id", async (req, res) => {
  try {
    const orders = await col<OrderDoc>("orders");
    const o = await orders.findOne({ _id: req.params.id });
    if (!o) return res.json(null);
    const users = await col<UserDoc>("users");
    const u = await users.findOne({ _id: o.userId });
    res.json({ ...mapOrder(o), user: u?.name ?? u?.email ?? "—", userId: o.userId, operator: o.operator ?? "" });
  } catch (err) {
    fail(res, err);
  }
});

adminRouter.get("/wallets", async (_req, res) => {
  try {
    const users = await col<UserDoc>("users");
    const rows = await users.find({}).toArray();
    res.json(
      rows.map((p) => ({
        userId: p._id, user: p.name ?? "—", email: p.email ?? "—", balance: Number(p.walletBalance ?? 0),
        lifetime: Number(p.walletBalance ?? 0), frozen: p.status === "frozen", updatedAt: p.updatedAt.toISOString(),
      })),
    );
  } catch (err) {
    fail(res, err);
  }
});

adminRouter.get("/payments", async (_req, res) => {
  try {
    const payments = await col<{
      _id: string; userId: string; method: string; amount: number; status: string; reference?: string; createdAt: Date;
    }>("payments");
    const rows = await payments.find({}).sort({ createdAt: -1 }).toArray();
    const users = await col<UserDoc>("users");
    const userRows = await users.find({}, { projection: { name: 1 } }).toArray();
    const byId = new Map(userRows.map((u) => [u._id, u]));
    res.json(
      rows.map((p) => ({
        id: p._id, user: byId.get(p.userId)?.name ?? "—", userId: p.userId, method: p.method,
        amount: Number(p.amount), status: p.status, reference: p.reference ?? "", createdAt: p.createdAt.toISOString(),
      })),
    );
  } catch (err) {
    fail(res, err);
  }
});

// Deposits stuck in "pending" — the manual-review fallback when a QR
// payment's auto-verify (BharatPe transaction match, Paytm order status)
// didn't confirm it in time. The admin re-checks (e.g. against the BharatPe
// Settings page's live transaction list) and approves/rejects here.
adminRouter.get("/deposits", async (req, res) => {
  try {
    const status = typeof req.query.status === "string" ? req.query.status : "pending";
    const deposits = await col<{
      _id: string; userId: string; amount: number; method: string; utr?: string | null;
      status: string; adminNote?: string | null; createdAt: Date; approvedAt?: Date | null; approvedBy?: string | null;
    }>("deposits");
    const filter = status === "all" ? {} : { status };
    const rows = await deposits.find(filter).sort({ createdAt: -1 }).limit(300).toArray();
    const users = await col<UserDoc>("users");
    const userRows = await users.find({}, { projection: { name: 1, email: 1 } }).toArray();
    const byId = new Map(userRows.map((u) => [u._id, u]));
    res.json(
      rows.map((d) => ({
        id: d._id,
        user: byId.get(d.userId)?.name ?? "—",
        email: byId.get(d.userId)?.email ?? "",
        userId: d.userId,
        amount: Number(d.amount),
        method: d.method,
        utr: d.utr ?? "",
        status: d.status,
        note: d.adminNote ?? "",
        createdAt: d.createdAt.toISOString(),
        approvedAt: d.approvedAt ? d.approvedAt.toISOString() : null,
        approvedBy: d.approvedBy ?? null,
      })),
    );
  } catch (err) {
    fail(res, err);
  }
});

adminRouter.post("/deposits/:id/approve", async (req, res) => {
  try {
    const deposits = await col<{ _id: string; userId: string; amount: number; method: string; utr?: string | null }>("deposits");
    const depositBefore = await deposits.findOne({ _id: req.params.id });
    const { approveDeposit } = await import("../lib/db/wallet.ts");
    const newBalance = await approveDeposit(req.params.id, req.auth.userId);
    // If this deposit came from the Paytm/BharatPe QR "submitted UTR, awaiting
    // review" fallback, flip its session to "paid" too (with the same UTR as
    // txnId, so the reconcile sweep's duplicate-transaction guard sees it) —
    // otherwise the deposit page keeps polling a session stuck on
    // "utr_submitted" forever even though the wallet was just credited.
    try {
      const sessions = await col<{ _id: string; depositId?: string | null; status: string; txnId?: string | null }>("paytm_sessions");
      await sessions.updateOne(
        { depositId: req.params.id },
        { $set: { status: "paid", txnId: depositBefore?.utr || req.params.id, creditedAt: new Date() } },
      );
    } catch {
      /* best-effort — the credit itself already succeeded */
    }
    // Best-effort admin-visible payment log — mirrors what auto-credit
    // (creditPaytmSession) already logs, so a manually-approved deposit
    // shows up on the Payments history page too, not just auto-credited ones.
    if (depositBefore) {
      try {
        const payments = await col("payments");
        await payments.insertOne({
          _id: crypto.randomUUID(),
          userId: depositBefore.userId,
          method: depositBefore.method,
          amount: Number(depositBefore.amount),
          status: "completed",
          reference: depositBefore.utr || req.params.id,
          createdAt: new Date(),
        } as never);
      } catch {
        /* best-effort */
      }
    }
    res.json({ ok: true, new_balance: newBalance });
  } catch (err) {
    fail(res, err);
  }
});

adminRouter.post("/deposits/:id/reject", async (req, res) => {
  try {
    const reason = String(req.body?.reason ?? "").slice(0, 200);
    const { rejectDeposit } = await import("../lib/db/wallet.ts");
    await rejectDeposit(req.params.id, req.auth.userId, reason);
    res.json({ ok: true });
  } catch (err) {
    fail(res, err);
  }
});

adminRouter.get("/refunds", async (_req, res) => {
  try {
    const refunds = await col<{
      _id: string; orderId?: string; userId: string; amount: number; reason?: string; status: string; createdAt: Date;
    }>("refunds");
    const rows = await refunds.find({}).sort({ createdAt: -1 }).toArray();
    const users = await col<UserDoc>("users");
    const userRows = await users.find({}, { projection: { name: 1 } }).toArray();
    const byId = new Map(userRows.map((u) => [u._id, u]));
    res.json(
      rows.map((x) => ({
        id: x._id, orderId: x.orderId ?? "", user: byId.get(x.userId)?.name ?? "—", amount: Number(x.amount),
        reason: x.reason ?? "", status: x.status, createdAt: x.createdAt.toISOString(),
      })),
    );
  } catch (err) {
    fail(res, err);
  }
});

adminRouter.get("/coupons", async (_req, res) => {
  try {
    const coupons = await col<{
      _id: string; code: string; type: string; value: number; used: number; usageLimit: number;
      expiresAt?: Date | null; enabled: boolean; createdAt: Date;
    }>("coupons");
    const rows = await coupons.find({}).sort({ createdAt: -1 }).toArray();
    res.json(
      rows.map((c) => ({
        id: c._id, code: c.code, type: c.type, value: Number(c.value), used: c.used, limit: c.usageLimit,
        expiresAt: c.expiresAt ? c.expiresAt.toISOString() : "", enabled: c.enabled,
      })),
    );
  } catch (err) {
    fail(res, err);
  }
});

type PromotionDoc = {
  _id: string; title: string; kind: string; audience?: string | null; status: string;
  startsAt?: Date | null; endsAt?: Date | null; description?: string | null; linkUrl?: string | null;
  imageUrl?: string | null; createdAt: Date; updatedAt: Date;
};
function mapPromotion(p: PromotionDoc) {
  return {
    id: p._id, title: p.title, kind: p.kind, audience: p.audience ?? "", status: p.status,
    startsAt: p.startsAt ? p.startsAt.toISOString() : "", endsAt: p.endsAt ? p.endsAt.toISOString() : "",
    description: p.description ?? "", linkUrl: p.linkUrl ?? "", imageUrl: p.imageUrl ?? "",
  };
}

adminRouter.get("/promotions", async (_req, res) => {
  try {
    const promos = await col<PromotionDoc>("promotions");
    const rows = await promos.find({}).sort({ createdAt: -1 }).toArray();
    res.json(rows.map(mapPromotion));
  } catch (err) {
    fail(res, err);
  }
});

adminRouter.get("/roles", async (_req, res) => {
  try {
    const users = await col<UserDoc>("users");
    const count = await users.countDocuments({ roles: "admin" });
    res.json([
      { id: "r1", name: "Super Admin", members: count, permissions: ["*"], description: "Full unrestricted access" },
    ]);
  } catch (err) {
    fail(res, err);
  }
});

adminRouter.get("/permissions", async (_req, res) => {
  res.json([
    { module: "Users", perms: ["read", "write", "delete"] },
    { module: "Orders", perms: ["read", "write", "cancel", "refund"] },
    { module: "Services", perms: ["read", "write", "delete"] },
    { module: "Countries", perms: ["read", "write", "delete"] },
    { module: "Numbers", perms: ["read", "write", "assign", "release"] },
    { module: "Payments", perms: ["read", "approve", "reject"] },
    { module: "Wallets", perms: ["read", "adjust", "freeze"] },
    { module: "Reports", perms: ["read", "export"] },
    { module: "System", perms: ["read", "configure"] },
  ]);
});

adminRouter.get("/audit", async (_req, res) => {
  try {
    const logs = await col<{
      _id: string; actorEmail?: string; action: string; target?: string; ip?: string; severity: string; createdAt: Date;
    }>("audit_logs");
    const rows = await logs.find({}).sort({ createdAt: -1 }).limit(100).toArray();
    res.json(
      rows.map((a) => ({
        id: a._id, actor: a.actorEmail ?? "—", action: a.action, target: a.target ?? "", ip: a.ip ?? "",
        createdAt: a.createdAt.toISOString(), severity: a.severity,
      })),
    );
  } catch (err) {
    fail(res, err);
  }
});

adminRouter.get("/media", async (_req, res) => {
  try {
    const media = await col<{
      _id: string; name: string; folder?: string; kind: string; size?: string; url?: string; uploadedAt: Date;
    }>("media");
    const rows = await media.find({}).sort({ uploadedAt: -1 }).toArray();
    res.json(
      rows.map((m) => ({
        id: m._id, name: m.name, folder: m.folder ?? "", kind: m.kind, size: m.size ?? "", url: m.url ?? "",
        uploadedAt: m.uploadedAt.toISOString(),
      })),
    );
  } catch (err) {
    fail(res, err);
  }
});

adminRouter.get("/notifications", async (_req, res) => {
  try {
    const notifs = await col<{
      _id: string; title: string; body?: string; channel: string; audience?: string; status: string; sentAt?: Date | null;
    }>("admin_notifications");
    const rows = await notifs.find({}).sort({ _id: -1 }).toArray();
    res.json(
      rows.map((n) => ({
        id: n._id, title: n.title, body: n.body ?? "", channel: n.channel, audience: n.audience ?? "",
        status: n.status, sentAt: n.sentAt ? n.sentAt.toISOString() : undefined,
      })),
    );
  } catch (err) {
    fail(res, err);
  }
});

type TicketDoc = { _id: string; userId: string; subject: string; status: string; priority: string; category?: string; updatedAt: Date };

adminRouter.get("/tickets", async (_req, res) => {
  try {
    const tickets = await col<TicketDoc>("tickets");
    const rows = await tickets.find({}).sort({ updatedAt: -1 }).toArray();
    res.json(
      rows.map((t) => ({
        id: t._id, subject: t.subject, status: t.status,
        priority: t.priority === "urgent" ? "high" : t.priority, category: t.category ?? "General",
        updatedAt: t.updatedAt.toISOString(), messages: [],
      })),
    );
  } catch (err) {
    fail(res, err);
  }
});

type RentalDoc = {
  _id: string; userId: string; number: string; country?: string; service?: string; durationDays: number;
  price: number; status: string; startedAt: Date; expiresAt: Date;
};

adminRouter.get("/rentals", async (_req, res) => {
  try {
    const rentals = await col<RentalDoc>("rentals");
    const rows = await rentals.find({}).sort({ startedAt: -1 }).toArray();
    res.json(
      rows.map((x) => ({
        id: x._id, number: x.number, country: x.country ?? "", service: x.service ?? "",
        durationDays: x.durationDays, price: Number(x.price), status: x.status === "active" ? "active" : "expired",
        startedAt: x.startedAt.toISOString(), expiresAt: x.expiresAt.toISOString(),
      })),
    );
  } catch (err) {
    fail(res, err);
  }
});

adminRouter.get("/analytics", async (_req, res) => {
  try {
    const emptySeries: Array<{ label: string; value: number }> = [];
    const [users, orders, tickets, refunds, wallet, countries, services, rentals] = await Promise.all([
      countCollection("users"),
      countCollection("orders"),
      countCollection("tickets"),
      countCollection("refunds"),
      sumWallet(),
      countCollection("countries"),
      countCollection("services"),
      countCollection("rentals"),
    ]);
    void tickets;
    res.json({
      revenue: emptySeries,
      orders: emptySeries,
      services: emptySeries,
      countries: emptySeries,
      users: emptySeries,
      wallet: emptySeries,
      refunds: emptySeries,
      otpSuccess: emptySeries,
      kpi: {
        revenueToday: 0,
        ordersToday: 0,
        otpToday: 0,
        pending: 0,
        completed: 0,
        refundRequests: refunds,
        totalUsers: users,
        activeUsers: users,
        countries,
        services,
        rentalNumbers: rentals,
        walletBalance: wallet,
        apiRequests: 0,
      },
    });
  } catch (err) {
    fail(res, err);
  }
});

// ----- Promotions CRUD (promotionsApi) -----
export type PromotionInput = {
  title: string;
  kind: "banner" | "offer" | "popup" | "announcement";
  audience?: string;
  status: "draft" | "scheduled" | "live" | "ended";
  startsAt?: string | null;
  endsAt?: string | null;
  description?: string | null;
  linkUrl?: string | null;
  imageUrl?: string | null;
};

adminRouter.post("/promotions", async (req, res) => {
  try {
    const data = req.body as PromotionInput;
    const promos = await col<PromotionDoc>("promotions");
    const now = new Date();
    const doc: PromotionDoc = {
      _id: crypto.randomUUID(),
      title: data.title,
      kind: data.kind,
      audience: data.audience ?? null,
      status: data.status,
      startsAt: data.startsAt ? new Date(data.startsAt) : null,
      endsAt: data.endsAt ? new Date(data.endsAt) : null,
      description: data.description ?? null,
      linkUrl: data.linkUrl ?? null,
      imageUrl: data.imageUrl ?? null,
      createdAt: now,
      updatedAt: now,
    };
    await promos.insertOne(doc);
    res.json(mapPromotion(doc));
  } catch (err) {
    fail(res, err);
  }
});

adminRouter.patch("/promotions/:id", async (req, res) => {
  try {
    const patch = (req.body ?? {}) as Partial<PromotionInput>;
    const promos = await col<PromotionDoc>("promotions");
    const set: Record<string, unknown> = { updatedAt: new Date() };
    if (patch.title !== undefined) set.title = patch.title;
    if (patch.kind !== undefined) set.kind = patch.kind;
    if (patch.audience !== undefined) set.audience = patch.audience || null;
    if (patch.status !== undefined) set.status = patch.status;
    if (patch.startsAt !== undefined) set.startsAt = patch.startsAt ? new Date(patch.startsAt) : null;
    if (patch.endsAt !== undefined) set.endsAt = patch.endsAt ? new Date(patch.endsAt) : null;
    if (patch.description !== undefined) set.description = patch.description || null;
    if (patch.linkUrl !== undefined) set.linkUrl = patch.linkUrl || null;
    if (patch.imageUrl !== undefined) set.imageUrl = patch.imageUrl || null;
    const result = await promos.findOneAndUpdate({ _id: req.params.id }, { $set: set }, { returnDocument: "after" });
    if (!result) throw new Error("Promotion not found");
    res.json(mapPromotion(result));
  } catch (err) {
    fail(res, err);
  }
});

adminRouter.delete("/promotions/:id", async (req, res) => {
  try {
    const promos = await col<PromotionDoc>("promotions");
    await promos.deleteOne({ _id: req.params.id });
    res.json(true);
  } catch (err) {
    fail(res, err);
  }
});

// =====================================================================
// api/orderManagement.ts — admin order management (list/get/summary/
// update/export/customer/service-info)
// =====================================================================

type ManagedOrderStatus = "draft" | "pending" | "processing" | "completed" | "cancelled" | "failed";

function toManaged(o: OrderDoc, userEmail: string, userName: string) {
  const status: ManagedOrderStatus =
    o.status === "received" ? "completed"
    : o.status === "cancelled" ? "cancelled"
    : o.status === "expired" ? "failed"
    : o.status === "refunded" ? "cancelled"
    : "pending";
  const paymentStatus = status === "completed" ? "paid" : status === "cancelled" || status === "failed" ? "refunded" : "unpaid";
  const createdAt = o.createdAt.toISOString();
  const expiresAt = o.expiresAt ? o.expiresAt.toISOString() : createdAt;
  const timeline = [
    { id: "t1", status: "pending", title: "Order created", at: createdAt },
    ...(status !== "pending" ? [{ id: "t2", status, title: `Marked ${status}`, at: expiresAt }] : []),
  ];
  const activity = [
    { id: "a1", action: "order.created", detail: "Order recorded", by: userName, at: createdAt, level: "info" },
  ];
  return {
    id: o._id,
    reference: `ORD-${o._id.slice(0, 8).toUpperCase()}`,
    status,
    paymentStatus,
    amount: Number(o.price),
    currency: "USD",
    quantity: 1,
    createdAt,
    updatedAt: expiresAt,
    channel: "web",
    customer: {
      id: o.userId,
      name: userName,
      email: userEmail,
      avatarUrl: `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(userName)}`,
      country: o.countryName ?? "",
      since: createdAt,
      totalOrders: 1,
      lifetimeValue: Number(o.price),
    },
    service: {
      id: o.serviceId ?? "",
      name: o.serviceName ?? "",
      icon: "🔐",
      category: "OTP",
      countryCode: o.countryCode ?? "",
      countryName: o.countryName ?? "",
      countryFlag: "🌐",
      operator: o.operator ?? "",
    },
    invoice: {
      id: `inv_${o._id.slice(0, 8)}`,
      number: `INV-${o._id.slice(0, 6).toUpperCase()}`,
      issuedAt: createdAt,
      dueAt: expiresAt,
      subtotal: Number(o.price),
      tax: 0,
      discount: 0,
      total: Number(o.price),
      currency: "USD",
      url: "",
    },
    payment: {
      id: `pay_${o._id.slice(0, 8)}`,
      status: paymentStatus,
      method: "Wallet",
      reference: o._id,
      amount: Number(o.price),
      currency: "USD",
      paidAt: paymentStatus === "paid" ? createdAt : undefined,
    },
    timeline,
    activity,
    transactions: [] as unknown[],
  };
}
type ManagedOrder = ReturnType<typeof toManaged>;

async function loadManagedOrders(): Promise<ManagedOrder[]> {
  const orders = await getCollection<OrderDoc>("orders");
  const rows = await orders.find({}).sort({ createdAt: -1 }).toArray();
  const uids = Array.from(new Set(rows.map((o) => o.userId)));
  const users = await getCollection<UserDoc>("users");
  const userRows = uids.length ? await users.find({ _id: { $in: uids } }, { projection: { email: 1, name: 1 } }).toArray() : [];
  const byId = new Map(userRows.map((u) => [u._id, u]));
  return rows.map((o) => {
    const u = byId.get(o.userId);
    return toManaged(o, u?.email ?? "—", u?.name ?? "—");
  });
}

function paginateOrders(items: ManagedOrder[], page: number, pageSize: number) {
  const total = items.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const p = Math.min(Math.max(1, page), totalPages);
  const start = (p - 1) * pageSize;
  return { items: items.slice(start, start + pageSize), total, page: p, pageSize, totalPages };
}

adminRouter.post("/order-management/list", async (req, res) => {
  try {
    const query = req.body ?? {};
    const {
      q = "", status = "all", paymentStatus = "all", channel = "all", from, to,
      page = 1, pageSize = 10, sort = "newest",
    } = query;
    let items = await loadManagedOrders();
    if (status !== "all") items = items.filter((o) => o.status === status);
    if (paymentStatus !== "all") items = items.filter((o) => o.paymentStatus === paymentStatus);
    if (channel !== "all") items = items.filter((o) => o.channel === channel);
    if (from) items = items.filter((o) => o.createdAt >= from);
    if (to) items = items.filter((o) => o.createdAt <= to);
    if (String(q).trim()) {
      const s = String(q).trim().toLowerCase();
      items = items.filter((o) =>
        [o.reference, o.id, o.customer.name, o.customer.email, o.service.name, o.service.countryName]
          .join(" ").toLowerCase().includes(s),
      );
    }
    items.sort((a, b) =>
      sort === "newest" ? b.createdAt.localeCompare(a.createdAt)
      : sort === "oldest" ? a.createdAt.localeCompare(b.createdAt)
      : sort === "amount-desc" ? b.amount - a.amount
      : a.amount - b.amount,
    );
    res.json(paginateOrders(items, page, pageSize));
  } catch (err) {
    fail(res, err);
  }
});

adminRouter.get("/order-management/summary", async (_req, res) => {
  try {
    const items = await loadManagedOrders();
    const by = (s: ManagedOrderStatus) => items.filter((o) => o.status === s).length;
    res.json({
      total: items.length,
      draft: 0,
      pending: by("pending"),
      processing: 0,
      completed: by("completed"),
      cancelled: by("cancelled"),
      failed: by("failed"),
      revenue: items.filter((o) => o.status === "completed").reduce((s, o) => s + o.amount, 0),
    });
  } catch (err) {
    fail(res, err);
  }
});

adminRouter.get("/order-management/customer/:id", async (req, res) => {
  try {
    const items = await loadManagedOrders();
    res.json(items.find((o) => o.customer.id === req.params.id)?.customer ?? null);
  } catch (err) {
    fail(res, err);
  }
});

adminRouter.get("/order-management/customer/:id/orders", async (req, res) => {
  try {
    const items = await loadManagedOrders();
    res.json(items.filter((o) => o.customer.id === req.params.id));
  } catch (err) {
    fail(res, err);
  }
});

adminRouter.get("/order-management/service-info/:id", async (req, res) => {
  try {
    const items = await loadManagedOrders();
    res.json(items.find((o) => o.service.id === req.params.id)?.service ?? null);
  } catch (err) {
    fail(res, err);
  }
});

adminRouter.post("/order-management/export", async (_req, res) => {
  try {
    const items = await loadManagedOrders();
    res.json({ filename: `orders-${Date.now()}.csv`, rows: items.length });
  } catch (err) {
    fail(res, err);
  }
});

async function updateManagedOrderStatus(id: string, next: ManagedOrderStatus): Promise<ManagedOrder> {
  const map: Record<ManagedOrderStatus, "cancelled" | "expired" | "pending" | "received" | "refunded"> = {
    completed: "received", cancelled: "cancelled", failed: "expired", pending: "pending",
    processing: "pending", draft: "pending",
  };
  const dbStatus = map[next] ?? "pending";
  const orders = await getCollection<OrderDoc>("orders");
  const result = await orders.updateOne({ _id: id }, { $set: { status: dbStatus } });
  if (result.matchedCount === 0) throw new Error("Order not found");
  const items = await loadManagedOrders();
  const item = items.find((o) => o.id === id);
  if (!item) throw new Error("Order not found");
  return item;
}

adminRouter.post("/order-management/:id/status", async (req, res) => {
  try {
    const item = await updateManagedOrderStatus(req.params.id, req.body?.next);
    res.json(item);
  } catch (err) {
    fail(res, err);
  }
});

adminRouter.post("/order-management/bulk-status", async (req, res) => {
  try {
    const { ids, next } = req.body ?? {};
    await Promise.all((ids as string[]).map((id) => updateManagedOrderStatus(id, next)));
    res.json({ ok: true });
  } catch (err) {
    fail(res, err);
  }
});

adminRouter.post("/order-management/:id/approve", async (req, res) => {
  try {
    res.json(await updateManagedOrderStatus(req.params.id, "completed"));
  } catch (err) {
    fail(res, err);
  }
});

adminRouter.post("/order-management/:id/reject", async (req, res) => {
  try {
    res.json(await updateManagedOrderStatus(req.params.id, "failed"));
  } catch (err) {
    fail(res, err);
  }
});

adminRouter.post("/order-management/:id/cancel", async (req, res) => {
  try {
    res.json(await updateManagedOrderStatus(req.params.id, "cancelled"));
  } catch (err) {
    fail(res, err);
  }
});

adminRouter.get("/order-management/:id", async (req, res) => {
  try {
    const items = await loadManagedOrders();
    res.json(items.find((o) => o.id === req.params.id) ?? null);
  } catch (err) {
    fail(res, err);
  }
});
