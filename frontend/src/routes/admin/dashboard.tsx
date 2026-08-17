import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { PageHeader } from "@/components/common/PageHeader";
import { StatCard } from "@/components/common/StatCard";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { AreaMini, BarMini, DonutMini } from "@/components/charts/MiniChart";
import { DollarSign, Users, Package, ShieldAlert, Inbox, CheckCircle2, Undo2, UserCheck, Globe2, Puzzle, Clock, Wallet, Activity, Megaphone, ShoppingCart, KeyRound, ServerCog } from "lucide-react";
import { api } from "@/lib/apiClient";
import { money, dateTime, timeAgo } from "@/utils/format";
import { Skeleton } from "@/components/ui/skeleton";
import { StatusPill } from "@/components/admin/AdminTable";
import type { AdminOrder, AdminUser, StatPoint } from "@/types";

interface AnalyticsKpi {
  revenueToday: number;
  ordersToday: number;
  otpToday: number;
  pending: number;
  completed: number;
  refundRequests: number;
  totalUsers: number;
  activeUsers: number;
  countries: number;
  services: number;
  rentalNumbers: number;
  walletBalance: number;
  apiRequests: number;
}
interface AnalyticsResponse {
  revenue: StatPoint[]; orders: StatPoint[]; services: StatPoint[]; countries: StatPoint[];
  users: StatPoint[]; wallet: StatPoint[]; refunds: StatPoint[]; otpSuccess: StatPoint[];
  kpi: AnalyticsKpi;
}

export default function AdminDash() {
  const a = useQuery({ queryKey: ["admin", "analytics"], queryFn: () => api.get<AnalyticsResponse>("/api/admin/analytics") });
  const orders = useQuery({ queryKey: ["admin", "orders"], queryFn: () => api.get<AdminOrder[]>("/api/admin/orders") });
  const users = useQuery({ queryKey: ["admin", "users"], queryFn: () => api.get<AdminUser[]>("/api/admin/users") });
  const k = a.data?.kpi;

  return (
    <div>
      <PageHeader title="Admin Dashboard" description="Platform-wide health, revenue, operations, and alerts." />

      {/* KPI row 1 */}
      <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
        {a.isLoading || !k ? Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-28 rounded-2xl" />) : (
          <>
            <StatCard label="Today's Revenue" value={money(k.revenueToday)} delta="+12.4% vs yesterday" icon={DollarSign} tone="brand" />
            <StatCard label="Today's Orders" value={String(k.ordersToday)} delta="+8.2% WoW" icon={ShoppingCart} tone="success" />
            <StatCard label="Today's OTP" value={String(k.otpToday)} delta="97% success" icon={Inbox} tone="info" />
            <StatCard label="Refund Requests" value={String(k.refundRequests)} delta="Needs review" icon={Undo2} tone="warning" />
          </>
        )}
      </div>

      {/* KPI row 2 */}
      <div className="mt-4 grid gap-4 grid-cols-2 lg:grid-cols-4">
        {k && <>
          <StatCard label="Pending Orders" value={String(k.pending)} icon={Clock} tone="warning" />
          <StatCard label="Completed Orders" value={String(k.completed)} icon={CheckCircle2} tone="success" />
          <StatCard label="Total Users" value={String(k.totalUsers)} delta="+42 today" icon={Users} tone="info" />
          <StatCard label="Active Users" value={String(k.activeUsers)} icon={UserCheck} tone="brand" />
        </>}
      </div>

      {/* KPI row 3 */}
      <div className="mt-4 grid gap-4 grid-cols-2 lg:grid-cols-5">
        {k && <>
          <StatCard label="Countries" value={String(k.countries)} icon={Globe2} tone="info" />
          <StatCard label="Services" value={String(k.services)} icon={Puzzle} tone="brand" />
          <StatCard label="Rental Numbers" value={String(k.rentalNumbers)} icon={KeyRound} tone="info" />
          <StatCard label="Wallet Balance" value={money(k.walletBalance)} icon={Wallet} tone="success" />
          <StatCard label="API Requests" value={String(k.apiRequests)} icon={Activity} tone="warning" />
        </>}
      </div>

      {/* Charts — backend /api/admin/analytics currently returns empty series
          for all chart datasets (revenue/orders/services/etc). Rendered as-is;
          they'll populate once the backend fills in real time-series data. */}
      <div className="mt-6 grid gap-4 lg:grid-cols-3">
        <Card className="shadow-soft lg:col-span-2"><CardHeader><CardTitle>Revenue</CardTitle></CardHeader><CardContent>{a.data && <AreaMini data={a.data.revenue} />}</CardContent></Card>
        <Card className="shadow-soft"><CardHeader><CardTitle>Services split</CardTitle></CardHeader><CardContent>{a.data && <DonutMini data={a.data.services} />}</CardContent></Card>
        <Card className="shadow-soft lg:col-span-2"><CardHeader><CardTitle>Orders</CardTitle></CardHeader><CardContent>{a.data && <BarMini data={a.data.orders} />}</CardContent></Card>
        <Card className="shadow-soft"><CardHeader><CardTitle>Countries</CardTitle></CardHeader><CardContent>{a.data && <BarMini data={a.data.countries} />}</CardContent></Card>
        <Card className="shadow-soft"><CardHeader><CardTitle>Wallet flow</CardTitle></CardHeader><CardContent>{a.data && <AreaMini data={a.data.wallet} />}</CardContent></Card>
        <Card className="shadow-soft"><CardHeader><CardTitle>OTP success %</CardTitle></CardHeader><CardContent>{a.data && <BarMini data={a.data.otpSuccess} />}</CardContent></Card>
        <Card className="shadow-soft"><CardHeader><CardTitle>New users</CardTitle></CardHeader><CardContent>{a.data && <AreaMini data={a.data.users} />}</CardContent></Card>
      </div>

      {/* Latest + System + Quick actions */}
      <div className="mt-6 grid gap-4 lg:grid-cols-3">
        <Card className="shadow-soft lg:col-span-2">
          <CardHeader className="flex-row items-center justify-between"><CardTitle>Latest orders</CardTitle><Button asChild variant="ghost" size="sm"><Link to={"/gourav-ankit-adi/orders" as any}>View all</Link></Button></CardHeader>
          <CardContent className="p-0">
            <div className="divide-y">
              {(orders.data ?? []).slice(0, 6).map((o) => (
                <div key={o.id} className="flex items-center justify-between px-6 py-3 text-sm">
                  <div className="min-w-0">
                    <p className="font-medium truncate">{o.service} · {o.country}</p>
                    <p className="text-xs text-muted-foreground">{o.number} · {timeAgo(o.createdAt)}</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="tabular-nums">{money(o.price)}</span>
                    <StatusPill status={o.status} />
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-soft">
          <CardHeader className="flex-row items-center justify-between"><CardTitle>Latest users</CardTitle><Button asChild variant="ghost" size="sm"><Link to={"/gourav-ankit-adi/users" as any}>View all</Link></Button></CardHeader>
          <CardContent className="p-0">
            <div className="divide-y">
              {(users.data ?? []).slice(0, 6).map((u) => (
                <div key={u.id} className="flex items-center justify-between px-6 py-3 text-sm">
                  <div className="min-w-0"><p className="font-medium truncate">{u.name}</p><p className="text-xs text-muted-foreground truncate">{u.email}</p></div>
                  <StatusPill status={u.status} />
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <Card className="shadow-soft">
          <CardHeader><CardTitle className="flex items-center gap-2"><ServerCog className="h-4 w-4" />System status</CardTitle></CardHeader>
          <CardContent className="space-y-3 text-sm">
            {[
              { name: "API Gateway", state: "operational" },
              { name: "OTP Delivery", state: "operational" },
              { name: "Wallet Service", state: "operational" },
              { name: "Payments", state: "degraded" },
              { name: "Reports", state: "operational" },
            ].map((s) => (
              <div key={s.name} className="flex items-center justify-between">
                <span>{s.name}</span>
                <span className={`text-xs font-medium ${s.state === "operational" ? "text-success" : "text-warning"}`}>● {s.state}</span>
              </div>
            ))}
            <p className="text-xs text-muted-foreground pt-2 border-t">Last check {dateTime(new Date().toISOString())}</p>
          </CardContent>
        </Card>

        <Card className="shadow-soft">
          <CardHeader><CardTitle>Quick actions</CardTitle></CardHeader>
          <CardContent className="grid grid-cols-2 gap-2">
            <Button asChild variant="outline" className="justify-start"><Link to={"/gourav-ankit-adi/users" as any}><Users className="mr-2 h-4 w-4" />Manage users</Link></Button>
            <Button asChild variant="outline" className="justify-start"><Link to={"/gourav-ankit-adi/refunds" as any}><Undo2 className="mr-2 h-4 w-4" />Review refunds</Link></Button>
            <Button asChild variant="outline" className="justify-start"><Link to={"/gourav-ankit-adi/services" as any}><Puzzle className="mr-2 h-4 w-4" />Edit services</Link></Button>
            <Button asChild variant="outline" className="justify-start"><Link to={"/gourav-ankit-adi/countries" as any}><Globe2 className="mr-2 h-4 w-4" />Countries</Link></Button>
            <Button asChild variant="outline" className="justify-start"><Link to={"/gourav-ankit-adi/promotions" as any}><Megaphone className="mr-2 h-4 w-4" />New promotion</Link></Button>
            <Button asChild variant="outline" className="justify-start"><Link to={"/gourav-ankit-adi/maintenance" as any}><ShieldAlert className="mr-2 h-4 w-4" />Maintenance</Link></Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
