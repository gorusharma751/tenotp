// Seller (Manual Provider) route group — mirrors routeGroups/admin.tsx's
// pattern exactly (pathless layout route + beforeLoad role guard + flat
// list of child routes), pointed at SellerShell instead of DashboardShell/
// AdminShell so this panel is fully separate from both existing ones.
import { createRoute, redirect } from "@tanstack/react-router";
import { rootRoute } from "@/router";
import { SellerShell } from "@/layouts/SellerShell";
import { useUserStore } from "@/store/userStore";
import { ensureSessionSynced } from "@/lib/auth";

import SellerDashboard from "@/routes/seller/dashboard";
import SellerServices from "@/routes/seller/services";
import SellerRequests from "@/routes/seller/requests";
import SellerBalance from "@/routes/seller/balance";

export const sellerLayoutRoute = createRoute({
  getParentRoute: () => rootRoute,
  id: "seller-layout",
  component: SellerShell,
  beforeLoad: async () => {
    await ensureSessionSynced();
    const seller = useUserStore.getState().seller;
    if (!seller) throw redirect({ to: "/login" as any });
    // Soft-launched alongside the buyer-side Manual Provider marketplace —
    // "seller wala panel bhi" stays admin-only in production for now too.
    if (seller.role !== "admin") throw redirect({ to: "/dashboard" as any });
  },
});

const p = (path: string, component: () => React.JSX.Element | null) =>
  createRoute({ getParentRoute: () => sellerLayoutRoute, path, component });

export const sellerChildRoutes = [
  p("/seller/dashboard", SellerDashboard),
  p("/seller/services", SellerServices),
  p("/seller/requests", SellerRequests),
  p("/seller/balance", SellerBalance),
];
