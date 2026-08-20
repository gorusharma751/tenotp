import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { PageHeader } from "@/components/common/PageHeader";
import { AdminTable, StatusPill } from "@/components/admin/AdminTable";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Plus, Check, X, Landmark } from "lucide-react";
import { api } from "@/lib/apiClient";
import { money, dateTime } from "@/utils/format";
import { toast } from "sonner";

interface SettlementRow {
  id: string; providerId: string; providerName: string | null; amount: number; status: string; requestCount: number; txnRef: string | null; createdAt: string;
  upiId: string | null; bankAccountName: string | null; bankAccountNumber: string | null; bankIfsc: string | null;
}
interface ProviderOption { id: string; companyName: string; pendingBalance: number }

export default function AdminManualProviderSettlements() {
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ["admin", "mp", "settlements"], queryFn: () => api.get<SettlementRow[]>("/api/manual-providers/admin/settlements") });
  const providers = useQuery({ queryKey: ["admin", "mp", "providers"], queryFn: () => api.get<ProviderOption[]>("/api/manual-providers/admin/providers") });

  const [open, setOpen] = useState(false);
  const [providerId, setProviderId] = useState("");
  const createM = useMutation({
    mutationFn: () => api.post("/api/manual-providers/admin/settlements", { providerId }),
    onSuccess: () => { toast.success("Settlement created"); setOpen(false); setProviderId(""); qc.invalidateQueries({ queryKey: ["admin", "mp", "settlements"] }); qc.invalidateQueries({ queryKey: ["admin", "mp", "providers"] }); },
    onError: (e: any) => toast.error(e?.message || "Could not create settlement"),
  });

  const decideM = useMutation({
    mutationFn: (v: { id: string; decision: "paid" | "rejected" }) => api.post(`/api/manual-providers/admin/settlements/${v.id}/decide`, { decision: v.decision }),
    onSuccess: () => { toast.success("Updated"); qc.invalidateQueries({ queryKey: ["admin", "mp", "settlements"] }); },
    onError: (e: any) => toast.error(e?.message || "Could not update settlement"),
  });

  const eligible = (providers.data ?? []).filter((p) => p.pendingBalance > 0);

  return (
    <div>
      <PageHeader
        title="Settlements"
        description="Batch a provider's pending earnings, approve, then mark paid once the payout is sent externally."
        actions={
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild><Button className="gradient-brand"><Plus className="h-4 w-4 mr-1" />New settlement</Button></DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Create a settlement</DialogTitle></DialogHeader>
              <div className="grid gap-3">
                <div className="grid gap-1.5">
                  <Label>Provider (with pending balance)</Label>
                  <Select value={providerId} onValueChange={setProviderId}>
                    <SelectTrigger><SelectValue placeholder="Choose a provider" /></SelectTrigger>
                    <SelectContent>
                      {eligible.map((p) => <SelectItem key={p.id} value={p.id}>{p.companyName} — {money(p.pendingBalance)} pending</SelectItem>)}
                    </SelectContent>
                  </Select>
                  {eligible.length === 0 && <p className="text-xs text-muted-foreground">No provider currently has a pending balance.</p>}
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
                <Button className="gradient-brand" disabled={!providerId || createM.isPending} onClick={() => createM.mutate()}>{createM.isPending ? "Creating…" : "Create settlement"}</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        }
      />
      <AdminTable
        rows={q.data ?? []}
        columns={[
          { key: "p", header: "Provider", cell: (r) => r.providerName ?? "—" },
          { key: "pay", header: "Pay to", cell: (r) => (
            <div className="text-xs">
              {r.upiId && <div>UPI: {r.upiId}</div>}
              {r.bankAccountNumber && <div>{r.bankAccountNumber} ({r.bankIfsc})</div>}
              {!r.upiId && !r.bankAccountNumber && <span className="text-muted-foreground italic">not set</span>}
            </div>
          ) },
          { key: "a", header: "Amount", cell: (r) => money(r.amount) },
          { key: "c", header: "Requests", cell: (r) => r.requestCount },
          { key: "st", header: "Status", cell: (r) => <StatusPill status={r.status === "paid" ? "approved" : r.status === "rejected" ? "rejected" : "pending"} /> },
          { key: "ref", header: "Reference", cell: (r) => r.txnRef ?? "—" },
          { key: "d", header: "Created", cell: (r) => <span className="text-xs">{dateTime(r.createdAt)}</span> },
          { key: "act", header: "", cell: (r) => (
            r.status === "pending" ? (
              <div className="flex gap-1">
                <Button size="sm" onClick={() => decideM.mutate({ id: r.id, decision: "paid" })}><Landmark className="h-3.5 w-3.5 mr-1" />Mark paid</Button>
                <Button size="sm" variant="outline" className="text-destructive" onClick={() => decideM.mutate({ id: r.id, decision: "rejected" })}><X className="h-3.5 w-3.5" /></Button>
              </div>
            ) : r.status === "paid" ? <Check className="h-4 w-4 text-success" /> : null
          ) },
        ]}
        empty="No settlements yet."
      />
    </div>
  );
}
