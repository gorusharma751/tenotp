import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { PageHeader } from "@/components/common/PageHeader";
import { AdminTable, StatusPill } from "@/components/admin/AdminTable";
import { Toolbar } from "@/components/admin/Toolbar";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/apiClient";
import { money, dateTime } from "@/utils/format";
import type { Payment } from "@/types";

// Payment gateway *configuration* (BharatPe/Razorpay/Paytm keys, enable
// toggles) lives on the Settings page — this page is the actual payment
// history, backed by the real GET /api/admin/payments endpoint (every
// successful Razorpay/Paytm/BharatPe/manual-UPI credit gets logged here
// when the wallet is credited — see backend/src/lib/{razorpay,paytm}.ts).
// For deposits still awaiting manual review, see the Deposits page.
export default function AdminPayments() {
  const q = useQuery({ queryKey: ["admin", "payments"], queryFn: () => api.get<Payment[]>("/api/admin/payments") });
  const [query, setQuery] = useState("");

  const all = q.data ?? [];
  const rows = all.filter((p) =>
    p.user.toLowerCase().includes(query.toLowerCase()) ||
    p.method.toLowerCase().includes(query.toLowerCase()) ||
    p.reference.toLowerCase().includes(query.toLowerCase()),
  );

  const stats = {
    total: all.length,
    completed: all.filter((p) => p.status === "completed").length,
    received: all.filter((p) => p.status === "completed").reduce((s, p) => s + p.amount, 0),
  };

  return (
    <div>
      <PageHeader
        title="Payments"
        description="Payment history across every gateway. Configure BharatPe/Razorpay/Paytm on the Settings page."
        actions={<Button asChild variant="outline"><Link to={"/gourav-ankit-adi/settings" as any}>Go to Settings</Link></Button>}
      />

      <div className="grid gap-4 sm:grid-cols-3 mb-4">
        <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">Total payments</p><p className="text-xl font-semibold">{stats.total}</p></CardContent></Card>
        <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">Completed</p><p className="text-xl font-semibold">{stats.completed}</p></CardContent></Card>
        <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">Received</p><p className="text-xl font-semibold">{money(stats.received)}</p></CardContent></Card>
      </div>

      <Toolbar query={query} onQuery={setQuery} placeholder="Search user, method or reference..." />
      <AdminTable rows={rows} columns={[
        { key: "u", header: "User", cell: (p) => <span className="text-sm">{p.user}</span> },
        { key: "m", header: "Method", cell: (p) => <span className="text-sm">{p.method}</span> },
        { key: "a", header: "Amount", cell: (p) => <span className="tabular-nums font-medium">{money(p.amount)}</span> },
        { key: "r", header: "Reference", cell: (p) => <span className="font-mono text-xs">{p.reference || "—"}</span> },
        { key: "st", header: "Status", cell: (p) => <StatusPill status={p.status} /> },
        { key: "d", header: "Date", cell: (p) => <span className="text-xs">{dateTime(p.createdAt)}</span> },
      ]} empty="No payments yet" />
    </div>
  );
}
