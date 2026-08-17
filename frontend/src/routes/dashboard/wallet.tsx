import { Link } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { PageHeader } from "@/components/common/PageHeader";
import { StatCard } from "@/components/common/StatCard";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Wallet, Gift, Plus, Ticket } from "lucide-react";
import { api } from "@/lib/apiClient";
import { money, dateTime } from "@/utils/format";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";

interface WalletTx {
  id: string;
  type: string;
  amount: number;
  balance: number;
  method?: string;
  note?: string;
  createdAt: string;
}

function RedeemCard() {
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const qc = useQueryClient();
  const redeem = async () => {
    if (!code.trim()) return toast.error("Enter a code");
    setBusy(true);
    try {
      const row = await api.post<{ amount?: number; newBalance?: number }>("/api/wallet/redeem-gift-code", { code: code.trim() });
      toast.success(`🎁 ₹${row?.amount ?? ""} credited · new balance ₹${row?.newBalance ?? ""}`);
      setCode("");
      qc.invalidateQueries({ queryKey: ["wallet"] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Redeem failed");
    } finally {
      setBusy(false);
    }
  };
  return (
    <Card className="shadow-soft border-primary/20">
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Gift className="h-4 w-4 text-primary" />
          Redeem a gift code
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex gap-2">
          <Input
            placeholder="Enter gift code (e.g. GIFT-ABC123)"
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            className="font-mono uppercase"
          />
          <Button onClick={redeem} disabled={busy}>
            <Ticket className="mr-2 h-4 w-4" />
            {busy ? "Redeeming…" : "Redeem"}
          </Button>
        </div>
        <p className="text-xs text-muted-foreground mt-2">Each gift code can be redeemed once per account.</p>
      </CardContent>
    </Card>
  );
}

export default function WalletPage() {
  const bal = useQuery({ queryKey: ["wallet", "balance"], queryFn: () => api.get<{ balance: number }>("/api/wallet/balance") });
  const tx = useQuery({ queryKey: ["wallet", "tx"], queryFn: () => api.get<WalletTx[]>("/api/wallet/transactions") });
  const totalDeposits = (tx.data ?? []).filter((t) => t.type === "deposit").reduce((s, t) => s + Math.max(0, t.amount), 0);
  const totalSpent = Math.abs((tx.data ?? []).filter((t) => t.type === "purchase").reduce((s, t) => s + Math.min(0, t.amount), 0));
  const totalBonus = (tx.data ?? []).filter((t) => t.type === "bonus").reduce((s, t) => s + Math.max(0, t.amount), 0);
  return (
    <div>
      <PageHeader
        title="Wallet"
        description="Your credits and transaction history."
        actions={
          <Button asChild className="gradient-brand">
            <Link to="/dashboard/deposit">
              <Plus className="mr-1 h-4 w-4" />
              Deposit
            </Link>
          </Button>
        }
      />
      <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
        <StatCard label="Balance" value={bal.data ? money(bal.data.balance) : "—"} icon={Wallet} tone="brand" />
        <StatCard label="Total deposits" value={money(totalDeposits)} icon={Wallet} tone="success" />
        <StatCard label="Total spent" value={money(totalSpent)} icon={Wallet} tone="info" />
        <StatCard label="Bonuses earned" value={money(totalBonus)} icon={Gift} tone="warning" />
      </div>
      <div className="mt-6">
        <RedeemCard />
      </div>
      <Card className="mt-6 shadow-soft">
        <CardHeader>
          <CardTitle>Transactions</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>ID</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Method / Note</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                  <TableHead className="text-right">Balance</TableHead>
                  <TableHead>Date</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {tx.isLoading
                  ? Array.from({ length: 5 }).map((_, i) => (
                      <TableRow key={i}>
                        <TableCell colSpan={6}>
                          <Skeleton className="h-6 w-full" />
                        </TableCell>
                      </TableRow>
                    ))
                  : (tx.data ?? []).map((t) => (
                      <TableRow key={t.id}>
                        <TableCell className="font-mono text-xs">{t.id}</TableCell>
                        <TableCell className="capitalize">{t.type}</TableCell>
                        <TableCell className="text-sm text-muted-foreground">{t.method ?? t.note ?? "—"}</TableCell>
                        <TableCell className={"text-right font-medium " + (t.amount >= 0 ? "text-success" : "text-destructive")}>
                          {t.amount >= 0 ? "+" : ""}
                          {money(t.amount)}
                        </TableCell>
                        <TableCell className="text-right">{money(Math.max(0, t.balance))}</TableCell>
                        <TableCell className="text-xs text-muted-foreground whitespace-nowrap">{dateTime(t.createdAt)}</TableCell>
                      </TableRow>
                    ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
