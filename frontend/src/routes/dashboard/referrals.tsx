import { useQuery } from "@tanstack/react-query";
import { PageHeader } from "@/components/common/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { StatCard } from "@/components/common/StatCard";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { useUserStore } from "@/store/userStore";
import { Copy, Users, DollarSign, TrendingUp, Send } from "lucide-react";
import { toast } from "sonner";
import { api } from "@/lib/apiClient";

interface ReferralRow {
  id: string;
  referrerId: string;
  referrerEmail?: string;
  refereeEmail: string;
  earned: number;
  status: "active" | "pending";
  joinedAt: string;
}
interface ReferralSettings { percent: number; enabled: boolean }

export default function Referrals() {
  const user = useUserStore((s) => s.user);
  const items = useQuery({ queryKey: ["referrals"], queryFn: () => api.get<ReferralRow[]>("/api/referrals/") });
  const settings = useQuery({ queryKey: ["referrals", "settings"], queryFn: () => api.get<ReferralSettings>("/api/referrals/settings") });
  const percent = settings.data?.percent ?? 10;
  const enabled = settings.data?.enabled ?? true;
  const rows = items.data ?? [];
  const totalEarned = rows.reduce((s, r) => s + r.earned, 0);
  const activeCount = rows.filter((r) => r.status === "active").length;
  const link = `https://tenotp.pro/r/${user?.id ?? ""}`;
  return (
    <div>
      <PageHeader
        title="Referral program"
        description={enabled ? `Earn ${percent}% commission for every friend you invite.` : "Referral program is currently paused."}
      />
      <div className="grid gap-4 grid-cols-2 lg:grid-cols-4 mb-6">
        <StatCard label="Total referrals" value={String(rows.length)} icon={Users} tone="brand" />
        <StatCard label="Active" value={String(activeCount)} icon={TrendingUp} tone="success" />
        <StatCard label="Commission rate" value={`${percent}%`} icon={DollarSign} tone="info" />
        <StatCard label="Total earned" value={`₹${totalEarned.toFixed(2)}`} icon={DollarSign} tone="warning" />
      </div>

      <Card className="shadow-glow border-primary/10 mb-6"><CardContent className="p-6">
        <h3 className="font-semibold">Your referral link</h3>
        <div className="mt-3 flex gap-2">
          <Input readOnly value={link} className="font-mono text-sm" />
          <Button onClick={() => { navigator.clipboard.writeText(link); toast.success("Copied"); }}><Copy className="h-4 w-4 mr-1" />Copy</Button>
          <Button className="gradient-brand" onClick={() => toast.success("Invite sent")}><Send className="h-4 w-4 mr-1" />Invite</Button>
        </div>
      </CardContent></Card>

      <Card className="shadow-soft"><CardHeader><CardTitle>Referral history</CardTitle></CardHeader>
        <CardContent className="p-0"><Table>
          <TableHeader><TableRow><TableHead>User</TableHead><TableHead>Status</TableHead><TableHead className="text-right">Earned</TableHead></TableRow></TableHeader>
          <TableBody>
            {rows.length === 0 && (
              <TableRow><TableCell colSpan={3} className="text-center text-sm text-muted-foreground py-6">No referrals yet — share your link!</TableCell></TableRow>
            )}
            {rows.map((h) => (
              <TableRow key={h.id}>
                <TableCell className="flex items-center gap-2"><Avatar className="h-7 w-7"><AvatarFallback>{h.refereeEmail[0]?.toUpperCase()}</AvatarFallback></Avatar><span className="text-sm">{h.refereeEmail}</span></TableCell>
                <TableCell><Badge variant={h.status === "active" ? "default" : "secondary"}>{h.status}</Badge></TableCell>
                <TableCell className="text-right font-medium">₹{h.earned.toFixed(2)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table></CardContent>
      </Card>
    </div>
  );
}
