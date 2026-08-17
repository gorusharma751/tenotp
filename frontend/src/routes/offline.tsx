import { createRoute, Link } from "@tanstack/react-router";
import { rootRoute } from "@/router";
import { Button } from "@/components/ui/button";

function OfflinePage() {
  return (
    <div className="min-h-screen grid place-items-center p-6 text-center">
      <div>
        <h1 className="text-3xl font-bold">You're offline</h1>
        <p className="mt-2 text-muted-foreground">Check your connection and try again.</p>
        <Button asChild className="mt-6 gradient-brand"><Link to="/">Retry</Link></Button>
      </div>
    </div>
  );
}

/** Standalone route directly under rootRoute — ports the monolith's
 * `src/routes/offline.tsx`. */
export const offlineRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/offline",
  component: OfflinePage,
});
