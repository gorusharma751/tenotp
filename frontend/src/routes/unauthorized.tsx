import { createRoute, Link } from "@tanstack/react-router";
import { rootRoute } from "@/router";
import { Button } from "@/components/ui/button";

function UnauthorizedPage() {
  return (
    <div className="min-h-screen grid place-items-center p-6 text-center">
      <div>
        <p className="text-sm font-semibold text-primary">403</p>
        <h1 className="mt-2 text-4xl font-bold">Access denied</h1>
        <p className="mt-2 text-muted-foreground">You don't have permission to view this page.</p>
        <Button asChild className="mt-6 gradient-brand"><Link to="/">Go home</Link></Button>
      </div>
    </div>
  );
}

/** Standalone route directly under rootRoute — ports the monolith's
 * `src/routes/unauthorized.tsx`. */
export const unauthorizedRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/unauthorized",
  component: UnauthorizedPage,
});
