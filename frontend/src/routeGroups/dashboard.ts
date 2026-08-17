// Dashboard route group — built in its own file per the orchestrator's
// instruction (other agents are touching router.tsx concurrently). Exports
// `dashboardLayoutRoute` (pathless layout, mirrors the monolith's
// src/routes/dashboard.tsx guard) and `dashboardChildRoutes` (every child
// page below it). The orchestrator wires these into router.tsx's routeTree.
import { createRoute, redirect } from "@tanstack/react-router";
import { rootRoute } from "@/router";
import { DashboardShell } from "@/layouts/DashboardShell";
import { USER_NAV } from "@/constants/nav";
import { useUserStore } from "@/store/userStore";

import DashboardIndex from "@/routes/dashboard/index";
import BuyNumber from "@/routes/dashboard/buy-number";
import Orders from "@/routes/dashboard/orders";
import OrderDetail from "@/routes/dashboard/order.$id";
import OrderManagement from "@/routes/dashboard/order-management";
import OrderManagementDetails from "@/routes/dashboard/order-management.$id";
import PurchaseSuccess from "@/routes/dashboard/purchase-success.$id";
import OtpInbox from "@/routes/dashboard/otp-inbox";
import WalletPage from "@/routes/dashboard/wallet";
import Deposit from "@/routes/dashboard/deposit";
import PaymentHistory from "@/routes/dashboard/payment-history";
import RefundHistory from "@/routes/dashboard/refund-history";
import Rentals from "@/routes/dashboard/rental";
import Referrals from "@/routes/dashboard/referrals";
import Profile from "@/routes/dashboard/profile";
import Security from "@/routes/dashboard/security";
import Settings from "@/routes/dashboard/settings";
import ApiKeys from "@/routes/dashboard/api-keys";
import DevTools from "@/routes/dashboard/dev-tools";
import Tickets from "@/routes/dashboard/tickets";
import TicketDetail from "@/routes/dashboard/ticket.$id";
import Support from "@/routes/dashboard/support";
import Notifications from "@/routes/dashboard/notifications";
import Announcements from "@/routes/dashboard/announcements";
import EventTimeline from "@/routes/dashboard/event-timeline";
import SavedServices from "@/routes/dashboard/saved-services";
import Favorites from "@/routes/dashboard/favorites";
import ServiceInfo from "@/routes/dashboard/service-info.$id";
import Usage from "@/routes/dashboard/usage";
import Activity from "@/routes/dashboard/activity";
import Logs from "@/routes/dashboard/logs";
import Integrations from "@/routes/dashboard/integrations";
import Downloads from "@/routes/dashboard/downloads";
import HowToUse from "@/routes/dashboard/how-to-use";
import CustomerDetails from "@/routes/dashboard/customers.$id";

// DashboardShell already renders its own <Outlet /> internally (see
// frontend/src/layouts/DashboardShell.tsx), so the layout route's component
// is just DashboardShell wired with the user nav/role — no extra <Outlet/>
// wrapper needed here.
export const dashboardLayoutRoute = createRoute({
  getParentRoute: () => rootRoute,
  id: "dashboard-layout",
  component: () => DashboardShell({ nav: USER_NAV, role: "user", profileRoot: "/dashboard/profile" }),
  beforeLoad: () => {
    const u = useUserStore.getState().user;
    if (!u) throw redirect({ to: "/login" });
  },
});

const dashboardIndexRoute = createRoute({ getParentRoute: () => dashboardLayoutRoute, path: "/dashboard", component: DashboardIndex });
const buyNumberRoute = createRoute({ getParentRoute: () => dashboardLayoutRoute, path: "/dashboard/buy-number", component: BuyNumber });
const ordersRoute = createRoute({ getParentRoute: () => dashboardLayoutRoute, path: "/dashboard/orders", component: Orders });
const orderDetailRoute = createRoute({ getParentRoute: () => dashboardLayoutRoute, path: "/dashboard/order/$id", component: OrderDetail });
const orderManagementRoute = createRoute({ getParentRoute: () => dashboardLayoutRoute, path: "/dashboard/order-management", component: OrderManagement });
const orderManagementDetailRoute = createRoute({ getParentRoute: () => dashboardLayoutRoute, path: "/dashboard/order-management/$id", component: OrderManagementDetails });
const purchaseSuccessRoute = createRoute({ getParentRoute: () => dashboardLayoutRoute, path: "/dashboard/purchase-success/$id", component: PurchaseSuccess });
const otpInboxRoute = createRoute({ getParentRoute: () => dashboardLayoutRoute, path: "/dashboard/otp-inbox", component: OtpInbox });
const walletRoute = createRoute({ getParentRoute: () => dashboardLayoutRoute, path: "/dashboard/wallet", component: WalletPage });
const depositRoute = createRoute({ getParentRoute: () => dashboardLayoutRoute, path: "/dashboard/deposit", component: Deposit });
const paymentHistoryRoute = createRoute({ getParentRoute: () => dashboardLayoutRoute, path: "/dashboard/payment-history", component: PaymentHistory });
const refundHistoryRoute = createRoute({ getParentRoute: () => dashboardLayoutRoute, path: "/dashboard/refund-history", component: RefundHistory });
const rentalRoute = createRoute({ getParentRoute: () => dashboardLayoutRoute, path: "/dashboard/rental", component: Rentals });
const referralsRoute = createRoute({ getParentRoute: () => dashboardLayoutRoute, path: "/dashboard/referrals", component: Referrals });
const profileRoute = createRoute({ getParentRoute: () => dashboardLayoutRoute, path: "/dashboard/profile", component: Profile });
const securityRoute = createRoute({ getParentRoute: () => dashboardLayoutRoute, path: "/dashboard/security", component: Security });
const settingsRoute = createRoute({ getParentRoute: () => dashboardLayoutRoute, path: "/dashboard/settings", component: Settings });
const apiKeysRoute = createRoute({ getParentRoute: () => dashboardLayoutRoute, path: "/dashboard/api-keys", component: ApiKeys });
const devToolsRoute = createRoute({ getParentRoute: () => dashboardLayoutRoute, path: "/dashboard/dev-tools", component: DevTools });
const ticketsRoute = createRoute({ getParentRoute: () => dashboardLayoutRoute, path: "/dashboard/tickets", component: Tickets });
const ticketDetailRoute = createRoute({ getParentRoute: () => dashboardLayoutRoute, path: "/dashboard/ticket/$id", component: TicketDetail });
const supportRoute = createRoute({ getParentRoute: () => dashboardLayoutRoute, path: "/dashboard/support", component: Support });
const notificationsRoute = createRoute({ getParentRoute: () => dashboardLayoutRoute, path: "/dashboard/notifications", component: Notifications });
const announcementsRoute = createRoute({ getParentRoute: () => dashboardLayoutRoute, path: "/dashboard/announcements", component: Announcements });
const eventTimelineRoute = createRoute({ getParentRoute: () => dashboardLayoutRoute, path: "/dashboard/event-timeline", component: EventTimeline });
const savedServicesRoute = createRoute({ getParentRoute: () => dashboardLayoutRoute, path: "/dashboard/saved-services", component: SavedServices });
const favoritesRoute = createRoute({ getParentRoute: () => dashboardLayoutRoute, path: "/dashboard/favorites", component: Favorites });
const serviceInfoRoute = createRoute({ getParentRoute: () => dashboardLayoutRoute, path: "/dashboard/service-info/$id", component: ServiceInfo });
const usageRoute = createRoute({ getParentRoute: () => dashboardLayoutRoute, path: "/dashboard/usage", component: Usage });
const activityRoute = createRoute({ getParentRoute: () => dashboardLayoutRoute, path: "/dashboard/activity", component: Activity });
const logsRoute = createRoute({ getParentRoute: () => dashboardLayoutRoute, path: "/dashboard/logs", component: Logs });
const integrationsRoute = createRoute({ getParentRoute: () => dashboardLayoutRoute, path: "/dashboard/integrations", component: Integrations });
const downloadsRoute = createRoute({ getParentRoute: () => dashboardLayoutRoute, path: "/dashboard/downloads", component: Downloads });
const howToUseRoute = createRoute({ getParentRoute: () => dashboardLayoutRoute, path: "/dashboard/how-to-use", component: HowToUse });
const customerDetailRoute = createRoute({ getParentRoute: () => dashboardLayoutRoute, path: "/dashboard/customers/$id", component: CustomerDetails });

export const dashboardChildRoutes = [
  dashboardIndexRoute,
  buyNumberRoute,
  ordersRoute,
  orderDetailRoute,
  orderManagementRoute,
  orderManagementDetailRoute,
  purchaseSuccessRoute,
  otpInboxRoute,
  walletRoute,
  depositRoute,
  paymentHistoryRoute,
  refundHistoryRoute,
  rentalRoute,
  referralsRoute,
  profileRoute,
  securityRoute,
  settingsRoute,
  apiKeysRoute,
  devToolsRoute,
  ticketsRoute,
  ticketDetailRoute,
  supportRoute,
  notificationsRoute,
  announcementsRoute,
  eventTimelineRoute,
  savedServicesRoute,
  favoritesRoute,
  serviceInfoRoute,
  usageRoute,
  activityRoute,
  logsRoute,
  integrationsRoute,
  downloadsRoute,
  howToUseRoute,
  customerDetailRoute,
];
