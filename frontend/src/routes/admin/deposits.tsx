import { useState } from "react";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { PageHeader } from "@/components/common/PageHeader";
import { AdminTable, StatusPill } from "@/components/admin/AdminTable";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { api } from "@/lib/apiClient";
import { money, dateTime } from "@/utils/format";
import { toast } from "sonner";
import { Check, X } from "lucide-react";

interface Deposit {
  id: string;
  user: string;
  email: string;
  userId: string;
  amount: number;
  method: string;
  utr: string;
  status: string;
  note: string;
  createdAt: string;
  approvedAt: string | null;
  approvedBy: string | null;
}

// Manual-review fallback deposits — created when a Paytm/BharatPe QR payment's
// auto-verify (transaction-history match) didn't confirm in time after the
// user submitted a UTR. Cross-check the UTR/amount against the BharatPe
// Settings page's live transaction list (or the provider's own dashboard)
// before approving. See backend/src/routes/payments.ts POST /paytm/submit-utr.
export default function AdminDeposits() {
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ["admin", "deposits", "all"], queryFn: () => api.get<Deposit[]>("/api/admin/deposits?status=all") });
  const all = q.data ?? [];
  const [tab, setTab] = useState("pending");
  const filter = (s: string) => (s === "all" ? all : all.filter((d) => d.status === s));

  const approveM = useMutation({
    mutationFn: (id: string) => api.post<{ new_balance: number }>(`/api/admin/deposits/${id}/approve`),
    onSuccess: (r) => {
      toast.success(`Approved — wallet credited, new balance ${money(r.new_balance)}`);
      qc.invalidateQueries({ queryKey: ["admin", "deposits", "all"] });
    },
    onError: (e: any) => toast.error(e?.message || "Could not approve deposit"),
  });

  const rejectM = useMutation({
    mutationFn: (id: string) => api.post(`/api/admin/deposits/${id}/reject`, { reason: "Rejected by admin" }),
    onSuccess: () => {
      toast.success("Deposit rejected");
      qc.invalidateQueries({ queryKey: ["admin", "deposits", "all"] });
    },
    onError: (e: any) => toast.error(e?.message || "Could not reject deposit"),
  });

  const cols = [
    { key: "id", header: "Deposit", cell: (d: Deposit) => <span className="font-mono text-xs">{d.id.slice(0, 8)}</span> },
    { key: "u", header: "User", cell: (d: Deposit) => <div><p className="font-medium">{d.user}</p><p className="text-xs text-muted-foreground">{d.email}</p></div> },
    { key: "a", header: "Amount", cell: (d: Deposit) => <span className="tabular-nums font-medium">{money(d.amount)}</span> },
    { key: "m", header: "Method", cell: (d: Deposit) => d.method },
    { key: "utr", header: "UTR", cell: (d: Deposit) => <span className="font-mono text-xs">{d.utr || "—"}</span> },
    { key: "note", header: "Note", cell: (d: Deposit) => <span className="text-xs text-muted-foreground">{d.note}</span> },
    { key: "st", header: "Status", cell: (d: Deposit) => <StatusPill status={d.status} /> },
    { key: "d", header: "Submitted", cell: (d: Deposit) => <span className="text-xs">{dateTime(d.createdAt)}</span> },
    { key: "act", header: "", cell: (d: Deposit) => (
      <div className="flex gap-1">
        <Button
          variant="ghost" size="icon" disabled={d.status !== "pending" || approveM.isPending}
          title="Approve — credit the wallet"
          onClick={() => { if (confirm(`Approve this ₹${d.amount} deposit? This immediately credits the user's wallet.`)) approveM.mutate(d.id); }}
        >
          <Check className="h-4 w-4 text-success" />
        </Button>
        <Button
          variant="ghost" size="icon" disabled={d.status !== "pending" || rejectM.isPending}
          title="Reject — no money moves"
          onClick={() => { if (confirm(`Reject this ₹${d.amount} deposit? No wallet credit will happen.`)) rejectM.mutate(d.id); }}
        >
          <X className="h-4 w-4 text-destructive" />
        </Button>
      </div>
    ) },
  ];

  return (
    <div>
      <PageHeader
        title="Deposits"
        description="Manual-review UPI/BharatPe deposits — auto-verify didn't confirm these in time. Cross-check the UTR against the provider's transaction list before approving."
      />
      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="pending">Pending ({filter("pending").length})</TabsTrigger>
          <TabsTrigger value="approved">Approved ({filter("approved").length})</TabsTrigger>
          <TabsTrigger value="rejected">Rejected ({filter("rejected").length})</TabsTrigger>
          <TabsTrigger value="all">All ({all.length})</TabsTrigger>
        </TabsList>
        {["pending", "approved", "rejected", "all"].map((t) => (
          <TabsContent key={t} value={t} className="mt-4">
            <AdminTable rows={filter(t)} columns={cols} empty="No deposits here" />
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
}
