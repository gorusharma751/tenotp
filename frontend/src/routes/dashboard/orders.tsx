import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { PageHeader } from "@/components/common/PageHeader";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Search, Plus } from "lucide-react";
import { api } from "@/lib/apiClient";
import { money, dateTime } from "@/utils/format";
import { Skeleton } from "@/components/ui/skeleton";
import { useState, useMemo } from "react";

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

export default function Orders() {
  const [q, setQ] = useState("");
  const { data, isLoading } = useQuery({ queryKey: ["orders"], queryFn: () => api.get<Order[]>("/api/otp/my-orders") });
  const rows = useMemo(() => (data ?? []).filter((o) => (o.service + o.country + o.number + o.status).toLowerCase().includes(q.toLowerCase())), [data, q]);

  return (
    <div>
      <PageHeader title="Orders" description="Search, filter, and inspect every OTP order." actions={
        <Button asChild className="gradient-brand"><Link to="/dashboard/buy-number"><Plus className="mr-1 h-4 w-4" />New order</Link></Button>
      } />
      <Card className="shadow-soft">
        <CardContent className="p-4">
          <div className="relative mb-4">
            <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Search…" value={q} onChange={(e) => setQ(e.target.value)} className="pl-9" />
          </div>
          <div className="hidden md:block overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Order</TableHead><TableHead>Service</TableHead><TableHead>Country</TableHead>
                  <TableHead>Number</TableHead><TableHead>Status</TableHead><TableHead>OTP</TableHead>
                  <TableHead className="text-right">Price</TableHead><TableHead>Created</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? Array.from({ length: 6 }).map((_, i) => (<TableRow key={i}><TableCell colSpan={8}><Skeleton className="h-6 w-full" /></TableCell></TableRow>)) :
                  rows.map((o) => (
                    <TableRow key={o.id}>
                      <TableCell><Link to="/dashboard/order/$id" params={{ id: o.id }} className="text-primary hover:underline font-medium">{o.id}</Link></TableCell>
                      <TableCell>{o.service}</TableCell>
                      <TableCell className="whitespace-nowrap">{o.country}</TableCell>
                      <TableCell className="font-mono text-xs">{o.number}</TableCell>
                      <TableCell><Badge variant={o.status === "received" ? "default" : o.status === "pending" ? "secondary" : "outline"}>{o.status}</Badge></TableCell>
                      <TableCell className="font-mono">{o.otp ?? "—"}</TableCell>
                      <TableCell className="text-right">{money(o.price)}</TableCell>
                      <TableCell className="text-xs text-muted-foreground whitespace-nowrap">{dateTime(o.createdAt)}</TableCell>
                    </TableRow>
                  ))}
              </TableBody>
            </Table>
          </div>

          <div className="md:hidden space-y-3">
            {isLoading ? Array.from({ length: 4 }).map((_, i) => (<Skeleton key={i} className="h-24 w-full rounded-lg" />)) :
              rows.map((o) => (
                <Link key={o.id} to="/dashboard/order/$id" params={{ id: o.id }} className="block">
                  <div className="rounded-xl border p-3 shadow-soft bg-card">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-sm font-semibold truncate">{o.service} · <span className="text-muted-foreground font-normal">{o.country}</span></p>
                        <p className="mt-0.5 font-mono text-xs text-muted-foreground truncate">{o.number}</p>
                      </div>
                      <Badge variant={o.status === "received" ? "default" : o.status === "pending" ? "secondary" : "outline"}>{o.status}</Badge>
                    </div>
                    <div className="mt-2 flex items-center justify-between text-xs">
                      <span className="font-mono">{o.otp ?? "— no OTP —"}</span>
                      <span className="font-semibold">{money(o.price)}</span>
                    </div>
                    <p className="mt-1 text-[10px] text-muted-foreground">{dateTime(o.createdAt)} · {o.id}</p>
                  </div>
                </Link>
              ))
            }
            {!isLoading && rows.length === 0 && <p className="text-sm text-muted-foreground text-center py-8">No orders yet.</p>}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
