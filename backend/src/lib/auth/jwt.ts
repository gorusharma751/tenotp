// Session JWTs. The frontend stores the returned token and sends it back as
// `Authorization: Bearer <token>` on every request (split-architecture —
// no shared origin for an httpOnly cookie, so we use a bearer token instead).
import jwt from "jsonwebtoken";

export type SessionClaims = {
  sub: string; // user id
  email: string;
  roles: string[];
};

const SESSION_TTL = "30d";

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
