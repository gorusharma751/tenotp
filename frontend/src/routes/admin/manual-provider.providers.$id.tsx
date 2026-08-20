import { useParams } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { PageHeader } from "@/components/common/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatusPill } from "@/components/admin/AdminTable";
import { AdminTable } from "@/components/admin/AdminTable";
import { Skeleton } from "@/components/ui/skeleton";
import { api } from "@/lib/apiClient";
import { money, dateTime } from "@/utils/format";

interface ProviderDetail {
  id: string; email: string | null; companyName: string; status: string; online: boolean; priority: number;
  pendingBalance: number; availableBalance: number; totalEarnings: number; totalPaidOut: number;
  completedRequests: number; failedRequests: number; successRate: number | null;
  upiId: string | null; bankAccountName: string | null; bankAccountNumber: string | null; bankIfsc: string | null;
  services: Array<{ id: string; service: string; country: string; price: number | null; status: string; availability: string; completedRequests: number; failedRequests: number; successRate: number | null }>;
  recentRequests: Array<{ id: string; code: string; serviceName: string; country: string; price: number | null; status: string; createdAt: string }>;
}

export default function AdminManualProviderDetail() {
  const { id } = useParams({ strict: false }) as { id: string };
  const q = useQuery({ queryKey: ["admin", "mp", "provider", id], queryFn: () => api.get<ProviderDetail>(`/api/manual-providers/admin/providers/${id}`) });
  if (q.isLoading || !q.data) return <div className="space-y-4"><Skeleton className="h-10 w-1/3" /><Skeleton className="h-64" /></div>;
  const p = q.data;

  return (
    <div>
      <PageHeader title={p.companyName} description={p.email ?? ""} actions={<StatusPill status={p.status === "active" ? (p.online ? "active" : "pending") : "suspended"} />} />
      <div className="grid gap-4 lg:grid-cols-4 mb-6">
        <Card className="shadow-soft"><CardContent className="p-4"><p className="text-xs text-muted-foreground">Pending</p><p className="text-xl font-bold">{money(p.pendingBalance)}</p></CardContent></Card>
        <Card className="shadow-soft"><CardContent className="p-4"><p className="text-xs text-muted-foreground">Available</p><p className="text-xl font-bold">{money(p.availableBalance)}</p></CardContent></Card>
        <Card className="shadow-soft"><CardContent className="p-4"><p className="text-xs text-muted-foreground">Total earned</p><p className="text-xl font-bold">{money(p.totalEarnings)}</p></CardContent></Card>
        <Card className="shadow-soft"><CardContent className="p-4"><p className="text-xs text-muted-foreground">Paid out</p><p className="text-xl font-bold">{money(p.totalPaidOut)}</p></CardContent></Card>
      </div>

      <Card className="shadow-soft mb-6">
        <CardHeader><CardTitle className="text-base">Payout details</CardTitle></CardHeader>
        <CardContent className="grid gap-2 text-sm sm:grid-cols-2">
          <div><span className="text-muted-foreground">UPI ID: </span>{p.upiId ?? <span className="italic text-muted-foreground">not set</span>}</div>
          <div><span className="text-muted-foreground">Account name: </span>{p.bankAccountName ?? <span className="italic text-muted-foreground">not set</span>}</div>
          <div><span className="text-muted-foreground">Account number: </span>{p.bankAccountNumber ?? <span className="italic text-muted-foreground">not set</span>}</div>
          <div><span className="text-muted-foreground">IFSC: </span>{p.bankIfsc ?? <span className="italic text-muted-foreground">not set</span>}</div>
        </CardContent>
      </Card>

      <Card className="shadow-soft mb-6">
        <CardHeader><CardTitle className="text-base">Services</CardTitle></CardHeader>
        <CardContent className="p-0">
          <AdminTable
            rows={p.services}
            columns={[
              { key: "s", header: "Service", cell: (r) => r.service },
              { key: "c", header: "Country", cell: (r) => r.country },
              { key: "p", header: "Price", cell: (r) => r.price === null ? <span className="text-xs text-muted-foreground italic">ask for price</span> : money(r.price) },
              { key: "st", header: "Status", cell: (r) => <StatusPill status={r.status === "active" ? "active" : "closed"} /> },
              { key: "av", header: "Availability", cell: (r) => <span className="capitalize">{r.availability}</span> },
              { key: "sr", header: "Success", cell: (r) => r.successRate === null ? "—" : `${r.successRate}%` },
            ]}
            empty="No services listed."
          />
        </CardContent>
      </Card>

      <Card className="shadow-soft">
        <CardHeader><CardTitle className="text-base">Recent requests</CardTitle></CardHeader>
        <CardContent className="p-0">
          <AdminTable
            rows={p.recentRequests}
            columns={[
              { key: "code", header: "Request", cell: (r) => <span className="font-mono text-xs">{r.code}</span> },
              { key: "s", header: "Service", cell: (r) => r.serviceName },
              { key: "p", header: "Price", cell: (r) => r.price === null ? <span className="text-xs text-muted-foreground italic">—</span> : money(r.price) },
              { key: "st", header: "Status", cell: (r) => <StatusPill status={r.status === "quote_requested" ? "pending" : r.status === "quoted" ? "reserved" : r.status === "assigned" ? "pending" : r.status === "in_progress" ? "reserved" : r.status} /> },
              { key: "d", header: "Created", cell: (r) => <span className="text-xs">{dateTime(r.createdAt)}</span> },
            ]}
            empty="No requests yet."
          />
        </CardContent>
      </Card>
    </div>
  );
}
