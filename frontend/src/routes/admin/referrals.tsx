import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { PageHeader } from "@/components/common/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { StatCard } from "@/components/common/StatCard";
import { toast } from "sonner";
import { Users, Percent, DollarSign, Trash2 } from "lucide-react";
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

interface ReferralSettings {
  percent: number;
  enabled: boolean;
}

export default function Page() {
  const qc = useQueryClient();
  const itemsQ = useQuery({ queryKey: ["admin", "referrals"], queryFn: () => api.get<ReferralRow[]>("/api/referrals") });
  const settingsQ = useQuery({ queryKey: ["admin", "referral-settings"], queryFn: () => api.get<ReferralSettings>("/api/referrals/settings") });

  const items = itemsQ.data ?? [];
  const percent = settingsQ.data?.percent ?? 10;
  const enabled = settingsQ.data?.enabled ?? true;
  const [draft, setDraft] = useState<number | null>(null);
  const effectiveDraft = draft ?? percent;

  const invalidateSettings = () => qc.invalidateQueries({ queryKey: ["admin", "referral-settings"] });
  const invalidateItems = () => qc.invalidateQueries({ queryKey: ["admin", "referrals"] });

  const setPercentM = useMutation({
    mutationFn: (v: number) => api.post("/api/admin/referrals/percent", { percent: v }),
    onSuccess: (_data, v) => { toast.success(`Saved: ${v}%`); invalidateSettings(); },
    onError: (e: any) => toast.error(e?.message || "Failed to save"),
  });

  const setEnabledM = useMutation({
    mutationFn: (v: boolean) => api.post("/api/admin/referrals/enabled", { enabled: v }),
    onSuccess: (_data, v) => { toast.success(`Referral program ${v ? "enabled" : "paused"}`); invalidateSettings(); },
    onError: (e: any) => toast.error(e?.message || "Failed to save"),
  });

  const removeM = useMutation({
    mutationFn: (id: string) => api.del(`/api/admin/referrals/${id}`),
    onSuccess: () => { toast.success("Removed"); invalidateItems(); },
    onError: (e: any) => toast.error(e?.message || "Failed to remove"),
  });

  const totalEarned = items.reduce((s, r) => s + r.earned, 0);
  const active = items.filter((r) => r.status === "active").length;

  return (
    <div>
      <PageHeader
        title="Referral program"
        description="Set the commission percentage. Every referred user pays that much more, and the referrer earns the same amount."
      />

      <div className="grid gap-4 grid-cols-2 lg:grid-cols-4 mb-6">
        <StatCard label="Commission %" value={`${percent}%`} icon={Percent} tone="brand" />
        <StatCard label="Referrals" value={String(items.length)} icon={Users} tone="info" />
        <StatCard label="Active" value={String(active)} icon={Users} tone="success" />
        <StatCard label="Total paid out" value={`$${totalEarned.toFixed(2)}`} icon={DollarSign} tone="warning" />
      </div>

      <Card className="shadow-glow border-primary/10 mb-6">
        <CardHeader><CardTitle>Configuration</CardTitle></CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-3 items-end">
          <div className="sm:col-span-1">
            <Label>Commission percentage</Label>
            <div className="flex items-center gap-2 mt-1">
              <Input
                type="number"
                min={0}
                max={100}
                value={effectiveDraft}
                onChange={(e) => setDraft(Number(e.target.value))}
              />
              <span className="text-sm text-muted-foreground">%</span>
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              Users referred by someone will be charged {effectiveDraft}% more, and their referrer earns the same amount.
            </p>
          </div>
          <div className="flex items-center justify-between p-3 border rounded-lg">
            <div>
              <p className="text-sm font-medium">Program status</p>
              <p className="text-xs text-muted-foreground">Turn the referral program on or off</p>
            </div>
            <Switch checked={enabled} onCheckedChange={(v) => setEnabledM.mutate(v)} />
          </div>
          <div className="flex justify-end">
            <Button className="gradient-brand" onClick={() => setPercentM.mutate(effectiveDraft)} disabled={setPercentM.isPending}>
              Save changes
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card className="shadow-soft">
        <CardHeader><CardTitle>All referrals</CardTitle></CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Referrer</TableHead>
                <TableHead>Referred user</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Joined</TableHead>
                <TableHead className="text-right">Earned</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.length === 0 && (
                <TableRow><TableCell colSpan={6} className="text-center text-sm text-muted-foreground py-8">No referrals yet</TableCell></TableRow>
              )}
              {items.map((r) => (
                <TableRow key={r.id}>
                  <TableCell className="font-mono text-xs">{r.referrerEmail ?? r.referrerId}</TableCell>
                  <TableCell>{r.refereeEmail}</TableCell>
                  <TableCell><Badge variant={r.status === "active" ? "default" : "secondary"}>{r.status}</Badge></TableCell>
                  <TableCell className="text-sm text-muted-foreground">{new Date(r.joinedAt).toLocaleDateString()}</TableCell>
                  <TableCell className="text-right font-medium">${r.earned.toFixed(2)}</TableCell>
                  <TableCell className="text-right">
                    <Button size="sm" variant="ghost" onClick={() => removeM.mutate(r.id)} disabled={removeM.isPending}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
