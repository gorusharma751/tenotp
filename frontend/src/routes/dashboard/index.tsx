import { Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { PageHeader } from "@/components/common/PageHeader";
import { StatCard } from "@/components/common/StatCard";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Wallet, Package, Inbox, Clock, ShoppingCart, KeyRound, CreditCard, Bell, ArrowRight, Sparkles, Headphones, Megaphone } from "lucide-react";
import { InstallAppButton } from "@/components/common/InstallAppButton";
import { api } from "@/lib/apiClient";
import { money, timeAgo } from "@/utils/format";
import { useUserStore } from "@/store/userStore";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";

interface Order {
  id: string;
  service: string;
  country: string;
  number: string;
  status: string;
  otp?: string;
  price: number;
  createdAt: string;
  expiresAt: string;
}

// Ported from src/routes/dashboard.index.tsx. The monolith's per-user
// analytics charts (`analyticsApi.overview`) and "popular services"
// (`analyticsApi.popularServices`) had no equivalent REST endpoint ported to
// the backend, so those two sections were dropped rather than invented.
export default function Overview() {
  const NOTIFS = [
    { id: "n1", title: "OTP received for your last order", time: "just now" },
    { id: "n2", title: `Deposit ${money(25 * 85)} completed`, time: "2h ago" },
    { id: "n3", title: "Ticket #tkt_301 replied", time: "1d ago" },
  ];
  const navigate = useNavigate();
  const user = useUserStore((s) => s.user);
  const wallet = useQuery({ queryKey: ["wallet", "balance"], queryFn: () => api.get<{ balance: number }>("/api/wallet/balance") });
  const orders = useQuery({ queryKey: ["orders", "recent"], queryFn: () => api.get<Order[]>("/api/otp/my-orders") });

  const walletBalance = Number(wallet.data?.balance ?? user?.wallet ?? 0);
  const active = (orders.data ?? []).filter((o) => o.status === "pending").length;
  const received = (orders.data ?? []).filter((o) => o.status === "received").length;

  return (
    <div>
      {/* Welcome */}
      <Card className="shadow-glow border-primary/10 mb-6 overflow-hidden">
        <CardContent className="p-6 grid gap-4 md:grid-cols-[1fr_auto] items-center relative">
          <div className="absolute -right-8 -top-8 h-40 w-40 rounded-full bg-primary/10 blur-3xl -z-10" />
          <div>
            <p className="text-sm text-muted-foreground">Welcome back</p>
            <h1 className="text-2xl sm:text-3xl font-bold mt-1">{user?.name ?? "there"} 👋</h1>
            <p className="mt-1 text-sm text-muted-foreground">Wallet balance: <span className="font-semibold text-foreground">{money(walletBalance)}</span></p>
          </div>
          <div className="flex flex-wrap gap-2">
            {/* Plain declarative Link kept getting reported as "button does
                nothing" on this specific route, repeatedly, even after
                confirming the route/component/API all work — switched to
                an explicit onClick + navigate() so a click can never be
                silently swallowed by any asChild/Slot prop-merging quirk,
                and any real navigation error surfaces as a toast instead
                of nothing happening. */}
            <Button
              className="gradient-brand"
              onClick={() => {
                // Fires the instant the tap is actually received by this
                // button — separates "the click never reached the handler"
                // from "the handler ran but navigation didn't change the
                // page", since reports of this exact button not working
                // gave no visible signal either way to tell which.
                toast.info("Opening Buy Number…");
                navigate({ to: "/dashboard/buy-number" }).catch((e) =>
                  toast.error(e instanceof Error ? e.message : "Could not open Buy Number"),
                );
              }}
            >
              <ShoppingCart className="h-4 w-4 mr-1" />Buy number
            </Button>
            <Button asChild variant="outline"><Link to="/dashboard/deposit"><CreditCard className="h-4 w-4 mr-1" />Deposit</Link></Button>
          </div>
        </CardContent>
      </Card>

      {/* Quick trio: Help · SMM panel · Install app */}
      <Card className="shadow-soft border-primary/20 mb-6">
        <CardContent className="p-4 grid gap-4 sm:grid-cols-3 divide-y sm:divide-y-0 sm:divide-x divide-border">
          <div className="flex flex-col gap-3 sm:pr-4 pt-0">
            <div className="flex items-center gap-3">
              <div className="grid h-10 w-10 place-items-center rounded-xl bg-primary/10 text-primary shrink-0">
                <Headphones className="h-5 w-5" />
              </div>
              <div className="min-w-0">
                <p className="font-semibold leading-tight">24×7 Support</p>
                <p className="text-xs text-muted-foreground">Open a ticket, we reply fast.</p>
              </div>
            </div>
            <Button asChild className="gradient-brand mt-auto"><Link to="/dashboard/support"><Headphones className="h-4 w-4 mr-1" />Get help</Link></Button>
          </div>
          <div className="flex flex-col gap-3 sm:px-4 pt-4 sm:pt-0">
            <div className="flex items-center gap-3">
              <div className="grid h-10 w-10 place-items-center rounded-xl bg-red-500/10 text-red-600 shrink-0">
                <Megaphone className="h-5 w-5" />
              </div>
              <div className="min-w-0">
                <p className="font-semibold leading-tight">SMM Panel</p>
                <p className="text-xs text-muted-foreground">Grow social with our SMM services.</p>
              </div>
            </div>
            <Button asChild className="bg-red-600 hover:bg-red-700 text-white mt-auto">
              <a href="https://ssmpanal.lovable.app" target="_blank" rel="noopener noreferrer">Open SMM Panel</a>
            </Button>
          </div>
          <div className="flex flex-col gap-3 sm:pl-4 pt-4 sm:pt-0">
            <div className="flex items-center gap-3">
              <div className="grid h-10 w-10 place-items-center rounded-xl bg-primary/10 text-primary shrink-0">
                <Sparkles className="h-5 w-5" />
              </div>
              <div className="min-w-0">
                <p className="font-semibold leading-tight">Get the App</p>
                <p className="text-xs text-muted-foreground">Install TenOTP on your device.</p>
              </div>
            </div>
            <InstallAppButton className="gradient-brand mt-auto" />
          </div>
        </CardContent>
      </Card>

      {/* KPIs */}
      <div className="grid gap-4 grid-cols-2 lg:grid-cols-4 mb-6">
        {orders.isLoading ? Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-28 rounded-2xl" />) : (
          <>
            <StatCard label="Wallet" value={money(walletBalance)} icon={Wallet} tone="brand" />
            <StatCard label="Active orders" value={String(active)} delta={`${received} completed`} icon={Package} tone="info" />
            <StatCard label="Pending OTP" value={String(active)} icon={Inbox} tone="warning" />
            <StatCard label="Completed" value={String(received)} icon={Clock} tone="success" />
          </>
        )}
      </div>

      {/* Quick actions */}
      <div className="grid gap-3 grid-cols-2 lg:grid-cols-4 mb-6">
        {[
          { to: "/dashboard/buy-number", label: "Buy Number", icon: ShoppingCart },
          { to: "/dashboard/deposit", label: "Deposit", icon: CreditCard },
          { to: "/dashboard/api-keys", label: "API Keys", icon: KeyRound },
          { to: "/dashboard/tickets", label: "Tickets", icon: Bell },
        ].map((a) => (
          <Link key={a.to} to={a.to as any}>
            <Card className="shadow-soft hover:shadow-glow transition-all hover:-translate-y-0.5 h-full">
              <CardContent className="p-4 flex items-center gap-3">
                <div className="grid h-10 w-10 place-items-center rounded-xl bg-primary/10 text-primary"><a.icon className="h-5 w-5" /></div>
                <span className="font-medium">{a.label}</span>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>

      {/* Recent + Notifications */}
      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="shadow-soft lg:col-span-2">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Recent orders</CardTitle>
            <Button asChild variant="ghost" size="sm"><Link to="/dashboard/orders">All <ArrowRight className="h-3 w-3 ml-1" /></Link></Button>
          </CardHeader>
          <CardContent className="p-0">
            <div className="divide-y">
              {(orders.data ?? []).slice(0, 6).map((o) => (
                <div key={o.id} className="flex items-center justify-between px-6 py-3 gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">{o.service} · {o.country}</p>
                    <p className="text-xs text-muted-foreground">{o.number} · {timeAgo(o.createdAt)}</p>
                  </div>
                  <div className="flex items-center gap-3">
                    {o.otp && <span className="font-mono text-sm">{o.otp}</span>}
                    <Badge variant={o.status === "received" ? "default" : o.status === "pending" ? "secondary" : "outline"}>{o.status}</Badge>
                  </div>
                </div>
              ))}
              {!orders.isLoading && (orders.data ?? []).length === 0 && (
                <p className="px-6 py-8 text-center text-sm text-muted-foreground">No orders yet.</p>
              )}
            </div>
          </CardContent>
        </Card>
        <Card className="shadow-soft">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="flex items-center gap-2"><Bell className="h-4 w-4" /> Notifications</CardTitle>
            <Button asChild variant="ghost" size="sm"><Link to="/dashboard/notifications">All</Link></Button>
          </CardHeader>
          <CardContent className="p-0">
            <div className="divide-y">
              {NOTIFS.map((n) => (
                <div key={n.id} className="px-5 py-3">
                  <p className="text-sm font-medium">{n.title}</p>
                  <p className="text-xs text-muted-foreground">{n.time}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
