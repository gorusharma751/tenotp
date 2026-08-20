import { useEffect, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { PageHeader } from "@/components/common/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { api } from "@/lib/apiClient";
import { toast } from "sonner";

interface Settings { marginPercent: number; minCancelMs: number; maxDisputeRefunds: number; assignExpiryMinutes: number; otpAutoConfirmMinutes: number }

export default function AdminManualProviderSettings() {
  const q = useQuery({ queryKey: ["admin", "mp", "settings"], queryFn: () => api.get<Settings>("/api/manual-providers/admin/settings") });
  const [dirty, setDirty] = useState(false);
  const [form, setForm] = useState({ marginPercent: "30", minCancelMs: "0", maxDisputeRefunds: "3", assignExpiryMinutes: "10", otpAutoConfirmMinutes: "10" });

  useEffect(() => {
    if (q.data && !dirty) setForm({ marginPercent: String(q.data.marginPercent), minCancelMs: String(q.data.minCancelMs), maxDisputeRefunds: String(q.data.maxDisputeRefunds), assignExpiryMinutes: String(q.data.assignExpiryMinutes), otpAutoConfirmMinutes: String(q.data.otpAutoConfirmMinutes) });
  }, [q.data, dirty]);

  const saveM = useMutation({
    mutationFn: () => api.post<Settings>("/api/manual-providers/admin/settings", { marginPercent: Number(form.marginPercent), minCancelMs: Number(form.minCancelMs), maxDisputeRefunds: Number(form.maxDisputeRefunds), assignExpiryMinutes: Number(form.assignExpiryMinutes), otpAutoConfirmMinutes: Number(form.otpAutoConfirmMinutes) }),
    onSuccess: () => { toast.success("Saved"); setDirty(false); },
    onError: (e: any) => toast.error(e?.message || "Could not save"),
  });
  const update = (patch: Partial<typeof form>) => { setForm((f) => ({ ...f, ...patch })); setDirty(true); };

  return (
    <div>
      <PageHeader title="Manual Provider — Settings" description="Global pricing and abuse-prevention rules for the marketplace. All calculations happen server-side — this never runs on a buyer's browser." />
      <Card className="shadow-soft max-w-lg">
        <CardHeader><CardTitle className="text-base">Platform margin</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-1.5">
            <Label>Default margin % (added on top of each provider's own price)</Label>
            <Input type="number" min={0} step="0.1" value={form.marginPercent} onChange={(e) => update({ marginPercent: e.target.value })} />
            <p className="text-xs text-muted-foreground">
              Example: provider price ₹100 → buyer pays ₹{(100 * (1 + (Number(form.marginPercent) || 0) / 100)).toFixed(2)}, provider still gets ₹100, platform keeps ₹{((100 * (Number(form.marginPercent) || 0)) / 100).toFixed(2)}.
            </p>
          </div>
          <Button className="gradient-brand" disabled={saveM.isPending} onClick={() => saveM.mutate()}>{saveM.isPending ? "Saving…" : "Save"}</Button>
        </CardContent>
      </Card>

      <Card className="shadow-soft max-w-lg mt-4">
        <CardHeader><CardTitle className="text-base">Dispute abuse prevention</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-1.5">
            <Label>Max approved dispute-refunds per buyer, ever</Label>
            <Input type="number" min={0} step="1" value={form.maxDisputeRefunds} onChange={(e) => update({ maxDisputeRefunds: e.target.value })} />
            <p className="text-xs text-muted-foreground">
              Once a buyer has had this many disputes approved (real fraud protection for sellers), any further dispute attempt is blocked with a clear message — they can still contact support separately.
            </p>
          </div>
          <Button className="gradient-brand" disabled={saveM.isPending} onClick={() => saveM.mutate()}>{saveM.isPending ? "Saving…" : "Save"}</Button>
        </CardContent>
      </Card>

      <Card className="shadow-soft max-w-lg mt-4">
        <CardHeader><CardTitle className="text-base">Auto-refund timeout</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-1.5">
            <Label>Minutes before an unstarted request auto-refunds</Label>
            <Input type="number" min={1} step="1" value={form.assignExpiryMinutes} onChange={(e) => update({ assignExpiryMinutes: e.target.value })} />
            <p className="text-xs text-muted-foreground">
              If a seller doesn't start ("assigned" → "in_progress") a request within this window, it's automatically cancelled and the buyer refunded — a background sweep checks every minute. Protects buyers from money getting stuck behind an unresponsive or offline seller.
            </p>
          </div>
          <Button className="gradient-brand" disabled={saveM.isPending} onClick={() => saveM.mutate()}>{saveM.isPending ? "Saving…" : "Save"}</Button>
        </CardContent>
      </Card>

      <Card className="shadow-soft max-w-lg mt-4">
        <CardHeader><CardTitle className="text-base">OTP auto-confirm timeout</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-1.5">
            <Label>Minutes before a delivered OTP auto-confirms</Label>
            <Input type="number" min={1} step="1" value={form.otpAutoConfirmMinutes} onChange={(e) => update({ otpAutoConfirmMinutes: e.target.value })} />
            <p className="text-xs text-muted-foreground">
              Once a seller sends an OTP, the buyer should confirm it (or ask for a resend) — if they never respond within this window, it auto-confirms and the seller gets paid anyway. Protects sellers from a buyer who goes silent.
            </p>
          </div>
          <Button className="gradient-brand" disabled={saveM.isPending} onClick={() => saveM.mutate()}>{saveM.isPending ? "Saving…" : "Save"}</Button>
        </CardContent>
      </Card>
    </div>
  );
}
