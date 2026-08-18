import { useQuery } from "@tanstack/react-query";
import { PageHeader } from "@/components/common/PageHeader";
import { AdminTable, StatusPill } from "@/components/admin/AdminTable";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/apiClient";
import { money, dateTime } from "@/utils/format";
import { RotateCcw, X } from "lucide-react";
import type { Rental } from "@/types";

// TODO(backend): rentals are read-only from GET /api/admin/rentals — there's
// no renew/terminate endpoint (and no money-safe cancel path like
// otp.ts's /cancel → refundOrder for regular purchases), so these buttons
// used to fake success with a toast and no network call, no refund, no
// state change at all. Left honestly disabled instead of pretending a
// rental was renewed or terminated (and refunded) when nothing happened.
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
            <Button variant="ghost" size="icon" disabled title="No backend endpoint yet"><RotateCcw className="h-4 w-4" /></Button>
            <Button variant="ghost" size="icon" disabled title="No backend endpoint yet (would need a refund path too)"><X className="h-4 w-4 text-destructive" /></Button>
          </div>
        ) },
      ]} />
    </div>
  );
}
