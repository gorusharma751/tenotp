import { useQuery } from "@tanstack/react-query";
import { PageHeader } from "@/components/common/PageHeader";
import { StatCard } from "@/components/common/StatCard";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Store, Wifi, Clock, CheckCircle2, XCircle, IndianRupee, Percent, Landmark } from "lucide-react";
import { api } from "@/lib/apiClient";
import { money } from "@/utils/format";
import { Skeleton } from "@/components/ui/skeleton";
import { AreaMini, BarMini } from "@/components/charts/MiniChart";

interface DashboardStats {
  activeProviders: number; onlineProviders: number; activeRequests: number; completedRequests: number; failedRequests: number;
  totalRevenue: number; platformRevenue: number; providerEarnings: number; pendingSettlements: number; avgSuccessRate: number;
  daily: Array<{ date: string; requests: number; revenue: number; platformRevenue: number }>;
}

export default function AdminManualProviderDashboard() {
  const q = useQuery({ queryKey: ["admin", "mp", "dashboard"], queryFn: () => api.get<DashboardStats>("/api/manual-providers/admin/dashboard") });
  const s = q.data;
  const requestsSeries = (s?.daily ?? []).map((d) => ({ label: d.date.slice(5), value: d.requests }));
  const revenueSeries = (s?.daily ?? []).map((d) => ({ label: d.date.slice(5), value: d.revenue }));

  return (
    <div>
      <PageHeader title="Manual Provider — Dashboard" description="Marketplace-wide stats for the human-fulfilled provider module." />
      {q.isLoading || !s ? (
        <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">{Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-28 rounded-2xl" />)}</div>
      ) : (
        <>
          <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
            <StatCard label="Active providers" value={String(s.activeProviders)} icon={Store} tone="brand" />
            <StatCard label="Online now" value={String(s.onlineProviders)} icon={Wifi} tone="success" />
            <StatCard label="Active requests" value={String(s.activeRequests)} icon={Clock} tone="warning" />
            <StatCard label="Pending settlements" value={String(s.pendingSettlements)} icon={Landmark} tone="info" />
          </div>
          <div className="mt-4 grid gap-4 grid-cols-2 lg:grid-cols-4">
            <StatCard label="Completed" value={String(s.completedRequests)} icon={CheckCircle2} tone="success" />
            <StatCard label="Failed / refunded" value={String(s.failedRequests)} icon={XCircle} tone="warning" />
            <StatCard label="Avg success rate" value={`${s.avgSuccessRate}%`} icon={Percent} tone="brand" />
            <StatCard label="Total revenue" value={money(s.totalRevenue)} icon={IndianRupee} tone="info" />
          </div>
          <div className="mt-4 grid gap-4 grid-cols-2 lg:grid-cols-4">
            <StatCard label="Platform revenue" value={money(s.platformRevenue)} icon={IndianRupee} tone="success" />
            <StatCard label="Provider earnings" value={money(s.providerEarnings)} icon={IndianRupee} tone="brand" />
          </div>

          <div className="mt-6 grid gap-4 lg:grid-cols-2">
            <Card className="shadow-soft"><CardHeader><CardTitle>Daily requests (14d)</CardTitle></CardHeader><CardContent><AreaMini data={requestsSeries} /></CardContent></Card>
            <Card className="shadow-soft"><CardHeader><CardTitle>Daily revenue (14d)</CardTitle></CardHeader><CardContent><BarMini data={revenueSeries} /></CardContent></Card>
          </div>
        </>
      )}
    </div>
  );
}
