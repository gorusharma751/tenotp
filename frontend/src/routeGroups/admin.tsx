import { createRoute, redirect } from "@tanstack/react-router";
import { rootRoute } from "@/router";
import { DashboardShell } from "@/layouts/DashboardShell";
import { ADMIN_NAV } from "@/constants/nav";
import { useUserStore } from "@/store/userStore";

import AdminDash from "@/routes/admin/dashboard";
import AdminAdmins from "@/routes/admin/admins";
import AdminAlerts from "@/routes/admin/alerts";
import AdminAnalyticsRedirect from "@/routes/admin/analytics";
import AdminAnnouncements from "@/routes/admin/announcements";
import AdminApi from "@/routes/admin/api";
import AdminAudit from "@/routes/admin/audit";
import AdminBanners from "@/routes/admin/banners";
import AdminChannels from "@/routes/admin/channels";
import AdminCountries from "@/routes/admin/countries";
import AdminCountryDetail from "@/routes/admin/country.$code";
import AdminCoupons from "@/routes/admin/coupons";
import AdminEvents from "@/routes/admin/events";
import AdminHealth from "@/routes/admin/health";
import AdminJobs from "@/routes/admin/jobs";
import AdminLogs from "@/routes/admin/logs";
import AdminMaintenance from "@/routes/admin/maintenance";
import AdminMedia from "@/routes/admin/media";
import AdminOrderDetail from "@/routes/admin/order.$id";
import AdminOrdersPage from "@/routes/admin/orders";
import AdminReferrals from "@/routes/admin/referrals";
import AdminRefunds from "@/routes/admin/refunds";
import AdminRentals from "@/routes/admin/rentals";
import AdminReports from "@/routes/admin/reports";
import AdminRoles from "@/routes/admin/roles";
import AdminServiceDetail from "@/routes/admin/service.$id";
import AdminSmokeTest from "@/routes/admin/smoke-test";
import AdminSupport from "@/routes/admin/support";
import AdminSystem from "@/routes/admin/system";
import AdminTickets from "@/routes/admin/tickets";
import AdminUserDetail from "@/routes/admin/user.$id";
import AdminUsers from "@/routes/admin/users";
import AdminWallets from "@/routes/admin/wallets";
import AdminProviders from "@/routes/admin/providers";
import AdminProvidersNew from "@/routes/admin/providers.new";
import AdminProviderDetail from "@/routes/admin/providers.$id";
import AdminProviderCategories from "@/routes/admin/providers.$id.categories";
import AdminProviderLogs from "@/routes/admin/providers.$id.logs";
import AdminProviderPricing from "@/routes/admin/providers.$id.pricing";
import AdminProviderServices from "@/routes/admin/providers.$id.services";
import AdminProviderSettings from "@/routes/admin/providers.$id.settings";

// Not yet ported by the conversion agent (ran out of time) — placeholder
// stubs so routing/build stay intact. See README "Known gaps".
import AdminNotifications from "@/routes/admin/notifications";
import AdminNumbers from "@/routes/admin/numbers";
import AdminOrderManagement from "@/routes/admin/order-management";
import AdminOrderManagementDetail from "@/routes/admin/order-management.$id";
import AdminPayments from "@/routes/admin/payments";
import AdminPermissions from "@/routes/admin/permissions";
import AdminPricing from "@/routes/admin/pricing";
import AdminPromotions from "@/routes/admin/promotions";
import AdminResellers from "@/routes/admin/resellers";
import AdminServices from "@/routes/admin/services";
import AdminSettings from "@/routes/admin/settings";

// Ports the monolith's `src/routes/gourav-ankit-adi.tsx` admin shell.
// The monolith's bare `/gourav-ankit-adi` (login) route is NOT ported here —
// admin sign-in reuses the regular `/login` page (same JWT auth, admin role
// check happens server-side + in this beforeLoad). Non-admins are redirected
// to `/login` instead of a separate admin login screen.
function AdminShell() {
  return <DashboardShell nav={ADMIN_NAV} role="admin" profileRoot="/gourav-ankit-adi/settings" />;
}

export const adminLayoutRoute = createRoute({
  getParentRoute: () => rootRoute,
  id: "admin-layout",
  component: AdminShell,
  beforeLoad: () => {
    const admin = useUserStore.getState().admin;
    if (!admin) throw redirect({ to: "/login" as any });
  },
});

const p = (path: string, component: () => React.JSX.Element | null) =>
  createRoute({ getParentRoute: () => adminLayoutRoute, path, component });

export const adminChildRoutes = [
  p("/gourav-ankit-adi/dashboard", AdminDash),
  p("/gourav-ankit-adi/admins", AdminAdmins),
  p("/gourav-ankit-adi/alerts", AdminAlerts),
  p("/gourav-ankit-adi/analytics", AdminAnalyticsRedirect),
  p("/gourav-ankit-adi/announcements", AdminAnnouncements),
  p("/gourav-ankit-adi/api", AdminApi),
  p("/gourav-ankit-adi/audit", AdminAudit),
  p("/gourav-ankit-adi/banners", AdminBanners),
  p("/gourav-ankit-adi/channels", AdminChannels),
  p("/gourav-ankit-adi/countries", AdminCountries),
  p("/gourav-ankit-adi/country/$code", AdminCountryDetail),
  p("/gourav-ankit-adi/coupons", AdminCoupons),
  p("/gourav-ankit-adi/events", AdminEvents),
  p("/gourav-ankit-adi/health", AdminHealth),
  p("/gourav-ankit-adi/jobs", AdminJobs),
  p("/gourav-ankit-adi/logs", AdminLogs),
  p("/gourav-ankit-adi/maintenance", AdminMaintenance),
  p("/gourav-ankit-adi/media", AdminMedia),
  p("/gourav-ankit-adi/order/$id", AdminOrderDetail),
  p("/gourav-ankit-adi/orders", AdminOrdersPage),
  p("/gourav-ankit-adi/referrals", AdminReferrals),
  p("/gourav-ankit-adi/refunds", AdminRefunds),
  p("/gourav-ankit-adi/rentals", AdminRentals),
  p("/gourav-ankit-adi/reports", AdminReports),
  p("/gourav-ankit-adi/roles", AdminRoles),
  p("/gourav-ankit-adi/service/$id", AdminServiceDetail),
  p("/gourav-ankit-adi/smoke-test", AdminSmokeTest),
  p("/gourav-ankit-adi/support", AdminSupport),
  p("/gourav-ankit-adi/system", AdminSystem),
  p("/gourav-ankit-adi/tickets", AdminTickets),
  p("/gourav-ankit-adi/user/$id", AdminUserDetail),
  p("/gourav-ankit-adi/users", AdminUsers),
  p("/gourav-ankit-adi/wallets", AdminWallets),
  p("/gourav-ankit-adi/providers", AdminProviders),
  p("/gourav-ankit-adi/providers/new", AdminProvidersNew),
  p("/gourav-ankit-adi/providers/$id", AdminProviderDetail),
  p("/gourav-ankit-adi/providers/$id/categories", AdminProviderCategories),
  p("/gourav-ankit-adi/providers/$id/logs", AdminProviderLogs),
  p("/gourav-ankit-adi/providers/$id/pricing", AdminProviderPricing),
  p("/gourav-ankit-adi/providers/$id/services", AdminProviderServices),
  p("/gourav-ankit-adi/providers/$id/settings", AdminProviderSettings),
  p("/gourav-ankit-adi/notifications", AdminNotifications),
  p("/gourav-ankit-adi/numbers", AdminNumbers),
  p("/gourav-ankit-adi/order-management", AdminOrderManagement),
  p("/gourav-ankit-adi/order-management/$id", AdminOrderManagementDetail),
  p("/gourav-ankit-adi/payments", AdminPayments),
  p("/gourav-ankit-adi/permissions", AdminPermissions),
  p("/gourav-ankit-adi/pricing", AdminPricing),
  p("/gourav-ankit-adi/promotions", AdminPromotions),
  p("/gourav-ankit-adi/resellers", AdminResellers),
  p("/gourav-ankit-adi/services", AdminServices),
  p("/gourav-ankit-adi/settings", AdminSettings),
];
