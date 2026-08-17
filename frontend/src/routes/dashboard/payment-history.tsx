import { useQuery } from "@tanstack/react-query";
import { PageHeader } from "@/components/common/PageHeader";
import { EmptyState } from "@/components/common/EmptyState";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { api } from "@/lib/apiClient";
import { money, dateTime } from "@/utils/format";

interface WalletTx {
  id: string;
  type: string;
  amount: number;
  balance: number;
  method?: string;
  note?: string;
  createdAt: string;
}

export default function Page() {
  const { data: tx = [], isLoading } = useQuery({ queryKey: ["wallet", "tx"], queryFn: () => api.get<WalletTx[]>("/api/wallet/transactions") });
  const deposits = tx.filter((t) => t.type === "deposit" || t.type === "bonus");
  return (
    <div>
      <PageHeader title="Payment History" description="Every deposit on record" />
      {isLoading ? null : deposits.length === 0 ? (
        <EmptyState title="No payments yet" description="Your deposits will appear here." />
      ) : (
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Method</TableHead>
                  <TableHead>Note</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                  <TableHead className="text-right">Balance</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {deposits.map((t) => (
                  <TableRow key={t.id}>
                    <TableCell>{dateTime(t.createdAt)}</TableCell>
                    <TableCell><Badge variant="secondary">{t.type}</Badge></TableCell>
                    <TableCell>{t.method ?? "-"}</TableCell>
                    <TableCell className="text-muted-foreground">{t.note ?? "-"}</TableCell>
                    <TableCell className="text-right text-emerald-500">+{money(t.amount)}</TableCell>
                    <TableCell className="text-right">{money(t.balance)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
