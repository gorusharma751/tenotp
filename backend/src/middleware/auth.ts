import type { Request, Response, NextFunction } from "express";
import { verifySessionToken, type SessionClaims } from "../lib/auth/jwt.ts";

// Augment Express's Request with the auth context every route handler reads.
declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      auth: { userId: string; email: string; roles: string[] };
    }
  }
}

function claimsFrom(req: Request): SessionClaims | null {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) return null;
  const token = header.slice("Bearer ".length).trim();
  if (!token) return null;
  return verifySessionToken(token);
}

/** Throws 401 if not logged in. */
export function requireAuth(req: Request, res: Response, next: NextFunction) {
  const claims = claimsFrom(req);
  if (!claims) return res.status(401).json({ error: "Unauthorized: No valid session" });
  req.auth = { userId: claims.sub, email: claims.email, roles: claims.roles };
  next();
}

/** Like requireAuth, but also 403s unless the session has the "admin" role. */
export function requireAdmin(req: Request, res: Response, next: NextFunction) {
  const claims = claimsFrom(req);
  if (!claims) return res.status(401).json({ error: "Unauthorized: No valid session" });
  if (!claims.roles.includes("admin")) return res.status(403).json({ error: "Forbidden" });
  req.auth = { userId: claims.sub, email: claims.email, roles: claims.roles };
  next();
}

/** Like requireAuth, but also 403s unless the session has the "provider"
 * role (Manual Provider sellers — an extra role on a normal user account,
 * granted by admin, not a separate account system). */
export function requireProvider(req: Request, res: Response, next: NextFunction) {
  const claims = claimsFrom(req);
  if (!claims) return res.status(401).json({ error: "Unauthorized: No valid session" });
  if (!claims.roles.includes("provider")) return res.status(403).json({ error: "Forbidden" });
  req.auth = { userId: claims.sub, email: claims.email, roles: claims.roles };
  next();
}

/** Never rejects — req.auth.userId is "" for guests. Use for endpoints that
 * should gracefully return empty results instead of erroring for logged-out
 * visitors (mirrors the old optionalAuth TanStack middleware). */
export function optionalAuth(req: Request, _res: Response, next: NextFunction) {
  const claims = claimsFrom(req);
  req.auth = { userId: claims?.sub ?? "", email: claims?.email ?? "", roles: claims?.roles ?? [] };
  next();
}

/** Manual Provider is soft-launched — live in production but only usable
 * by admin accounts for now (mirrors the frontend nav/route gating, so a
 * non-admin can't reach it by calling the API directly either). Mounted
 * ahead of every route in that router; the route's own requireAuth/
 * requireProvider/requireAdmin still runs after this for its normal checks. */
export function requireSoftLaunchAdmin(req: Request, res: Response, next: NextFunction) {
  const claims = claimsFrom(req);
  if (!claims) return res.status(401).json({ error: "Unauthorized: No valid session" });
  if (!claims.roles.includes("admin")) return res.status(403).json({ error: "This feature isn't available on your account yet" });
  next();
}
