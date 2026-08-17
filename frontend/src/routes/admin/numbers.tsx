import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { PageHeader } from "@/components/common/PageHeader";
import { AdminTable, StatusPill } from "@/components/admin/AdminTable";
import { Toolbar } from "@/components/admin/Toolbar";
import { api } from "@/lib/apiClient";
import { dateTime } from "@/utils/format";
import type { NumberInventoryItem } from "@/types";

export default function Page() {
  const q = useQuery({ queryKey: ["admin", "numbers"], queryFn: () => api.get<NumberInventoryItem[]>("/api/admin/numbers") });
  const [query, setQuery] = useState("");

  const rows = (q.data ?? []).filter((n) =>
    n.number.toLowerCase().includes(query.toLowerCase()) ||
    n.countryCode.toLowerCase().includes(query.toLowerCase()) ||
    n.service.toLowerCase().includes(query.toLowerCase()) ||
    n.operator.toLowerCase().includes(query.toLowerCase())
  );

  return (
    <div>
      <PageHeader title="Numbers" description="Numbers inventory." />
      <Toolbar query={query} onQuery={setQuery} placeholder="Search number, country, service, operator..." />
      <AdminTable rows={rows} columns={[
        { key: "n", header: "Number", cell: (n) => <span className="font-mono text-xs">{n.number}</span> },
        { key: "c", header: "Country", cell: (n) => n.countryCode || "—" },
        { key: "s", header: "Service", cell: (n) => n.service || "—" },
        { key: "o", header: "Operator", cell: (n) => n.operator || "—" },
        { key: "st", header: "Status", cell: (n) => <StatusPill status={n.status} /> },
        { key: "a", header: "Assigned to", cell: (n) => n.assignedTo || "—" },
        { key: "d", header: "Added", cell: (n) => <span className="text-xs">{dateTime(n.addedAt)}</span> },
      ]} empty="No numbers in inventory" />
    </div>
  );
}
