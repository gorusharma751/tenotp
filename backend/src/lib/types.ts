// Shared Mongo document shapes used across route modules.
export type UserDoc = {
  _id: string;
  email: string;
  emailLower: string;
  passwordHash: string;
  name: string;
  country?: string;
  phone?: string;
  avatarUrl?: string;
  /** Public-facing handle — unique per user, shown on Manual Provider
   * profiles (buyer viewing a seller, seller viewing a buyer) instead of
   * their real name/email/phone. Optional on the type only because
   * accounts created before this feature don't have one yet; every read
   * path that needs it calls ensureUsername() to backfill lazily. */
  username?: string;
  /** Set only for an account created via the Telegram Mini App login —
   * lets repeat launches from the same Telegram user find their existing
   * account instead of creating a new one each time. Absent for every
   * account created the normal email/password way. */
  telegramId?: string;
  referralCode: string;
  referredBy?: string | null;
  walletBalance: number;
  status: "active" | "frozen" | "blocked";
  roles: string[];
  createdAt: Date;
  updatedAt: Date;
  lastLogin?: Date;
  resellerPanelId?: string | null;
  /** Bumped on every successful password change/reset — password-reset JWTs
   * embed the version they were issued against, so an already-used link (or
   * one superseded by a newer reset request) stops verifying even before
   * its own expiry. See lib/auth/jwt.ts signPasswordResetToken. */
  passwordResetVersion?: number;
};

export type PublicUserDto = {
  id: string;
  name: string;
  email: string;
  role: "user" | "admin";
  /** Raw roles array (e.g. includes "provider" for a Manual Provider
   * seller) — `role` above stays admin/user-only for backward
   * compatibility with existing checks; anything needing a finer-grained
   * role (like the Seller Panel guard) reads this instead. */
  roles: string[];
  createdAt: string;
  wallet: number;
  verified: true;
  avatarUrl?: string;
};

export function toPublicUser(doc: UserDoc): PublicUserDto {
  const isAdmin = doc.roles.includes("admin") || doc.roles.includes("sub_admin");
  return {
    id: doc._id,
    name: doc.name,
    email: doc.email,
    role: isAdmin ? "admin" : "user",
    roles: doc.roles,
    createdAt: doc.createdAt.toISOString(),
    wallet: Number(doc.walletBalance ?? 0),
    verified: true,
    avatarUrl: doc.avatarUrl,
  };
}
