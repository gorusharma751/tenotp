import { useQuery } from "@tanstack/react-query";
import { PageHeader } from "@/components/common/PageHeader";
import { AdminTable, StatusPill } from "@/components/admin/AdminTable";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/apiClient";
import { money, dateTime } from "@/utils/format";
import { toast } from "sonner";
import { RotateCcw, X } from "lucide-react";
import type { Rental } from "@/types";

export default function Page() {
  const q = useQuery({ queryKey: ["admin", "rentals"], queryFn: () => api.get<Rental[]>("/api/admin/rentals") });
  return (
    <div>
      <PageHeader title="Rentals" description="Long-duration number rentals across the platform." />
      <AdminTable rows={q.data ?? []} columns={[
        { key: "n", header: "Number", cell: (r) => <span className="font-mono text-sm">{r.number}</span> },
        { key: "c", header: "Country", cell: (r) => r.country },
        { key: "s", header: "Service", cell: (r) => r.service },
        { key: "d", header: "Duration", cell: (r) => `${r.durationDays} days` },
        { key: "p", header: "Price", cell: (r) => money(r.price) },
        { key: "st", header: "Status", cell: (r) => <StatusPill status={r.status} /> },
        { key: "e", header: "Expires", cell: (r) => <span className="text-xs">{dateTime(r.expiresAt)}</span> },
        { key: "act", header: "", cell: () => (
          <div className="flex gap-1">
            <Button variant="ghost" size="icon" onClick={() => toast.success("Renewed")}><RotateCcw className="h-4 w-4" /></Button>
            <Button variant="ghost" size="icon" onClick={() => toast.error("Terminated")}><X className="h-4 w-4 text-destructive" /></Button>
          </div>
        ) },
      ]} />
    </div>
  );
}
