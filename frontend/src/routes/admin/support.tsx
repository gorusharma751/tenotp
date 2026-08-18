import { useQuery } from "@tanstack/react-query";
import { PageHeader } from "@/components/common/PageHeader";
import { StatCard } from "@/components/common/StatCard";
import { AdminTable, StatusPill } from "@/components/admin/AdminTable";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { api } from "@/lib/apiClient";
import { timeAgo } from "@/utils/format";
import { Ticket as TicketIcon, Clock, CheckCircle2, AlertOctagon } from "lucide-react";
import type { Ticket } from "@/types";

// TODO(backend): tickets are read-only from GET /api/admin/tickets — no
// assign-agent or close-ticket endpoint exists, so both actions used to
// fake success with a toast and no network call. Left honestly disabled.
export default function AdminSupport() {
  const q = useQuery({ queryKey: ["admin", "tickets"], queryFn: () => api.get<Ticket[]>("/api/admin/tickets") });
  const tickets = q.data ?? [];
  return (
    <div>
      <PageHeader title="Support" description="Ticket queue, priority routing, and agent assignment." />
      <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
        <StatCard label="Open" value={String(tickets.filter((t) => t.status === "open").length)} icon={TicketIcon} tone="info" />
        <StatCard label="Pending" value={String(tickets.filter((t) => t.status === "pending").length)} icon={Clock} tone="warning" />
        <StatCard label="Resolved" value={String(tickets.filter((t) => t.status === "resolved").length)} icon={CheckCircle2} tone="success" />
        <StatCard label="High priority" value={String(tickets.filter((t) => t.priority === "high").length)} icon={AlertOctagon} tone="warning" />
      </div>
      <div className="mt-6">
        <AdminTable rows={tickets} columns={[
          { key: "id", header: "Ticket", cell: (t) => <span className="font-mono text-xs">{t.id}</span> },
          { key: "s", header: "Subject", cell: (t) => <p className="font-medium">{t.subject}</p> },
          { key: "cat", header: "Category", cell: (t) => t.category },
          { key: "p", header: "Priority", cell: (t) => <StatusPill status={t.priority === "high" ? "warning" : t.priority === "medium" ? "info" : "closed"} /> },
          { key: "st", header: "Status", cell: (t) => <StatusPill status={t.status} /> },
          { key: "u", header: "Updated", cell: (t) => <span className="text-xs">{timeAgo(t.updatedAt)}</span> },
          { key: "a", header: "Agent", cell: () => (
            <Select disabled>
              <SelectTrigger className="w-32 h-8" title="No backend endpoint yet"><SelectValue placeholder="Assign" /></SelectTrigger>
              <SelectContent><SelectItem value="Alice">Alice</SelectItem><SelectItem value="Bob">Bob</SelectItem><SelectItem value="Chen">Chen</SelectItem></SelectContent>
            </Select>
          )},
          { key: "act", header: "", cell: () => (
            <div className="flex gap-1">
              <Button variant="ghost" size="icon" disabled title="No backend endpoint yet"><CheckCircle2 className="h-4 w-4" /></Button>
            </div>
          )},
        ]} />
      </div>
    </div>
  );
}
