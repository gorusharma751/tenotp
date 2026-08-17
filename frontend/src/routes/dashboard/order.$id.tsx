import { Link, useParams } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { PageHeader } from "@/components/common/PageHeader";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft } from "lucide-react";
import { money, dateTime } from "@/utils/format";
import { Skeleton } from "@/components/ui/skeleton";
import { api } from "@/lib/apiClient";

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

interface OrderEvent {
  id: string;
  action: string;
  statusCode: number | null;
  activationId: string | null;
  note: string | null;
  createdAt: string;
}

export default function OrderDetail() {
  const { id } = useParams({ strict: false }) as { id: string };
  const { data, isLoading } = useQuery({
    queryKey: ["order", id],
    queryFn: async () => {
      const orders = await api.get<Order[]>("/api/otp/my-orders");
      return orders.find((o) => o.id === id) ?? null;
    },
  });
  const { data: events = [] } = useQuery({
    queryKey: ["order-events", id],
    queryFn: () => api.post<OrderEvent[]>("/api/otp/events", { orderId: id }),
    refetchInterval: data?.status === "pending" ? 5000 : false,
  });
  return (
    <div>
      <Button asChild variant="ghost" size="sm" className="mb-4"><Link to="/dashboard/orders"><ArrowLeft className="mr-1 h-4 w-4" />Back to orders</Link></Button>
      <PageHeader title={`Order ${id}`} description="Full order timeline and details." />
      {isLoading ? <Skeleton className="h-52 rounded-2xl" /> : !data ? <p className="text-muted-foreground">Order not found.</p> : (
        <div className="grid gap-4 lg:grid-cols-3">
          <Card className="lg:col-span-2 shadow-soft"><CardContent className="p-6 grid gap-4 sm:grid-cols-2">
            <div><p className="text-xs text-muted-foreground">Service</p><p className="font-medium">{data.service}</p></div>
            <div><p className="text-xs text-muted-foreground">Country</p><p className="font-medium">{data.country}</p></div>
            <div><p className="text-xs text-muted-foreground">Number</p><p className="font-mono">{data.number}</p></div>
            <div><p className="text-xs text-muted-foreground">Status</p><Badge>{data.status}</Badge></div>
            <div><p className="text-xs text-muted-foreground">OTP code</p><p className="font-mono text-lg">{data.otp ?? "—"}</p></div>
            <div><p className="text-xs text-muted-foreground">Price</p><p className="font-medium">{money(data.price)}</p></div>
            <div><p className="text-xs text-muted-foreground">Created</p><p>{dateTime(data.createdAt)}</p></div>
            <div><p className="text-xs text-muted-foreground">Expires</p><p>{dateTime(data.expiresAt)}</p></div>
          </CardContent></Card>
          <Card className="shadow-soft"><CardContent className="p-6">
            <h3 className="font-semibold mb-3">Actions</h3>
            <div className="flex flex-col gap-2">
              <Button variant="outline" asChild><Link to="/dashboard/buy-number">Buy again</Link></Button>
              <Button variant="outline" asChild><Link to="/dashboard/support">Report issue</Link></Button>
            </div>
          </CardContent></Card>
          <Card className="lg:col-span-3 shadow-soft">
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold">OTP status timeline</h3>
                {data.status === "pending" && <span className="text-xs text-muted-foreground">Live · refreshing every 5s</span>}
              </div>
              {events.length === 0 ? (
                <p className="text-sm text-muted-foreground">No events yet.</p>
              ) : (
                <ol className="relative border-l border-border ml-3 space-y-4">
                  {events.map((e) => (
                    <li key={e.id} className="ml-6">
                      <span className="absolute -left-1.5 mt-1.5 h-3 w-3 rounded-full bg-primary border-2 border-background" />
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge variant="secondary" className="text-xs capitalize">{e.action.replace(/_/g, " ")}</Badge>
                        <span className="text-xs text-muted-foreground">{dateTime(e.createdAt)}</span>
                      </div>
                      {e.note && <p className="mt-1 text-sm text-muted-foreground">{e.note}</p>}
                    </li>
                  ))}
                </ol>
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
