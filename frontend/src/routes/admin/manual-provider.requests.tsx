import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { PageHeader } from "@/components/common/PageHeader";
import { AdminTable, StatusPill } from "@/components/admin/AdminTable";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Undo2, CheckCheck } from "lucide-react";
import { api } from "@/lib/apiClient";
import { money, dateTime } from "@/utils/format";
import { toast } from "sonner";

interface AdminRequestRow {
  id: string; code: string; buyerEmail: string | null; serviceName: string; country: string; price: number | null; status: string; createdAt: string;
}

export default function AdminManualProviderRequests() {
  const qc = useQueryClient();
  const [status, setStatus] = useState("all");
  const q = useQuery({
    queryKey: ["admin", "mp", "requests", status],
    queryFn: () => api.get<AdminRequestRow[]>(`/api/manual-providers/admin/requests${status !== "all" ? `?status=${status}` : ""}`),
  });
  const refundM = useMutation({
    mutationFn: (id: string) => api.post(`/api/manual-providers/admin/requests/${id}/refund`, { reason: "Admin refund" }),
    onSuccess: () => { toast.success("Refunded"); qc.invalidateQueries({ queryKey: ["admin", "mp", "requests"] }); },
    onError: (e: any) => toast.error(e?.message || "Could not refund"),
  });
  const forceCompleteM = useMutation({
    mutationFn: (v: { id: string; otpCode: string }) => api.post(`/api/manual-providers/admin/requests/${v.id}/force-complete`, { otpCode: v.otpCode, note: "Admin force-complete — seller unresponsive" }),
    onSuccess: () => { toast.success("Force-completed"); qc.invalidateQueries({ queryKey: ["admin", "mp", "requests"] }); },
    onError: (e: any) => toast.error(e?.message || "Could not force-complete"),
  });

  return (
    <div>
      <PageHeader
        title="Requests"
        description="Every Manual Provider request across all sellers."
        actions={
          <Select value={status} onValueChange={setStatus}>
            <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
            <SelectContent>
              {["all", "quote_requested", "quoted", "assigned", "in_progress", "otp_sent", "completed", "failed", "cancelled", "refunded"].map((s) => <SelectItem key={s} value={s}>{s === "all" ? "All statuses" : s.replace("_", " ")}</SelectItem>)}
            </SelectContent>
          </Select>
        }
      />
      <AdminTable
        rows={q.data ?? []}
        columns={[
          { key: "code", header: "Request", cell: (r) => <span className="font-mono text-xs">{r.code}</span> },
          { key: "b", header: "Buyer", cell: (r) => <span className="text-xs">{r.buyerEmail ?? "—"}</span> },
          { key: "s", header: "Service", cell: (r) => r.serviceName },
          { key: "c", header: "Country", cell: (r) => r.country },
          { key: "p", header: "Price", cell: (r) => r.price === null ? <span className="text-xs text-muted-foreground italic">ask for price</span> : money(r.price) },
          { key: "st", header: "Status", cell: (r) => <StatusPill status={r.status === "quote_requested" ? "pending" : r.status === "quoted" ? "reserved" : r.status === "assigned" ? "pending" : r.status === "in_progress" ? "reserved" : r.status === "otp_sent" ? "reserved" : r.status} /> },
          { key: "d", header: "Created", cell: (r) => <span className="text-xs">{dateTime(r.createdAt)}</span> },
          { key: "act", header: "", cell: (r) => (
            !["completed", "cancelled", "refunded"].includes(r.status) && (
              <div className="flex gap-1">
                <Button size="sm" variant="outline" className="text-destructive" onClick={() => {
                  if (confirm(`Refund ${r.price === null ? "(no charge yet)" : money(r.price)} to the buyer for ${r.code}?`)) refundM.mutate(r.id);
                }}><Undo2 className="h-3.5 w-3.5 mr-1" />Refund</Button>
                {(r.status === "assigned" || r.status === "in_progress" || r.status === "otp_sent") && (
                  <Button size="sm" variant="outline" onClick={() => {
                    const otpCode = prompt(`Force-complete ${r.code} — the seller is unresponsive but you've confirmed the OTP some other way. Enter it:`);
                    if (otpCode) forceCompleteM.mutate({ id: r.id, otpCode });
                  }}><CheckCheck className="h-3.5 w-3.5 mr-1" />Force complete</Button>
                )}
              </div>
            )
          ) },
        ]}
        empty="No requests found."
      />
    </div>
  );
}
