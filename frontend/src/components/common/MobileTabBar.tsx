import { Link, useRouterState } from "@tanstack/react-router";
import { LayoutDashboard, ShoppingCart, Package, Wallet, Menu, ShieldCheck, Users, CreditCard } from "lucide-react";
import { useSidebar } from "@/components/ui/sidebar";
import { cn } from "@/lib/utils";

type Tab = { title: string; url: string; icon: any };

const USER_TABS: Tab[] = [
  { title: "Home", url: "/dashboard", icon: LayoutDashboard },
  { title: "Buy", url: "/dashboard/buy-number", icon: ShoppingCart },
  { title: "Orders", url: "/dashboard/orders", icon: Package },
  { title: "Wallet", url: "/dashboard/wallet", icon: Wallet },
];

const ADMIN_TABS: Tab[] = [
  { title: "Home", url: "/gourav-ankit-adi/dashboard", icon: ShieldCheck },
  { title: "Users", url: "/gourav-ankit-adi/users", icon: Users },
  { title: "Orders", url: "/gourav-ankit-adi/orders", icon: Package },
  { title: "Wallets", url: "/gourav-ankit-adi/wallets", icon: CreditCard },
];

export function MobileTabBar({ role }: { role: "user" | "admin" }) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const { setOpenMobile } = useSidebar();
  const tabs = role === "admin" ? ADMIN_TABS : USER_TABS;

  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-40 border-t bg-background/95 backdrop-blur md:hidden"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
      aria-label="Primary"
    >
      <div className="grid grid-cols-5">
        {tabs.map((t) => {
          const active = pathname === t.url || pathname.startsWith(t.url + "/");
          return (
            <Link
              key={t.url}
              to={t.url as any}
              className={cn(
                "flex flex-col items-center justify-center gap-0.5 py-2 text-[10px] font-medium transition-colors",
                active ? "text-primary" : "text-muted-foreground",
              )}
            >
              <t.icon className="h-5 w-5" />
              <span>{t.title}</span>
            </Link>
          );
        })}
        <button
          type="button"
          onClick={() => setOpenMobile(true)}
          className="flex flex-col items-center justify-center gap-0.5 py-2 text-[10px] font-medium text-muted-foreground"
        >
          <Menu className="h-5 w-5" />
          <span>More</span>
        </button>
      </div>
    </nav>
  );
}
