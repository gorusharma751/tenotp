import { useEffect, type ReactNode } from "react";
import {
  Outlet,
  Link,
  createRootRoute,
  createRoute,
  createRouter,
  useRouter,
  redirect,
} from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { AppProviders } from "@/app/Providers";
import { AuthLayout } from "@/layouts/AuthLayout";
import { useUserStore } from "@/store/userStore";
import { ensureSessionSynced } from "@/lib/auth";

import Login from "@/routes/auth/login";
import Register from "@/routes/auth/register";
import ForgotPassword from "@/routes/auth/forgot-password";
import ResetPassword from "@/routes/auth/reset-password";

import { dashboardLayoutRoute, dashboardChildRoutes } from "@/routeGroups/dashboard";
import { publicLayoutRoute, publicChildRoutes } from "@/routeGroups/public";
import { adminLayoutRoute, adminChildRoutes } from "@/routeGroups/admin";
import { logoutRoute } from "@/routes/logout";
import { unauthorizedRoute } from "@/routes/unauthorized";
import { maintenanceRoute } from "@/routes/maintenance";
import { offlineRoute } from "@/routes/offline";

/**
 * Code-based routing (NOT file-based — this is a plain Vite SPA, no
 * TanStack Start / router-plugin toolchain). Ports the monolith's
 * `src/routes/__root.tsx` shell (theme sync, toaster, error boundary) minus
 * anything SSR-specific (HeadContent/Scripts/head loaders/html+body shell).
 *
 * ---- How another agent adds a route to this tree ----
 * 1. Build your route's component in your own file (e.g.
 *    `src/routes/dashboard/index.tsx`), default-exporting the component.
 * 2. In THIS file: import it, create it with
 *      const myRoute = createRoute({
 *        getParentRoute: () => rootRoute, // or dashboardLayoutRoute, etc.
 *        path: "/my-path",
 *        component: MyComponent,
 *      });
 * 3. Add `myRoute` to the `routeTree` children array passed to
 *    `rootRoute.addChildren([...])` below.
 * For a layout (e.g. a dashboard shell wrapping many child routes), create a
 * pathless parent route (`id: "dashboard-layout"` instead of `path`) whose
 * `component` renders the shell + `<Outlet />`, then set that route as
 * `getParentRoute` for its children — see `authLayoutRoute` below for the
 * pattern (auth pages all nest under it).
 */

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <p className="text-sm font-semibold text-primary">404</p>
        <h1 className="mt-2 text-4xl font-bold tracking-tight">Page not found</h1>
        <p className="mt-2 text-sm text-muted-foreground">The page you're looking for doesn't exist or has been moved.</p>
        <div className="mt-6 flex justify-center gap-2">
          <Button asChild><Link to="/">Go home</Link></Button>
          <Button asChild variant="outline"><Link to={"/dashboard" as any}>Dashboard</Link></Button>
        </div>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  const router = useRouter();
  useEffect(() => { console.error("[root error boundary]", error); }, [error]);
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-2xl font-bold">Something went wrong</h1>
        <p className="mt-2 text-sm text-muted-foreground">{error.message}</p>
        <div className="mt-6 flex justify-center gap-2">
          <Button onClick={() => { router.invalidate(); reset(); }}>Try again</Button>
          <Button asChild variant="outline"><Link to="/">Home</Link></Button>
        </div>
      </div>
    </div>
  );
}

function RootComponent() {
  return (
    <AppProviders>
      <Outlet />
    </AppProviders>
  );
}

export const rootRoute = createRootRoute({
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

/** Pathless layout route — every `/login`, `/register`, etc. page nests
 * under this and renders inside `AuthLayout`'s <Outlet />. Redirects an
 * already-signed-in user to /dashboard, mirroring the monolith's
 * `_auth.tsx` beforeLoad. */
const authLayoutRoute = createRoute({
  getParentRoute: () => rootRoute,
  id: "auth-layout",
  component: AuthLayout,
  beforeLoad: async ({ location }) => {
    await ensureSessionSynced();
    const u = useUserStore.getState().user;
    if (u && !location.pathname.startsWith("/logout")) {
      throw redirect({ to: "/dashboard" as any });
    }
  },
});

const loginRoute = createRoute({ getParentRoute: () => authLayoutRoute, path: "/login", component: Login });
const registerRoute = createRoute({ getParentRoute: () => authLayoutRoute, path: "/register", component: Register });
const forgotPasswordRoute = createRoute({ getParentRoute: () => authLayoutRoute, path: "/forgot-password", component: ForgotPassword });
const resetPasswordRoute = createRoute({ getParentRoute: () => authLayoutRoute, path: "/reset-password", component: ResetPassword });

const routeTree = rootRoute.addChildren([
  authLayoutRoute.addChildren([loginRoute, registerRoute, forgotPasswordRoute, resetPasswordRoute]),
  dashboardLayoutRoute.addChildren(dashboardChildRoutes),
  publicLayoutRoute.addChildren(publicChildRoutes),
  adminLayoutRoute.addChildren(adminChildRoutes),
  logoutRoute,
  unauthorizedRoute,
  maintenanceRoute,
  offlineRoute,
]);

export const router = createRouter({
  routeTree,
  defaultPreloadStaleTime: 0,
});

declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}
