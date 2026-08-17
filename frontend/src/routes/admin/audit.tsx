import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { PageHeader } from "@/components/common/PageHeader";
import { AdminTable, StatusPill } from "@/components/admin/AdminTable";
import { Toolbar } from "@/components/admin/Toolbar";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { dateTime } from "@/utils/format";
import { api } from "@/lib/apiClient";
import type { AuditEvent } from "@/types";

export default function AdminAudit() {
  const q = useQuery({
    queryKey: ["admin", "audit"],
    queryFn: () => api.get<AuditEvent[]>("/api/admin/audit"),
  });
  const [query, setQuery] = useState("");
  const [sev, setSev] = useState("all");
  const rows = (q.data ?? []).filter(
    (e) =>
      (sev === "all" || e.severity === sev) &&
      (query === "" || e.actor.includes(query) || e.action.includes(query) || e.target.includes(query)),
  );
  return (
    <div>
      <PageHeader title="Audit Log" description="Every admin action — logins, settings, orders, wallets, API changes." />
      <Toolbar query={query} onQuery={setQuery} placeholder="Search actor, action, target...">
        <Select value={sev} onValueChange={setSev}>
          <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
          <SelectContent><SelectItem value="all">All severity</SelectItem><SelectItem value="info">Info</SelectItem><SelectItem value="warning">Warning</SelectItem><SelectItem value="critical">Critical</SelectItem></SelectContent>
        </Select>
      </Toolbar>
      <AdminTable rows={rows} columns={[
        { key: "d", header: "When", cell: (e) => <span className="text-xs">{dateTime(e.createdAt)}</span> },
        { key: "a", header: "Actor", cell: (e) => <span className="font-mono text-xs">{e.actor}</span> },
        { key: "ac", header: "Action", cell: (e) => <span className="capitalize">{e.action.replace(/_/g, " ")}</span> },
        { key: "t", header: "Target", cell: (e) => <span className="font-mono text-xs">{e.target}</span> },
        { key: "i", header: "IP", cell: (e) => <span className="font-mono text-xs">{e.ip}</span> },
        { key: "s", header: "Severity", cell: (e) => <StatusPill status={e.severity} /> },
      ]} />
    </div>
  );
}
