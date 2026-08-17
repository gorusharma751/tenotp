import { createRoute, Link } from "@tanstack/react-router";
import { rootRoute } from "@/router";
import { Button } from "@/components/ui/button";

function MaintenancePage() {
  return (
    <div className="min-h-screen grid place-items-center p-6 text-center">
      <div>
        <div className="mx-auto grid h-16 w-16 place-items-center rounded-2xl gradient-brand shadow-glow text-white text-2xl">🛠️</div>
        <h1 className="mt-4 text-3xl font-bold">Under maintenance</h1>
        <p className="mt-2 text-muted-foreground">We're upgrading TenOTP. Back online shortly.</p>
        <Button asChild variant="outline" className="mt-6"><Link to="/">Refresh</Link></Button>
      </div>
    </div>
  );
}

/** Standalone route directly under rootRoute — ports the monolith's
 * `src/routes/maintenance.tsx`. */
export const maintenanceRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/maintenance",
  component: MaintenancePage,
});
