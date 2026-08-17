import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { PageHeader } from "@/components/common/PageHeader";
import { StatCard } from "@/components/common/StatCard";
import { AdminTable, StatusPill } from "@/components/admin/AdminTable";
import { Toolbar } from "@/components/admin/Toolbar";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { api } from "@/lib/apiClient";
import { money, dateTime } from "@/utils/format";
import { toast } from "sonner";
import { ShoppingCart, Clock, CheckCircle2, XCircle, DollarSign, MoreHorizontal, Check, X, Ban, Download } from "lucide-react";
import type { ManagedOrder, ManagedOrderStatus, OrderListResult } from "@/types";

type Summary = { total: number; draft: number; pending: number; processing: number; completed: number; cancelled: number; failed: number; revenue: number };

const STATUS_OPTIONS: (ManagedOrderStatus | "all")[] = ["all", "draft", "pending", "processing", "completed", "cancelled", "failed"];

export default function AdminOrderManagement() {
  const qc = useQueryClient();
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<ManagedOrderStatus | "all">("all");
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const pageSize = 10;

  const summaryQ = useQuery({
    queryKey: ["admin", "order-management", "summary"],
    queryFn: () => api.get<Summary>("/api/admin/order-management/summary"),
  });

  const listQ = useQuery({
    queryKey: ["admin", "order-management", "list", query, status, page],
    queryFn: () =>
      api.post<OrderListResult>("/api/admin/order-management/list", {
        q: query, status, paymentStatus: "all", channel: "all", page, pageSize, sort: "newest",
      }),
  });

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["admin", "order-management"] });
  };

  const statusM = useMutation({
    mutationFn: ({ id, next }: { id: string; next: ManagedOrderStatus }) =>
      api.post<ManagedOrder>(`/api/admin/order-management/${id}/status`, { next }),
    onSuccess: () => { toast.success("Order status updated"); invalidate(); },
    onError: (e: any) => toast.error(e?.message || "Failed to update status"),
  });

  const actionM = useMutation({
    mutationFn: ({ id, action }: { id: string; action: "approve" | "reject" | "cancel" }) =>
      api.post<ManagedOrder>(`/api/admin/order-management/${id}/${action}`),
    onSuccess: (_data, { action }) => {
      toast.success(action === "approve" ? "Order approved" : action === "reject" ? "Order rejected" : "Order cancelled");
      invalidate();
    },
    onError: (e: any) => toast.error(e?.message || "Failed"),
  });

  const bulkM = useMutation({
    mutationFn: ({ ids, next }: { ids: string[]; next: ManagedOrderStatus }) =>
      api.post("/api/admin/order-management/bulk-status", { ids, next }),
    onSuccess: () => {
      toast.success("Bulk status update applied");
      setSelected(new Set());
      invalidate();
    },
    onError: (e: any) => toast.error(e?.message || "Bulk update failed"),
  });

  const exportM = useMutation({
    mutationFn: () => api.post<{ filename: string; rows: number }>("/api/admin/order-management/export"),
    onSuccess: (r) => toast.success(`Exported ${r.rows} rows to ${r.filename}`),
    onError: (e: any) => toast.error(e?.message || "Export failed"),
  });

  const rows = listQ.data?.items ?? [];
  const s = summaryQ.data;
  const allSelected = rows.length > 0 && rows.every((r) => selected.has(r.id));

  const toggleAll = () => {
    setSelected((prev) => {
      if (allSelected) return new Set();
      return new Set(rows.map((r) => r.id));
    });
  };
  const toggleOne = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  return (
    <div>
      <PageHeader
        title="Order Management"
        description="Order lifecycle management."
        actions={<Button variant="outline" onClick={() => exportM.mutate()} disabled={exportM.isPending}><Download className="mr-2 h-4 w-4" />Export</Button>}
      />

      <div className="grid gap-4 grid-cols-2 lg:grid-cols-5 mb-6">
        <StatCard label="Total" value={String(s?.total ?? 0)} icon={ShoppingCart} tone="brand" />
        <StatCard label="Pending" value={String(s?.pending ?? 0)} icon={Clock} tone="warning" />
        <StatCard label="Completed" value={String(s?.completed ?? 0)} icon={CheckCircle2} tone="success" />
        <StatCard label="Cancelled / Failed" value={String((s?.cancelled ?? 0) + (s?.failed ?? 0))} icon={XCircle} tone="info" />
        <StatCard label="Revenue" value={money(s?.revenue ?? 0)} icon={DollarSign} tone="success" />
      </div>

      <Toolbar query={query} onQuery={(v) => { setQuery(v); setPage(1); }} placeholder="Search reference, customer, service...">
        <Select value={status} onValueChange={(v) => { setStatus(v as ManagedOrderStatus | "all"); setPage(1); }}>
          <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
          <SelectContent>
            {STATUS_OPTIONS.map((opt) => (
              <SelectItem key={opt} value={opt} className="capitalize">{opt === "all" ? "All statuses" : opt}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        {selected.size > 0 && (
          <>
            <span className="text-sm text-muted-foreground">{selected.size} selected</span>
            <Select onValueChange={(v) => bulkM.mutate({ ids: Array.from(selected), next: v as ManagedOrderStatus })}>
              <SelectTrigger className="w-44"><SelectValue placeholder="Bulk set status..." /></SelectTrigger>
              <SelectContent>
                {STATUS_OPTIONS.filter((o) => o !== "all").map((opt) => (
                  <SelectItem key={opt} value={opt} className="capitalize">{opt}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </>
        )}
      </Toolbar>

      <AdminTable rows={rows} columns={[
        { key: "sel", header: <Checkbox checked={allSelected} onCheckedChange={toggleAll} /> as any, cell: (o) => (
          <Checkbox checked={selected.has(o.id)} onCheckedChange={() => toggleOne(o.id)} />
        ) },
        { key: "ref", header: "Order", cell: (o) => (
          <Link to={"/gourav-ankit-adi/order-management/$id" as any} params={{ id: o.id } as any} className="font-mono text-xs font-medium hover:underline">
            {o.reference}
          </Link>
        ) },
        { key: "c", header: "Customer", cell: (o) => <div><p className="font-medium">{o.customer.name}</p><p className="text-xs text-muted-foreground">{o.customer.email}</p></div> },
        { key: "s", header: "Service", cell: (o) => <span>{o.service.icon} {o.service.name}</span> },
        { key: "a", header: "Amount", cell: (o) => <span className="tabular-nums font-medium">{money(o.amount)}</span> },
        { key: "ch", header: "Channel", cell: (o) => <span className="text-xs uppercase text-muted-foreground">{o.channel}</span> },
        { key: "st", header: "Status", cell: (o) => <StatusPill status={o.status} /> },
        { key: "p", header: "Payment", cell: (o) => <StatusPill status={o.paymentStatus} /> },
        { key: "d", header: "Created", cell: (o) => <span className="text-xs">{dateTime(o.createdAt)}</span> },
        { key: "act", header: "", cell: (o) => (
          <DropdownMenu>
            <DropdownMenuTrigger asChild><Button variant="ghost" size="icon"><MoreHorizontal className="h-4 w-4" /></Button></DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => actionM.mutate({ id: o.id, action: "approve" })}><Check className="mr-2 h-4 w-4" />Approve</DropdownMenuItem>
              <DropdownMenuItem onClick={() => actionM.mutate({ id: o.id, action: "reject" })}><X className="mr-2 h-4 w-4" />Reject</DropdownMenuItem>
              <DropdownMenuItem onClick={() => actionM.mutate({ id: o.id, action: "cancel" })}><Ban className="mr-2 h-4 w-4" />Cancel</DropdownMenuItem>
              {STATUS_OPTIONS.filter((v) => v !== "all").map((opt) => (
                <DropdownMenuItem key={opt} className="capitalize" onClick={() => statusM.mutate({ id: o.id, next: opt })}>
                  Set status: {opt}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        ) },
      ]} />

      {listQ.data && listQ.data.totalPages > 1 && (
        <div className="mt-4 flex items-center justify-between text-sm text-muted-foreground">
          <span>Page {listQ.data.page} of {listQ.data.totalPages} · {listQ.data.total} orders</span>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))}>Previous</Button>
            <Button variant="outline" size="sm" disabled={page >= listQ.data.totalPages} onClick={() => setPage((p) => p + 1)}>Next</Button>
          </div>
        </div>
      )}
    </div>
  );
}
