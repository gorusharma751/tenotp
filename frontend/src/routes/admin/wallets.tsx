import { useState } from "react";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { PageHeader } from "@/components/common/PageHeader";
import { AdminTable, StatusPill } from "@/components/admin/AdminTable";
import { Toolbar } from "@/components/admin/Toolbar";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { api } from "@/lib/apiClient";
import { money, dateTime } from "@/utils/format";
import { toast } from "sonner";
import { Plus, Minus, Snowflake, Sun, type LucideIcon } from "lucide-react";
import type { AdminWallet } from "@/types";

function AdjustDialog({ userId, userLabel, direction, icon: Icon }: { userId: string; userLabel: string; direction: "credit" | "debit"; icon: LucideIcon }) {
  const [open, setOpen] = useState(false);
  const [amt, setAmt] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const qc = useQueryClient();
  const label = direction === "credit" ? "Add balance" : "Deduct balance";
  const confirm = async () => {
    const n = Number(amt);
    if (!n || n <= 0) return toast.error("Enter a valid amount");
    setBusy(true);
    try {
      const r = await api.post<{ new_balance: number }>("/api/admin/wallet/adjust", { user_id: userId, amount: n, direction, note });
      toast.success(`${label} · new balance ₹${r.new_balance}`);
      setOpen(false); setAmt(""); setNote("");
      qc.invalidateQueries({ queryKey: ["admin", "wallets"] });
    } catch (e: any) {
      toast.error(e?.message || "Failed");
    } finally { setBusy(false); }
  };
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild><Button variant="ghost" size="icon" title={label}><Icon className="h-4 w-4" /></Button></DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>{label} — {userLabel}</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div>
            <Label>Amount</Label>
            <Input type="number" min="0" step="0.01" value={amt} onChange={(e) => setAmt(e.target.value)} placeholder="0.00" />
          </div>
          <div>
            <Label>Note (optional)</Label>
            <Input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Reason / reference" />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)} disabled={busy}>Cancel</Button>
          <Button onClick={confirm} disabled={busy}>{busy ? "Processing…" : "Confirm"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default function Page() {
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ["admin", "wallets"], queryFn: () => api.get<AdminWallet[]>("/api/admin/wallets") });
  const [query, setQuery] = useState("");

  const freezeM = useMutation({
    mutationFn: ({ userId, frozen }: { userId: string; frozen: boolean }) => api.post("/api/admin/wallet/freeze", { user_id: userId, frozen }),
    onSuccess: (_data, { frozen }) => {
      toast.success(frozen ? "Wallet frozen" : "Wallet unfrozen");
      qc.invalidateQueries({ queryKey: ["admin", "wallets"] });
    },
    onError: (e: any) => toast.error(e?.message || "Failed"),
  });

  const rows = (q.data ?? []).filter((w) => w.user.toLowerCase().includes(query.toLowerCase()) || w.email.toLowerCase().includes(query.toLowerCase()));
  return (
    <div>
      <PageHeader title="Wallets" description="Adjust balances, freeze / unfreeze accounts, and audit transactions." />
      <Toolbar query={query} onQuery={setQuery} placeholder="Search user or email..." />
      <AdminTable rows={rows} columns={[
        { key: "u", header: "User", cell: (w) => <div><p className="font-medium">{w.user}</p><p className="text-xs text-muted-foreground">{w.email}</p></div> },
        { key: "b", header: "Balance", cell: (w) => <span className="tabular-nums font-medium">{money(w.balance)}</span> },
        { key: "l", header: "Lifetime", cell: (w) => <span className="tabular-nums text-muted-foreground">{money(w.lifetime)}</span> },
        { key: "st", header: "Status", cell: (w) => <StatusPill status={w.frozen ? "blocked" : "active"} /> },
        { key: "d", header: "Updated", cell: (w) => <span className="text-xs">{dateTime(w.updatedAt)}</span> },
        { key: "act", header: "", cell: (w) => (
          <div className="flex gap-1">
            <AdjustDialog userId={w.userId} userLabel={w.user || w.email} direction="credit" icon={Plus} />
            <AdjustDialog userId={w.userId} userLabel={w.user || w.email} direction="debit" icon={Minus} />
            <Button
              variant="ghost" size="icon" title={w.frozen ? "Unfreeze wallet" : "Freeze wallet"}
              onClick={() => {
                const label = w.user || w.email;
                const msg = w.frozen ? `Unfreeze ${label}'s wallet? They'll be able to spend/deposit again.` : `Freeze ${label}'s wallet? They won't be able to spend or deposit until unfrozen.`;
                if (confirm(msg)) freezeM.mutate({ userId: w.userId, frozen: !w.frozen });
              }}
            >
              {w.frozen ? <Sun className="h-4 w-4 text-amber-500" /> : <Snowflake className="h-4 w-4" />}
            </Button>
          </div>
        ) },
      ]} />
    </div>
  );
}
