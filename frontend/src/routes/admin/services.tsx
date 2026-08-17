import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { PageHeader } from "@/components/common/PageHeader";
import { AdminTable, StatusPill } from "@/components/admin/AdminTable";
import { Toolbar } from "@/components/admin/Toolbar";
import { api } from "@/lib/apiClient";
import { money } from "@/utils/format";
import type { AdminService } from "@/types";

export default function AdminServices() {
  const q = useQuery({ queryKey: ["admin", "services"], queryFn: () => api.get<AdminService[]>("/api/admin/services") });
  const [query, setQuery] = useState("");

  const rows = (q.data ?? []).filter((s) =>
    s.name.toLowerCase().includes(query.toLowerCase()) || s.category.toLowerCase().includes(query.toLowerCase()),
  );

  return (
    <div>
      <PageHeader title="Services" description="OTP service catalog." />
      <Toolbar query={query} onQuery={setQuery} placeholder="Search service or category..." />
      <AdminTable rows={rows} columns={[
        { key: "n", header: "Service", cell: (s) => (
          <Link to={"/gourav-ankit-adi/service/$id" as any} params={{ id: s.id } as any} className="flex items-center gap-2 font-medium hover:underline">
            <span>{s.icon}</span>
            <span>{s.name}</span>
          </Link>
        ) },
        { key: "c", header: "Category", cell: (s) => <span className="text-sm text-muted-foreground">{s.category}</span> },
        { key: "p", header: "Price", cell: (s) => <span className="tabular-nums">{money(s.price)}</span> },
        { key: "sr", header: "Success rate", cell: (s) => <span className="tabular-nums">{s.successRate}%</span> },
        { key: "co", header: "Countries", cell: (s) => <span className="tabular-nums">{s.countries}</span> },
        { key: "o", header: "Orders", cell: (s) => <span className="tabular-nums">{s.orders}</span> },
        { key: "st", header: "Status", cell: (s) => <StatusPill status={s.enabled ? "active" : "closed"} /> },
      ]} />
    </div>
  );
}
