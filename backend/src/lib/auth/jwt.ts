// Session JWTs. The frontend stores the returned token and sends it back as
// `Authorization: Bearer <token>` on every request (split-architecture —
// no shared origin for an httpOnly cookie, so we use a bearer token instead).
import jwt from "jsonwebtoken";

export type SessionClaims = {
  sub: string; // user id
  email: string;
  roles: string[];
};

export type PasswordResetClaims = SessionClaims & {
  /** Snapshot of the user's passwordResetVersion at issue time — bumped on
   * every successful password change, so an already-used (or superseded by
   * a newer reset request) link stops verifying even though the JWT itself
   * hasn't expired yet. See verifyPasswordResetToken. */
  resetVersion: number;
};

const SESSION_TTL = "30d";
// A reset link is a live account-takeover credential if it leaks (forwarded
// email, intermediary logging, shared inbox) — 30 days was far too long for
// that exposure window. 30 minutes matches typical "click the email now"
// UX while keeping the blast radius small.
const PASSWORD_RESET_TTL = "30m";

function secret(): string {
  const s = process.env.AUTH_JWT_SECRET;
  if (!s) {
    throw new Error("Missing environment variable: AUTH_JWT_SECRET. Set it in .env (see .env.example).");
  }
  return s;
}

export function signSessionToken(claims: SessionClaims): string {
  return jwt.sign(claims, secret(), { expiresIn: SESSION_TTL });
}

export function verifySessionToken(token: string): SessionClaims | null {
  try {
    const decoded = jwt.verify(token, secret());
    if (typeof decoded !== "object" || decoded === null) return null;
    const { sub, email, roles } = decoded as Record<string, unknown>;
    if (typeof sub !== "string" || typeof email !== "string" || !Array.isArray(roles)) return null;
    return { sub, email, roles: roles.filter((r): r is string => typeof r === "string") };
  } catch {
    return null;
  }
}

/** Short-lived (30m) password-reset token, scoped to a resetVersion snapshot
 * so it can be invalidated (see verifyPasswordResetToken) independently of
 * its own expiry — e.g. immediately after it's used once, or if the user
 * requests a fresh reset link and the old one should stop working. */
export function signPasswordResetToken(claims: SessionClaims, resetVersion: number): string {
  const payload: PasswordResetClaims = { ...claims, roles: ["password_reset"], resetVersion };
  return jwt.sign(payload, secret(), { expiresIn: PASSWORD_RESET_TTL });
}

export function verifyPasswordResetToken(token: string): PasswordResetClaims | null {
  try {
    const decoded = jwt.verify(token, secret());
    if (typeof decoded !== "object" || decoded === null) return null;
    const { sub, email, roles, resetVersion } = decoded as Record<string, unknown>;
    if (typeof sub !== "string" || typeof email !== "string" || !Array.isArray(roles)) return null;
    if (!roles.includes("password_reset")) return null;
    if (typeof resetVersion !== "number") return null;
    return { sub, email, roles: roles.filter((r): r is string => typeof r === "string"), resetVersion };
  } catch {
    return null;
  }
}
