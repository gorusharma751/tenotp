import { Link } from "@tanstack/react-router";
import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { PageHeader } from "@/components/common/PageHeader";
import { AdminTable, StatusPill } from "@/components/admin/AdminTable";
import { Toolbar } from "@/components/admin/Toolbar";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { money } from "@/utils/format";
import { api } from "@/lib/apiClient";
import type { AdminCountry } from "@/types";
import { Eye } from "lucide-react";

// TODO(backend): no PATCH endpoint exists for toggling a country's enabled
// flag (backend/src/routes/admin.ts only exposes GET /countries and
// GET /countries/:code). The enable/disable switch below is left disabled
// (read-only) until such an endpoint is added.
export default function AdminCountries() {
  const q = useQuery({
    queryKey: ["admin", "countries"],
    queryFn: () => api.get<AdminCountry[]>("/api/admin/countries"),
  });
  const [query, setQuery] = useState("");
  const rows = useMemo(
    () =>
      (q.data ?? []).filter(
        (c) =>
          c.name.toLowerCase().includes(query.toLowerCase()) ||
          c.code.toLowerCase().includes(query.toLowerCase()),
      ),
    [q.data, query],
  );

  return (
    <div>
      <PageHeader
        title="Countries"
        description="Manage country availability, operators, and pricing rules."
      />
      <Toolbar query={query} onQuery={setQuery} placeholder="Search country or code..." />
      <AdminTable
        rows={rows}
        columns={[
          {
            key: "flag",
            header: "",
            cell: (c) => <span className="text-xl">{c.flag}</span>,
            className: "w-10",
          },
          {
            key: "name",
            header: "Country",
            cell: (c) => (
              <div>
                <p className="font-medium">{c.name}</p>
                <p className="text-xs text-muted-foreground font-mono">{c.code}</p>
              </div>
            ),
          },
          { key: "ops", header: "Operators", cell: (c) => c.operators },
          { key: "stock", header: "Stock", cell: (c) => c.numbersAvailable.toLocaleString() },
          { key: "price", header: "Price from", cell: (c) => money(c.priceFrom) },
          { key: "prio", header: "Priority", cell: (c) => `#${c.priority}` },
          {
            key: "en",
            header: "Enabled",
            cell: (c) => (
              <Switch checked={c.enabled} disabled title="Not editable yet — no backend endpoint" />
            ),
          },
          {
            key: "st",
            header: "Status",
            cell: (c) => <StatusPill status={c.enabled ? "active" : "suspended"} />,
          },
          {
            key: "act",
            header: "",
            cell: (c) => (
              <div className="flex gap-1">
                <Button asChild variant="ghost" size="icon">
                  <Link to={`/admin/country/${c.code}` as any}>
                    <Eye className="h-4 w-4" />
                  </Link>
                </Button>
              </div>
            ),
          },
        ]}
      />
    </div>
  );
}
