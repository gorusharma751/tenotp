import { Link, useParams } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { PageHeader } from "@/components/common/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { StatusPill } from "@/components/admin/AdminTable";
import { ArrowLeft } from "lucide-react";
import { api } from "@/lib/apiClient";
import { money, dateTime } from "@/utils/format";
import type { AdminOrder } from "@/types";

export default function AdminOrderDetail() {
  const { id } = useParams({ strict: false }) as { id: string };
  const q = useQuery({ queryKey: ["admin", "order", id], queryFn: () => api.get<AdminOrder | null>(`/api/admin/orders/${id}`) });
  const o = q.data;
  const timeline = [
    { t: "Order created", at: o?.createdAt },
    { t: "Number assigned", at: o?.createdAt },
    { t: o?.status === "received" ? "OTP received" : "Waiting for OTP", at: o?.createdAt },
    { t: o?.status === "cancelled" ? "Order cancelled" : "Order active", at: o?.createdAt },
  ];

  return (
    <div>
      <Button asChild variant="ghost" size="sm" className="mb-4"><Link to={"/gourav-ankit-adi/orders" as any}><ArrowLeft className="mr-1 h-4 w-4" />Back to orders</Link></Button>
      <PageHeader title={`Order ${id}`} description={o ? `${o.service} · ${o.country} · ${o.number}` : ""} />

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="shadow-soft lg:col-span-2">
          <CardHeader><CardTitle>Timeline</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            {timeline.map((e, i) => (
              <div key={i} className="flex items-start gap-3"><span className="mt-1 h-2 w-2 rounded-full bg-primary" /><div className="flex-1"><p className="text-sm font-medium">{e.t}</p><p className="text-xs text-muted-foreground">{e.at ? dateTime(e.at) : "—"}</p></div></div>
            ))}
          </CardContent>
        </Card>
        <Card className="shadow-soft">
          <CardHeader><CardTitle>Summary</CardTitle></CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div className="flex justify-between"><span className="text-muted-foreground">User</span><Link to={"/gourav-ankit-adi/user/$id" as any} params={{ id: o?.userId ?? "" } as any} className="hover:underline">{o?.user}</Link></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Operator</span><span>{o?.operator}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Price</span><span>{money(o?.price ?? 0)}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Status</span><StatusPill status={o?.status ?? "pending"} /></div>
            <div className="flex justify-between"><span className="text-muted-foreground">OTP</span><span className="font-mono">{o?.otp ?? "—"}</span></div>
          </CardContent>
        </Card>
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <Card className="shadow-soft"><CardHeader><CardTitle>OTP history</CardTitle></CardHeader><CardContent className="text-sm text-muted-foreground">{o?.otp ? `Received code ${o.otp} at ${dateTime(o.createdAt)}` : "No OTP received yet."}</CardContent></Card>
        <Card className="shadow-soft"><CardHeader><CardTitle>Logs</CardTitle></CardHeader><CardContent className="text-sm text-muted-foreground">Provider probe · Number reserved · Delivery attempt · Callback</CardContent></Card>
      </div>
    </div>
  );
}
