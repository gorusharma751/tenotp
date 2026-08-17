import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { PageHeader } from "@/components/common/PageHeader";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/common/EmptyState";
import { api } from "@/lib/apiClient";
import { timeAgo } from "@/utils/format";
import { Copy, RefreshCw, Search, Inbox, Radio } from "lucide-react";
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

export default function OtpInbox() {
  const [q, setQ] = useState("");
  const [auto, setAuto] = useState(true);
  const { data, isLoading, refetch, isFetching } = useQuery({ queryKey: ["orders", "inbox"], queryFn: () => api.get<Order[]>("/api/otp/my-orders") });

  useEffect(() => {
    if (!auto) return;
    const t = setInterval(() => refetch(), 15000);
    return () => clearInterval(t);
  }, [auto, refetch]);

  const rows = (data ?? []).filter((o) => (o.service + o.number + (o.otp ?? "")).toLowerCase().includes(q.toLowerCase()));
  const copy = (v: string, label: string) => { navigator.clipboard.writeText(v); toast.success(`${label} copied`); };

  return (
    <div>
      <PageHeader title="OTP Inbox" description="Live OTPs arriving from your active numbers." actions={
        <>
          <div className="flex items-center gap-2 text-sm"><Switch checked={auto} onCheckedChange={setAuto} /> Auto refresh</div>
          <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isFetching}><RefreshCw className={`h-4 w-4 mr-1 ${isFetching ? "animate-spin" : ""}`} />Refresh</Button>
        </>
      } />
      <Card className="shadow-soft">
        <CardContent className="p-4">
          <div className="flex items-center gap-3 mb-4">
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Search by number, service or code…" value={q} onChange={(e) => setQ(e.target.value)} className="pl-9" />
            </div>
            <Badge variant="secondary" className="gap-1"><Radio className="h-3 w-3 text-success animate-pulse" />Live</Badge>
          </div>
          {isLoading ? <Skeleton className="h-40 rounded-xl" /> : rows.length === 0 ? (
            <EmptyState icon={<Inbox className="h-6 w-6" />} title="No OTPs yet" description="Purchase a number to start receiving codes here." />
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader className="sticky top-0 bg-background z-10">
                  <TableRow>
                    <TableHead>Order</TableHead><TableHead>Number</TableHead><TableHead>Service</TableHead>
                    <TableHead>OTP</TableHead><TableHead>Received</TableHead><TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((o) => (
                    <TableRow key={o.id}>
                      <TableCell className="font-mono text-xs">{o.id}</TableCell>
                      <TableCell className="font-mono text-xs">{o.number}</TableCell>
                      <TableCell>{o.service}</TableCell>
                      <TableCell><span className={`font-mono font-semibold ${o.otp ? "text-primary" : "text-muted-foreground"}`}>{o.otp ?? "waiting…"}</span></TableCell>
                      <TableCell className="text-xs text-muted-foreground">{timeAgo(o.createdAt)}</TableCell>
                      <TableCell className="text-right">
                        <Button size="sm" variant="ghost" onClick={() => copy(o.number, "Number")}><Copy className="h-3.5 w-3.5" /></Button>
                        {o.otp && <Button size="sm" variant="ghost" onClick={() => copy(o.otp!, "OTP")}><Copy className="h-3.5 w-3.5 text-primary" /></Button>}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
