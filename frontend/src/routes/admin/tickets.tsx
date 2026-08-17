import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { PageHeader } from "@/components/common/PageHeader";
import { AdminTable, StatusPill } from "@/components/admin/AdminTable";
import { Toolbar } from "@/components/admin/Toolbar";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { api } from "@/lib/apiClient";
import { dateTime } from "@/utils/format";
import type { Ticket } from "@/types";

// Admin ticket queue — backed by GET /api/admin/tickets. (The monolith's
// version of this route was a redirect to the user-facing /support page;
// the backend now exposes a real admin listing endpoint, so this renders it.)
export default function Page() {
  const q = useQuery({ queryKey: ["admin", "tickets"], queryFn: () => api.get<Ticket[]>("/api/admin/tickets") });
  const all = q.data ?? [];
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("all");
  const [priority, setPriority] = useState("all");

  const rows = useMemo(() => all.filter((t) =>
    (status === "all" || t.status === status) &&
    (priority === "all" || t.priority === priority) &&
    t.subject.toLowerCase().includes(query.toLowerCase())
  ), [all, status, priority, query]);

  return (
    <div>
      <PageHeader title="Tickets" description="Support tickets raised across the platform." />
      <Toolbar query={query} onQuery={setQuery} placeholder="Search subject...">
        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger className="w-36"><SelectValue placeholder="Status" /></SelectTrigger>
          <SelectContent><SelectItem value="all">All status</SelectItem><SelectItem value="open">Open</SelectItem><SelectItem value="pending">Pending</SelectItem><SelectItem value="resolved">Resolved</SelectItem><SelectItem value="closed">Closed</SelectItem></SelectContent>
        </Select>
        <Select value={priority} onValueChange={setPriority}>
          <SelectTrigger className="w-36"><SelectValue placeholder="Priority" /></SelectTrigger>
          <SelectContent><SelectItem value="all">All priority</SelectItem><SelectItem value="low">Low</SelectItem><SelectItem value="medium">Medium</SelectItem><SelectItem value="high">High</SelectItem></SelectContent>
        </Select>
      </Toolbar>
      <AdminTable rows={rows} columns={[
        { key: "id", header: "Ticket", cell: (t) => <span className="font-mono text-xs">{t.id}</span> },
        { key: "s", header: "Subject", cell: (t) => <span className="font-medium">{t.subject}</span> },
        { key: "c", header: "Category", cell: (t) => <Badge variant="secondary">{t.category}</Badge> },
        { key: "p", header: "Priority", cell: (t) => <Badge variant="outline" className="capitalize">{t.priority}</Badge> },
        { key: "st", header: "Status", cell: (t) => <StatusPill status={t.status} /> },
        { key: "u", header: "Updated", cell: (t) => <span className="text-xs">{dateTime(t.updatedAt)}</span> },
      ]} empty="No tickets found" />
    </div>
  );
}
