// Manual Provider Seller Panel shell — visually matches DashboardShell
// (same Sidebar/Logo/ThemeToggle/Avatar primitives, same layout shape) but
// is its own component rather than overloading DashboardShell's role union,
// per the spec: "separate from the existing User Panel but belongs to the
// SAME TenOTP project." Nothing here touches DashboardShell or its
// existing user/admin behavior.
import { Outlet, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Sidebar, SidebarContent, SidebarGroup, SidebarGroupContent, SidebarGroupLabel,
  SidebarMenu, SidebarMenuButton, SidebarMenuItem, SidebarProvider, SidebarTrigger,
  SidebarHeader, SidebarFooter,
} from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { LogOut, User as UserIcon, LayoutDashboard, Wrench, ListChecks, Wallet, Bell } from "lucide-react";
import { timeAgo } from "@/utils/format";
import { Logo } from "@/components/brand/Logo";
import { ThemeToggle } from "@/components/common/ThemeToggle";
import { AutoBreadcrumb } from "@/components/common/AutoBreadcrumb";
import { useUserStore } from "@/store/userStore";
import { useRouterState } from "@tanstack/react-router";
import { api, setToken } from "@/lib/apiClient";
import { toast } from "sonner";

const SELLER_NAV = [
  { title: "Dashboard", url: "/seller/dashboard", icon: LayoutDashboard },
  { title: "Services", url: "/seller/services", icon: Wrench },
  { title: "Requests", url: "/seller/requests", icon: ListChecks },
  { title: "Balance", url: "/seller/balance", icon: Wallet },
];

function NavList() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  return (
    <SidebarGroup>
      <SidebarGroupLabel>Seller Panel</SidebarGroupLabel>
      <SidebarGroupContent>
        <SidebarMenu>
          {SELLER_NAV.map((item) => {
            const active = pathname === item.url || pathname.startsWith(item.url + "/");
            return (
              <SidebarMenuItem key={item.url}>
                <SidebarMenuButton asChild isActive={active} tooltip={item.title}>
                  <Link to={item.url as any}><item.icon /><span>{item.title}</span></Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            );
          })}
        </SidebarMenu>
      </SidebarGroupContent>
    </SidebarGroup>
  );
}

export function SellerShell() {
  const seller = useUserStore((s) => s.seller);
  const logoutSeller = useUserStore((s) => s.logoutSeller);
  const navigate = useNavigate();
  const qc = useQueryClient();

  const me = useQuery({
    queryKey: ["seller", "me"],
    queryFn: () => api.get<{ online: boolean; companyName: string }>("/api/manual-providers/seller/me"),
  });
  // The @handle shown on public profiles (buyer looking at this seller,
  // this seller looking at a buyer) — never the real email/phone.
  const myUsername = useQuery({
    queryKey: ["seller", "my-username"],
    queryFn: () => api.get<{ username: string }>("/api/manual-providers/my-username"),
  });

  // Real, cross-device notifications (new open requests, new bid
  // decisions etc.) — see backend routes/manualProviders.ts my-notifications.
  const notifs = useQuery({
    queryKey: ["seller", "notifications"],
    queryFn: () => api.get<Array<{ id: string; title: string; body: string; type: string; read: boolean; createdAt: string }>>("/api/manual-providers/my-notifications"),
    refetchInterval: 15000,
  });
  const unread = (notifs.data ?? []).filter((n) => !n.read).length;
  const markAllRead = async () => {
    try { await api.post("/api/manual-providers/my-notifications/read-all"); qc.invalidateQueries({ queryKey: ["seller", "notifications"] }); } catch { /* best-effort */ }
  };

  const toggleOnline = async (online: boolean) => {
    try {
      await api.patch("/api/manual-providers/seller/online", { online });
      qc.invalidateQueries({ queryKey: ["seller", "me"] });
      toast.success(online ? "You're online — new requests can reach you" : "You're offline — no new requests will be assigned");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not update availability");
    }
  };

  const handleLogout = () => {
    setToken(null);
    logoutSeller();
    navigate({ to: "/login" });
  };

  return (
    <SidebarProvider>
      <div className="flex min-h-screen w-full">
        <Sidebar collapsible="icon">
          <SidebarHeader className="px-3 py-4"><Logo to="/seller/dashboard" /></SidebarHeader>
          <SidebarContent><NavList /></SidebarContent>
          <SidebarFooter className="px-3 py-3 text-xs text-muted-foreground">Seller Panel</SidebarFooter>
        </Sidebar>

        <div className="flex-1 flex flex-col min-w-0">
          <header className="sticky top-0 z-30 glass border-b">
            <div className="flex h-14 items-center gap-1.5 px-3 sm:gap-2 sm:px-4" style={{ paddingTop: "env(safe-area-inset-top)" }}>
              <SidebarTrigger className="md:inline-flex hidden" />
              <div className="md:hidden shrink-0"><Logo to="/seller/dashboard" /></div>
              <div className="flex-1" />
              {me.data && (
                <label className="flex items-center gap-2 rounded-lg border px-2.5 h-8 sm:h-9 text-xs sm:text-sm">
                  <Switch checked={me.data.online} onCheckedChange={toggleOnline} />
                  <span className={me.data.online ? "text-success font-medium" : "text-muted-foreground"}>{me.data.online ? "Online" : "Offline"}</span>
                </label>
              )}
              <Button asChild size="sm" variant="outline" className="hidden sm:inline-flex h-8 sm:h-9 text-xs sm:text-sm">
                <Link to={"/dashboard" as any}><LayoutDashboard className="h-4 w-4 mr-1" />User Panel</Link>
              </Button>
              <ThemeToggle />
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="ghost" size="icon" aria-label="Notifications" className="relative">
                    <Bell className="h-4 w-4" />
                    {unread > 0 && <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-primary" />}
                  </Button>
                </PopoverTrigger>
                <PopoverContent align="end" className="w-80 p-0">
                  <div className="flex items-center justify-between p-3 border-b">
                    <p className="font-semibold text-sm">Notifications</p>
                    <button className="text-xs text-primary hover:underline" onClick={markAllRead}>Mark all read</button>
                  </div>
                  <div className="max-h-80 overflow-auto">
                    {(notifs.data ?? []).map((n) => (
                      <div key={n.id} className={n.read ? "p-3 border-b last:border-b-0" : "p-3 border-b last:border-b-0 bg-accent/30"}>
                        <p className="text-sm font-medium">{n.title}</p>
                        <p className="mt-0.5 text-xs text-muted-foreground">{n.body}</p>
                        <p className="mt-0.5 text-[10px] text-muted-foreground">{timeAgo(n.createdAt)}</p>
                      </div>
                    ))}
                    {(notifs.data ?? []).length === 0 && <p className="p-6 text-center text-xs text-muted-foreground">No notifications yet.</p>}
                  </div>
                </PopoverContent>
              </Popover>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" className="rounded-full" aria-label="Profile">
                    <Avatar className="h-8 w-8"><AvatarFallback>{seller?.name?.[0] ?? "S"}</AvatarFallback></Avatar>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56">
                  <DropdownMenuLabel>
                    <p className="text-sm font-medium">{me.data?.companyName ?? seller?.name ?? "Seller"}</p>
                    <p className="text-xs text-muted-foreground truncate">{myUsername.data ? `@${myUsername.data.username}` : seller?.email ?? "—"}</p>
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem asChild><Link to={"/dashboard/profile" as any}><UserIcon className="mr-2 h-4 w-4" />Profile</Link></DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={handleLogout}><LogOut className="mr-2 h-4 w-4" />Log out</DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
            <div className="hidden px-3 pb-2 sm:block sm:px-4"><AutoBreadcrumb /></div>
          </header>
          <main className="flex-1 overflow-x-hidden p-3 pb-6 sm:p-6 lg:p-8">
            <Outlet />
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}
