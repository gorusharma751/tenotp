import { Outlet, Link, useRouterState, useNavigate } from "@tanstack/react-router";
import {
  Sidebar, SidebarContent, SidebarGroup, SidebarGroupContent, SidebarGroupLabel,
  SidebarMenu, SidebarMenuButton, SidebarMenuItem, SidebarProvider, SidebarTrigger,
  SidebarHeader, SidebarFooter, useSidebar,
} from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Bell, LogOut, Search, User as UserIcon, Settings, ShieldCheck, LayoutDashboard, Wallet } from "lucide-react";
import { Logo } from "@/components/brand/Logo";
import { ThemeToggle } from "@/components/common/ThemeToggle";
import { CurrencyToggle } from "@/components/common/CurrencyToggle";
import { AutoBreadcrumb } from "@/components/common/AutoBreadcrumb";
import { useNotificationStore } from "@/store/notificationStore";
import { useUserStore } from "@/store/userStore";
import type { NavItem } from "@/constants/nav";
import { cn } from "@/lib/utils";
import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { api, setToken } from "@/lib/apiClient";
import { money } from "@/utils/format";
import { TelegramJoinDialog } from "@/components/dashboard/TelegramJoinDialog";
import { useContactLinks } from "@/hooks/useContactLinks";
import { MobileTabBar } from "@/components/common/MobileTabBar";
import { Send } from "lucide-react";

interface Props { nav: NavItem[]; role: "user" | "admin"; profileRoot: string }

function NavGroups({ nav }: { nav: NavItem[] }) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const { state, isMobile, setOpenMobile } = useSidebar();
  const collapsed = state === "collapsed";
  const groups = useMemo(() => {
    const map = new Map<string, NavItem[]>();
    nav.forEach((n) => {
      const g = n.group ?? "Main";
      if (!map.has(g)) map.set(g, []);
      map.get(g)!.push(n);
    });
    return Array.from(map.entries());
  }, [nav]);

  return (
    <>
      {groups.map(([groupName, items]) => (
        <SidebarGroup key={groupName}>
          {!collapsed && <SidebarGroupLabel>{groupName}</SidebarGroupLabel>}
          <SidebarGroupContent>
            <SidebarMenu>
              {items.map((item) => {
                const active = pathname === item.url || pathname.startsWith(item.url + "/");
                return (
                  <SidebarMenuItem key={item.url}>
                    <SidebarMenuButton asChild isActive={active} tooltip={item.title}>
                      <Link to={item.url as any} className="flex items-center gap-2" onClick={() => { if (isMobile) setOpenMobile(false); }}>
                        <item.icon className="h-4 w-4" />
                        <span>{item.title}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      ))}
    </>
  );
}

export function DashboardShell({ nav, role, profileRoot }: Props) {
  const notifications = useNotificationStore((s) => s.items);
  const markAllRead = useNotificationStore((s) => s.markAllRead);
  const unread = notifications.filter((n) => !n.read).length;
  const { user, admin, logoutUser, logoutAdmin } = useUserStore();
  const current = role === "admin" ? admin : user;
  const navigate = useNavigate();
  const isAdminUser = !!admin;
  const wallet = useQuery({
    queryKey: ["wallet", "balance"],
    queryFn: () => api.get<{ balance: number }>("/api/wallet/balance"),
    enabled: role === "user" && !!user,
    refetchOnWindowFocus: true,
  });
  const walletBalance = Number(wallet.data?.balance ?? user?.wallet ?? 0);
  const contact = useContactLinks();
  const telegramUrl = contact.data?.telegramGroup || contact.data?.telegramSupport || "";

  const handleLogout = () => {
    // Session token lives in localStorage now (see lib/apiClient.ts) — clear
    // it alongside the store on logout, not just the store.
    setToken(null);
    if (role === "admin") { logoutAdmin(); navigate({ to: "/gourav-ankit-adi" as any }); }
    else { logoutUser(); navigate({ to: "/login" }); }
  };

  return (
    <SidebarProvider>
      <div className="flex min-h-screen w-full">
        <Sidebar collapsible="icon">
          <SidebarHeader className="px-3 py-4">
            <Logo to={role === "admin" ? "/gourav-ankit-adi/dashboard" : "/dashboard"} />
          </SidebarHeader>
          <SidebarContent><NavGroups nav={nav} /></SidebarContent>
          <SidebarFooter className="px-3 py-3 text-xs text-muted-foreground">
            {role === "admin" ? "Admin Console" : "v1.0"}
          </SidebarFooter>
        </Sidebar>

        <div className="flex-1 flex flex-col min-w-0">
          <header className="sticky top-0 z-30 glass border-b">
            <div className="flex h-14 items-center gap-1.5 px-3 sm:gap-2 sm:px-4" style={{ paddingTop: "env(safe-area-inset-top)" }}>
              <SidebarTrigger className="md:inline-flex hidden" />
              <div className="md:hidden shrink-0"><Logo to={role === "admin" ? "/gourav-ankit-adi/dashboard" : "/dashboard"} /></div>
              <div className="relative hidden md:block flex-1 max-w-md">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input placeholder="Search orders, numbers, tickets..." className="pl-9 bg-background/60" />
              </div>
              <div className="flex-1 md:hidden" />
              {isAdminUser && (
                role === "admin" ? (

                  <Button asChild size="sm" variant="outline" className="hidden sm:inline-flex h-8 sm:h-9 text-xs sm:text-sm">
                    <Link to={"/dashboard" as any}><LayoutDashboard className="h-4 w-4 mr-1" />User Panel</Link>
                  </Button>
                ) : (
                  <Button asChild size="sm" className="gradient-brand h-8 sm:h-9 text-xs sm:text-sm px-2 sm:px-3">
                    <Link to={"/gourav-ankit-adi/dashboard" as any}><ShieldCheck className="h-4 w-4 mr-1" />Admin Panel</Link>
                  </Button>
                )
              )}
              {role === "user" && (
                <Button asChild size="sm" variant="outline" className="h-8 sm:h-9 gap-1.5 px-2 sm:px-3 text-xs sm:text-sm">
                  <Link to={"/dashboard/wallet" as any}>
                    <Wallet className="h-4 w-4" />
                    <span>{money(walletBalance)}</span>
                  </Link>
                </Button>
              )}
              {role === "user" && telegramUrl && (
                <Button
                  asChild
                  size="sm"
                  className="h-8 sm:h-9 gap-1.5 px-2 sm:px-3 text-xs sm:text-sm bg-[#229ED9] hover:bg-[#1b8bc0] text-white shadow-glow animate-pulse hover:animate-none"
                  title="Join our Telegram"
                >
                  <a href={telegramUrl} target="_blank" rel="noopener noreferrer" aria-label="Telegram">
                    <Send className="h-4 w-4" />
                    <span className="hidden sm:inline">Telegram</span>
                  </a>
                </Button>
              )}
              <CurrencyToggle />
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
                    {notifications.map((n) => (
                      <div key={n.id} className={cn("p-3 border-b last:border-b-0", !n.read && "bg-accent/30")}>
                        <div className="flex items-center justify-between">
                          <p className="text-sm font-medium">{n.title}</p>
                          <Badge variant="outline" className="text-[10px]">{n.type}</Badge>
                        </div>
                        <p className="mt-0.5 text-xs text-muted-foreground">{n.body}</p>
                      </div>
                    ))}
                  </div>
                </PopoverContent>
              </Popover>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" className="rounded-full" aria-label="Profile">
                    <Avatar className="h-8 w-8">
                      <AvatarFallback>{current?.name?.[0] ?? "G"}</AvatarFallback>
                    </Avatar>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56">
                  <DropdownMenuLabel>
                    <p className="text-sm font-medium">{current?.name ?? "Guest"}</p>
                    <p className="text-xs text-muted-foreground truncate">{current?.email ?? "—"}</p>
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem asChild><Link to={profileRoot as any}><UserIcon className="mr-2 h-4 w-4" />Profile</Link></DropdownMenuItem>
                  <DropdownMenuItem asChild><Link to={(role === "admin" ? "/gourav-ankit-adi/settings" : "/dashboard/settings") as any}><Settings className="mr-2 h-4 w-4" />Settings</Link></DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={handleLogout}><LogOut className="mr-2 h-4 w-4" />Log out</DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
            <div className="hidden px-3 pb-2 sm:block sm:px-4"><AutoBreadcrumb /></div>
          </header>
          <main className="flex-1 overflow-x-hidden p-3 pb-24 sm:p-6 sm:pb-6 lg:p-8">
            <Outlet />
          </main>
          <MobileTabBar role={role} />
          {role === "user" && <TelegramJoinDialog />}

        </div>
      </div>
    </SidebarProvider>
  );
}
