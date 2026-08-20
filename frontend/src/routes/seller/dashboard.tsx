import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { PageHeader } from "@/components/common/PageHeader";
import { StatCard } from "@/components/common/StatCard";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Wallet, CheckCircle2, XCircle, TrendingUp, Clock, Percent, Star, Landmark } from "lucide-react";
import { api } from "@/lib/apiClient";
import { money } from "@/utils/format";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";

interface SellerMe {
  companyName: string; status: string; online: boolean; pendingBalance: number; availableBalance: number;
  totalEarnings: number; totalPaidOut: number; completedRequests: number; failedRequests: number;
  successRate: number | null; activeRequests: number; todayEarnings: number;
}

export default function SellerDashboard() {
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ["seller", "me"], queryFn: () => api.get<SellerMe>("/api/manual-providers/seller/me") });
  const s = q.data;

  const withdrawM = useMutation({
    mutationFn: () => api.post("/api/manual-providers/seller/withdraw"),
    onSuccess: () => {
      toast.success("Withdrawal requested — admin will approve and pay it out");
      qc.invalidateQueries({ queryKey: ["seller", "me"] });
      qc.invalidateQueries({ queryKey: ["seller", "settlements"] });
    },
    onError: (e: any) => toast.error(e?.message || "Could not request withdrawal"),
  });

  return (
    <div>
      <PageHeader
        title="Seller Dashboard"
        description="Your Manual Provider performance and earnings."
        actions={s && s.pendingBalance > 0 && (
          <Button className="gradient-brand" disabled={withdrawM.isPending} onClick={() => withdrawM.mutate()}>
            <Landmark className="h-4 w-4 mr-1" />{withdrawM.isPending ? "Requesting…" : `Withdraw ${money(s.pendingBalance)}`}
          </Button>
        )}
      />
      {q.isLoading || !s ? (
        <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-28 rounded-2xl" />)}
        </div>
      ) : (
        <>
          <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
            <StatCard label="Available balance" value={money(s.availableBalance)} icon={Wallet} tone="success" />
            <StatCard label="Pending earnings" value={money(s.pendingBalance)} icon={Clock} tone="warning" />
            <StatCard label="Today's earnings" value={money(s.todayEarnings)} icon={TrendingUp} tone="brand" />
            <StatCard label="Total earnings" value={money(s.totalEarnings)} icon={Wallet} tone="info" />
          </div>
          <div className="mt-4 grid gap-4 grid-cols-2 lg:grid-cols-4">
            <StatCard label="Active requests" value={String(s.activeRequests)} icon={Clock} tone="info" />
            <StatCard label="Completed" value={String(s.completedRequests)} icon={CheckCircle2} tone="success" />
            <StatCard label="Failed" value={String(s.failedRequests)} icon={XCircle} tone="warning" />
            <StatCard label="Success rate" value={s.successRate === null ? "—" : `${s.successRate}%`} icon={Percent} tone="brand" />
          </div>
          <Card className="mt-6 shadow-soft">
            <CardHeader><CardTitle className="text-base flex items-center gap-2"><Star className="h-4 w-4" />Status</CardTitle></CardHeader>
            <CardContent className="text-sm text-muted-foreground">
              <p><span className="font-medium text-foreground">{s.companyName}</span> — account is {s.status}, currently {s.online ? <span className="text-success font-medium">online</span> : <span>offline</span>}.</p>
              <p className="mt-1">Toggle your online/offline status from the switch in the top header. Requesting a withdrawal batches your pending earnings for admin to approve and pay out.</p>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
