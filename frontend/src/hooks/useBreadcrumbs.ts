import { useRouterState } from "@tanstack/react-router";
import { useMemo } from "react";

const LABELS: Record<string, string> = {
  dashboard: "Dashboard", admin: "Admin", "buy-number": "Buy Number", orders: "Orders",
  order: "Order", "otp-inbox": "OTP Inbox", rental: "Rental", wallet: "Wallet",
  deposit: "Deposit", history: "History", referrals: "Referrals", "api-keys": "API Keys",
  profile: "Profile", security: "Security", settings: "Settings", notifications: "Notifications",
  support: "Support", tickets: "Tickets", ticket: "Ticket", activity: "Activity",
  favorites: "Favorites", "saved-services": "Saved Services", downloads: "Downloads",
  logs: "Logs", "payment-history": "Payments", "refund-history": "Refunds",
  subscription: "Subscription", usage: "Usage", "dev-tools": "Dev Tools",
  integrations: "Integrations", users: "Users", user: "User", services: "Services",
  service: "Service", countries: "Countries", numbers: "Numbers", rentals: "Rentals",
  wallets: "Wallets", payments: "Payments", refunds: "Refunds", reports: "Reports",
  analytics: "Analytics", system: "System", api: "API", roles: "Roles",
  permissions: "Permissions", promotions: "Promotions", coupons: "Coupons",
  banners: "Banners", maintenance: "Maintenance", audit: "Audit",
};

export function useBreadcrumbs() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  return useMemo(() => {
    const parts = pathname.split("/").filter(Boolean);
    return parts.map((p, i) => ({
      label: LABELS[p] ?? p.replace(/[-_]/g, " ").replace(/\b\w/g, (m) => m.toUpperCase()),
      href: "/" + parts.slice(0, i + 1).join("/"),
      last: i === parts.length - 1,
    }));
  }, [pathname]);
}
