import { createRoute, redirect } from "@tanstack/react-router";
import { rootRoute } from "@/router";
import { signOut } from "@/lib/auth";

/** Standalone route directly under rootRoute (not nested under any layout) —
 * ports the monolith's `src/routes/logout.tsx`. Clears the session then
 * redirects to /login; no component ever renders. */
export const logoutRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/logout",
  beforeLoad: async () => {
    await signOut().catch(() => {});
    throw redirect({ to: "/login" });
  },
});
