import { Link, useParams } from "@tanstack/react-router";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { PageHeader } from "@/components/common/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { AdminTable, StatusPill } from "@/components/admin/AdminTable";
import { ArrowLeft, Check, X, Ban } from "lucide-react";
import { api } from "@/lib/apiClient";
import { money, dateTime } from "@/utils/format";
import { toast } from "sonner";
import type { ManagedOrder, OrderCustomer, OrderServiceInfo } from "@/types";

export default function AdminOrderManagementDetail() {
  const { id } = useParams({ strict: false }) as { id: string };
  const qc = useQueryClient();

  const orderQ = useQuery({
    queryKey: ["admin", "order-management", id],
    queryFn: () => api.get<ManagedOrder | null>(`/api/admin/order-management/${id}`),
  });
  const o = orderQ.data;

  const customerQ = useQuery({
    queryKey: ["admin", "order-management", "customer", o?.customer.id],
    queryFn: () => api.get<OrderCustomer | null>(`/api/admin/order-management/customer/${o!.customer.id}`),
    enabled: !!o?.customer.id,
  });

  const customerOrdersQ = useQuery({
    queryKey: ["admin", "order-management", "customer", o?.customer.id, "orders"],
    queryFn: () => api.get<ManagedOrder[]>(`/api/admin/order-management/customer/${o!.customer.id}/orders`),
    enabled: !!o?.customer.id,
  });

  const serviceInfoQ = useQuery({
    queryKey: ["admin", "order-management", "service-info", o?.service.id],
    queryFn: () => api.get<OrderServiceInfo | null>(`/api/admin/order-management/service-info/${o!.service.id}`),
    enabled: !!o?.service.id,
  });

  const invalidate = () => qc.invalidateQueries({ queryKey: ["admin", "order-management"] });

  const actionM = useMutation({
    mutationFn: (action: "approve" | "reject" | "cancel") => api.post<ManagedOrder>(`/api/admin/order-management/${id}/${action}`),
    onSuccess: (_data, action) => {
      toast.success(action === "approve" ? "Order approved" : action === "reject" ? "Order rejected" : "Order cancelled");
      invalidate();
    },
    onError: (e: any) => toast.error(e?.message || "Failed"),
  });

  const customer = customerQ.data ?? o?.customer;
  const service = serviceInfoQ.data ?? o?.service;

  return (
    <div>
      <Button asChild variant="ghost" size="sm" className="mb-4">
        <Link to={"/gourav-ankit-adi/order-management" as any}><ArrowLeft className="mr-1 h-4 w-4" />Back to order management</Link>
      </Button>
      <PageHeader
        title={o ? o.reference : `Order ${id}`}
        description={o ? `${o.service.name} · ${o.customer.name} · ${dateTime(o.createdAt)}` : ""}
        actions={
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => actionM.mutate("approve")} disabled={actionM.isPending}><Check className="mr-2 h-4 w-4" />Approve</Button>
            <Button variant="outline" onClick={() => actionM.mutate("reject")} disabled={actionM.isPending}><X className="mr-2 h-4 w-4" />Reject</Button>
            <Button variant="outline" onClick={() => actionM.mutate("cancel")} disabled={actionM.isPending}><Ban className="mr-2 h-4 w-4" />Cancel</Button>
          </div>
        }
      />

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="shadow-soft lg:col-span-2">
          <CardHeader><CardTitle>Order</CardTitle></CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div className="flex justify-between"><span className="text-muted-foreground">Reference</span><span className="font-mono">{o?.reference ?? "—"}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Status</span><StatusPill status={o?.status ?? "pending"} /></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Payment</span><StatusPill status={o?.paymentStatus ?? "unpaid"} /></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Amount</span><span>{money(o?.amount ?? 0)}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Quantity</span><span>{o?.quantity ?? "—"}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Channel</span><span className="uppercase">{o?.channel ?? "—"}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Created</span><span>{o ? dateTime(o.createdAt) : "—"}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Updated</span><span>{o ? dateTime(o.updatedAt) : "—"}</span></div>
          </CardContent>
        </Card>

        <Card className="shadow-soft">
          <CardHeader><CardTitle>Service</CardTitle></CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div className="flex justify-between"><span className="text-muted-foreground">Name</span><span>{service?.icon} {service?.name}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Category</span><span>{service?.category}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Country</span><span>{service?.countryFlag} {service?.countryName}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Operator</span><span>{service?.operator}</span></div>
          </CardContent>
        </Card>
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-3">
        <Card className="shadow-soft lg:col-span-1">
          <CardHeader><CardTitle>Customer</CardTitle></CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div className="flex justify-between"><span className="text-muted-foreground">Name</span><span>{customer?.name}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Email</span><span>{customer?.email}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Country</span><span>{customer?.country}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Customer since</span><span>{customer ? dateTime(customer.since) : "—"}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Total orders</span><span>{customer?.totalOrders ?? "—"}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Lifetime value</span><span>{money(customer?.lifetimeValue ?? 0)}</span></div>
          </CardContent>
        </Card>

        <Card className="shadow-soft lg:col-span-2">
          <CardHeader><CardTitle>Customer order history</CardTitle></CardHeader>
          <CardContent className="p-0">
            <AdminTable rows={customerOrdersQ.data ?? []} columns={[
              { key: "ref", header: "Order", cell: (co) => (
                <Link to={"/gourav-ankit-adi/order-management/$id" as any} params={{ id: co.id } as any} className="font-mono text-xs hover:underline">{co.reference}</Link>
              ) },
              { key: "s", header: "Service", cell: (co) => <span>{co.service.icon} {co.service.name}</span> },
              { key: "a", header: "Amount", cell: (co) => <span className="tabular-nums">{money(co.amount)}</span> },
              { key: "st", header: "Status", cell: (co) => <StatusPill status={co.status} /> },
              { key: "d", header: "Date", cell: (co) => <span className="text-xs">{dateTime(co.createdAt)}</span> },
            ]} />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
