import { useEffect, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { PageHeader } from "@/components/common/PageHeader";
import { StatCard } from "@/components/common/StatCard";
import { AdminTable, StatusPill } from "@/components/admin/AdminTable";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Wallet, Clock, TrendingUp, Landmark } from "lucide-react";
import { api } from "@/lib/apiClient";
import { money, dateTime } from "@/utils/format";
import { toast } from "sonner";

interface LedgerRow { id: string; type: string; amount: number; pendingBalanceAfter: number; availableBalanceAfter: number; note: string; createdAt: string }
interface SettlementRow { id: string; amount: number; status: string; requestCount: number; txnRef: string | null; createdAt: string; decidedAt: string | null }
interface SellerMe { pendingBalance: number; availableBalance: number; totalEarnings: number; totalPaidOut: number }
interface PayoutDetails { upiId: string; bankAccountName: string; bankAccountNumber: string; bankIfsc: string }

function PayoutDetailsCard() {
  const q = useQuery({ queryKey: ["seller", "payout-details"], queryFn: () => api.get<PayoutDetails>("/api/manual-providers/seller/payout-details") });
  const [dirty, setDirty] = useState(false);
  const [form, setForm] = useState<PayoutDetails>({ upiId: "", bankAccountName: "", bankAccountNumber: "", bankIfsc: "" });
  useEffect(() => { if (q.data && !dirty) setForm(q.data); }, [q.data, dirty]);
  const update = (patch: Partial<PayoutDetails>) => { setForm((f) => ({ ...f, ...patch })); setDirty(true); };

  const saveM = useMutation({
    mutationFn: () => api.patch("/api/manual-providers/seller/payout-details", form),
    onSuccess: () => { toast.success("Payout details saved"); setDirty(false); },
    onError: (e: any) => toast.error(e?.message || "Could not save"),
  });

  return (
    <Card className="shadow-soft mb-6">
      <CardHeader><CardTitle className="text-base flex items-center gap-2"><Landmark className="h-4 w-4" />Payout details</CardTitle></CardHeader>
      <CardContent className="space-y-4">
        <p className="text-xs text-muted-foreground">Where admin sends your settlement payouts. This is informational — money isn't moved automatically, but admin needs this to pay you.</p>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="grid gap-1.5"><Label>UPI ID</Label><Input value={form.upiId} onChange={(e) => update({ upiId: e.target.value })} placeholder="yourname@bank" /></div>
          <div className="grid gap-1.5"><Label>Account holder name</Label><Input value={form.bankAccountName} onChange={(e) => update({ bankAccountName: e.target.value })} /></div>
          <div className="grid gap-1.5"><Label>Bank account number</Label><Input value={form.bankAccountNumber} onChange={(e) => update({ bankAccountNumber: e.target.value })} /></div>
          <div className="grid gap-1.5"><Label>IFSC code</Label><Input value={form.bankIfsc} onChange={(e) => update({ bankIfsc: e.target.value.toUpperCase() })} /></div>
        </div>
        <Button className="gradient-brand" disabled={saveM.isPending} onClick={() => saveM.mutate()}>{saveM.isPending ? "Saving…" : "Save payout details"}</Button>
      </CardContent>
    </Card>
  );
}

export default function SellerBalance() {
  const me = useQuery({ queryKey: ["seller", "me"], queryFn: () => api.get<SellerMe>("/api/manual-providers/seller/me") });
  const ledger = useQuery({ queryKey: ["seller", "ledger"], queryFn: () => api.get<LedgerRow[]>("/api/manual-providers/seller/ledger") });
  const settlements = useQuery({ queryKey: ["seller", "settlements"], queryFn: () => api.get<SettlementRow[]>("/api/manual-providers/seller/settlements") });

  return (
    <div>
      <PageHeader title="Balance & settlements" description="Request a withdrawal from the Dashboard; admin approves and pays it out to the details below." />
      <div className="grid gap-4 grid-cols-2 lg:grid-cols-4 mb-6">
        <StatCard label="Pending" value={money(me.data?.pendingBalance ?? 0)} icon={Clock} tone="warning" />
        <StatCard label="Available" value={money(me.data?.availableBalance ?? 0)} icon={Wallet} tone="success" />
        <StatCard label="Total earned" value={money(me.data?.totalEarnings ?? 0)} icon={TrendingUp} tone="brand" />
        <StatCard label="Total paid out" value={money(me.data?.totalPaidOut ?? 0)} icon={Wallet} tone="info" />
      </div>

      <PayoutDetailsCard />

      <div className="mt-6">
        <h3 className="mb-2 text-sm font-semibold">Settlement history</h3>
        <AdminTable
          rows={settlements.data ?? []}
          columns={[
            { key: "a", header: "Amount", cell: (r: SettlementRow) => money(r.amount) },
            { key: "c", header: "Requests", cell: (r: SettlementRow) => r.requestCount },
            { key: "st", header: "Status", cell: (r: SettlementRow) => <StatusPill status={r.status === "paid" ? "approved" : r.status === "rejected" ? "rejected" : "pending"} /> },
            { key: "ref", header: "Reference", cell: (r: SettlementRow) => r.txnRef ?? "—" },
            { key: "d", header: "Created", cell: (r: SettlementRow) => <span className="text-xs">{dateTime(r.createdAt)}</span> },
          ]}
          empty="No settlements yet."
        />
      </div>

      <div className="mt-6">
        <h3 className="mb-2 text-sm font-semibold">Earnings ledger</h3>
        <AdminTable
          rows={ledger.data ?? []}
          columns={[
            { key: "t", header: "Type", cell: (r: LedgerRow) => <span className="capitalize">{r.type.replace("_", " ")}</span> },
            { key: "a", header: "Amount", cell: (r: LedgerRow) => money(r.amount) },
            { key: "n", header: "Note", cell: (r: LedgerRow) => <span className="text-xs">{r.note}</span> },
            { key: "d", header: "Date", cell: (r: LedgerRow) => <span className="text-xs">{dateTime(r.createdAt)}</span> },
          ]}
          empty="No transactions yet."
        />
      </div>
    </div>
  );
}
