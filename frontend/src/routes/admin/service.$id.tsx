import { Link, useParams } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { PageHeader } from "@/components/common/PageHeader";
import { StatCard } from "@/components/common/StatCard";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { AdminTable, StatusPill } from "@/components/admin/AdminTable";
import { ArrowLeft, ShoppingCart, Percent, DollarSign, Boxes } from "lucide-react";
import { api } from "@/lib/apiClient";
import { money, dateTime } from "@/utils/format";
import type { AdminService, AdminOrder } from "@/types";

export default function Detail() {
  const { id } = useParams({ strict: false }) as { id: string };
  const s = useQuery({ queryKey: ["admin", "service", id], queryFn: () => api.get<AdminService>(`/api/admin/services/${id}`) });
  const orders = useQuery({ queryKey: ["admin", "orders"], queryFn: () => api.get<AdminOrder[]>("/api/admin/orders") });
  const svc = s.data;

  return (
    <div>
      <Button asChild variant="ghost" size="sm" className="mb-4"><Link to={"/admin/services" as any}><ArrowLeft className="mr-1 h-4 w-4" />Back to services</Link></Button>
      <PageHeader title={svc ? `${svc.icon} ${svc.name}` : id} description={`${svc?.category} · Available in ${svc?.countries} countries`} />
      <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
        <StatCard label="Orders" value={String(svc?.orders ?? 0)} icon={ShoppingCart} tone="brand" />
        <StatCard label="Success rate" value={`${svc?.successRate ?? 0}%`} icon={Percent} tone="success" />
        <StatCard label="Price" value={money(svc?.price ?? 0)} icon={DollarSign} tone="info" />
        <StatCard label="Countries" value={String(svc?.countries ?? 0)} icon={Boxes} tone="warning" />
      </div>
      <div className="mt-6">
        <Tabs defaultValue="orders">
          <TabsList><TabsTrigger value="orders">Orders</TabsTrigger><TabsTrigger value="countries">Countries</TabsTrigger><TabsTrigger value="pricing">Pricing</TabsTrigger><TabsTrigger value="inv">Inventory</TabsTrigger><TabsTrigger value="logs">Logs</TabsTrigger></TabsList>
          <TabsContent value="orders" className="mt-4">
            <AdminTable rows={(orders.data ?? []).filter((o) => o.service === svc?.name).slice(0, 10)} columns={[
              { key: "id", header: "Order", cell: (o) => <span className="font-mono text-xs">{o.id}</span> },
              { key: "u", header: "User", cell: (o) => o.user },
              { key: "c", header: "Country", cell: (o) => o.country },
              { key: "st", header: "Status", cell: (o) => <StatusPill status={o.status} /> },
              { key: "d", header: "Date", cell: (o) => dateTime(o.createdAt) },
            ]} />
          </TabsContent>
          <TabsContent value="countries" className="mt-4"><Card className="shadow-soft"><CardContent className="p-6 text-sm text-muted-foreground">Country availability + per-country pricing.</CardContent></Card></TabsContent>
          <TabsContent value="pricing" className="mt-4"><Card className="shadow-soft"><CardHeader><CardTitle>Pricing tiers</CardTitle></CardHeader><CardContent className="text-sm text-muted-foreground">Standard, Reseller, Enterprise tiers configurable here.</CardContent></Card></TabsContent>
          <TabsContent value="inv" className="mt-4"><Card className="shadow-soft"><CardContent className="p-6 text-sm text-muted-foreground">Number inventory allocated to this service.</CardContent></Card></TabsContent>
          <TabsContent value="logs" className="mt-4"><Card className="shadow-soft"><CardContent className="p-6 text-sm text-muted-foreground">Service event log — API mapping, health probes, provider errors.</CardContent></Card></TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
