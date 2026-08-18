import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { PageHeader } from "@/components/common/PageHeader";
import { AdminTable, StatusPill } from "@/components/admin/AdminTable";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { api } from "@/lib/apiClient";
import { money, dateTime } from "@/utils/format";
import { Check, X } from "lucide-react";
import type { Refund } from "@/types";

// TODO(backend): the "refunds" collection is read-only from GET
// /api/admin/refunds and nothing anywhere ever writes to it — there's no
// user-facing "request a refund" flow and no admin approve/reject
// endpoint, so this table will always be empty in practice and the two
// action buttons used to fake success with a toast and no network call at
// all. (Real refunds already happen automatically and atomically via
// POST /api/otp/cancel → refundOrder — this page was for a separate
// manual-request flow that was never built.) Left honestly disabled.
export default function Page() {
  const q = useQuery({ queryKey: ["admin", "refunds"], queryFn: () => api.get<Refund[]>("/api/admin/refunds") });
  const all = q.data ?? [];
  const [tab, setTab] = useState("pending");
  const filter = (s: string) => (s === "all" ? all : all.filter((r) => r.status === s));
  const cols = [
    { key: "id", header: "Refund", cell: (r: Refund) => <span className="font-mono text-xs">{r.id}</span> },
    { key: "o", header: "Order", cell: (r: Refund) => <span className="font-mono text-xs">{r.orderId}</span> },
    { key: "u", header: "User", cell: (r: Refund) => r.user },
    { key: "a", header: "Amount", cell: (r: Refund) => money(r.amount) },
    { key: "re", header: "Reason", cell: (r: Refund) => <span className="text-xs">{r.reason}</span> },
    { key: "st", header: "Status", cell: (r: Refund) => <StatusPill status={r.status} /> },
    { key: "d", header: "Date", cell: (r: Refund) => <span className="text-xs">{dateTime(r.createdAt)}</span> },
    { key: "act", header: "", cell: (r: Refund) => (
      <div className="flex gap-1">
        <Button variant="ghost" size="icon" disabled title="No backend endpoint yet"><Check className="h-4 w-4 text-success" /></Button>
        <Button variant="ghost" size="icon" disabled title="No backend endpoint yet"><X className="h-4 w-4 text-destructive" /></Button>
      </div>
    ) },
  ];
  return (
    <div>
      <PageHeader title="Refunds" description="Review, approve, or reject refund requests." />
      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="pending">Pending ({filter("pending").length})</TabsTrigger>
          <TabsTrigger value="approved">Approved ({filter("approved").length})</TabsTrigger>
          <TabsTrigger value="rejected">Rejected ({filter("rejected").length})</TabsTrigger>
          <TabsTrigger value="all">History ({all.length})</TabsTrigger>
        </TabsList>
        {["pending", "approved", "rejected", "all"].map((t) => (
          <TabsContent key={t} value={t} className="mt-4"><AdminTable rows={filter(t)} columns={cols} /></TabsContent>
        ))}
      </Tabs>
    </div>
  );
}
