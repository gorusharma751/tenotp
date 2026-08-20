import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { PageHeader } from "@/components/common/PageHeader";
import { AdminTable, StatusPill } from "@/components/admin/AdminTable";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { api } from "@/lib/apiClient";
import { dateTime } from "@/utils/format";
import { toast } from "sonner";

interface AdminDispute {
  id: string; requestId: string; buyerEmail: string | null; providerName: string | null; reason: string;
  proofImage: string | null; status: string; createdAt: string;
}

export default function AdminManualProviderDisputes() {
  const qc = useQueryClient();
  const [status, setStatus] = useState("pending");
  const q = useQuery({
    queryKey: ["admin", "mp", "disputes", status],
    queryFn: () => api.get<AdminDispute[]>(`/api/manual-providers/admin/disputes${status !== "all" ? `?status=${status}` : ""}`),
  });
  const decideM = useMutation({
    mutationFn: (v: { id: string; decision: "approved" | "rejected" }) => api.post(`/api/manual-providers/admin/disputes/${v.id}/decide`, { decision: v.decision }),
    onSuccess: () => { toast.success("Decision recorded"); qc.invalidateQueries({ queryKey: ["admin", "mp", "disputes"] }); },
    onError: (e: any) => toast.error(e?.message || "Could not decide"),
  });

  return (
    <div>
      <PageHeader
        title="Disputes"
        description="Buyer-filed disputes across all sellers — usually the seller decides these themselves, but admin can override."
        actions={
          <Select value={status} onValueChange={setStatus}>
            <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
            <SelectContent>{["pending", "approved", "rejected", "all"].map((s) => <SelectItem key={s} value={s}>{s === "all" ? "All" : s}</SelectItem>)}</SelectContent>
          </Select>
        }
      />
      <AdminTable
        rows={q.data ?? []}
        columns={[
          { key: "b", header: "Buyer", cell: (d: AdminDispute) => <span className="text-xs">{d.buyerEmail ?? "—"}</span> },
          { key: "p", header: "Provider", cell: (d: AdminDispute) => d.providerName ?? "—" },
          { key: "r", header: "Reason", cell: (d: AdminDispute) => <span className="text-xs">{d.reason}</span> },
          { key: "proof", header: "Proof", cell: (d: AdminDispute) => d.proofImage ? <a href={d.proofImage} target="_blank" rel="noreferrer" className="text-primary underline text-xs">View</a> : "—" },
          { key: "st", header: "Status", cell: (d: AdminDispute) => <StatusPill status={d.status === "approved" ? "approved" : d.status === "rejected" ? "rejected" : "pending"} /> },
          { key: "d", header: "Opened", cell: (d: AdminDispute) => <span className="text-xs">{dateTime(d.createdAt)}</span> },
          { key: "act", header: "", cell: (d: AdminDispute) => d.status === "pending" && (
            <div className="flex gap-1">
              <Button size="sm" variant="outline" className="text-destructive" onClick={() => { if (confirm("Approve — refund the buyer and reverse the seller's earning for this request?")) decideM.mutate({ id: d.id, decision: "approved" }); }}>Approve refund</Button>
              <Button size="sm" variant="outline" onClick={() => decideM.mutate({ id: d.id, decision: "rejected" })}>Reject</Button>
            </div>
          ) },
        ]}
        empty="No disputes."
      />
    </div>
  );
}
