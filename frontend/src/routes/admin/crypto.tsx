import { useEffect, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { PageHeader } from "@/components/common/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { ShieldCheck, CheckCircle2, XCircle } from "lucide-react";
import { api } from "@/lib/apiClient";
import { toast } from "sonner";

interface NpConfig {
  enabled: boolean;
  api_key: string;
  ipn_secret: string;
  inr_per_usd: number;
  pay_currency: string;
  min_inr: number;
  connection?: { ok: boolean; message: string };
}

const COINS = [
  { id: "usdttrc20", label: "USDT · TRC20 (Tron) — cheapest fees" },
  { id: "usdtbsc", label: "USDT · BEP20 (BSC)" },
  { id: "usdterc20", label: "USDT · ERC20 (Ethereum)" },
  { id: "btc", label: "Bitcoin" },
  { id: "ltc", label: "Litecoin" },
];

export default function AdminCrypto() {
  const q = useQuery({ queryKey: ["admin", "np", "config"], queryFn: () => api.get<NpConfig>("/api/payments/np/admin-config") });
  const [dirty, setDirty] = useState(false);
  const [form, setForm] = useState<NpConfig>({
    enabled: false, api_key: "", ipn_secret: "", inr_per_usd: 0, pay_currency: "usdttrc20", min_inr: 100,
  });

  useEffect(() => { if (q.data && !dirty) setForm(q.data); }, [q.data, dirty]);

  const saveM = useMutation({
    mutationFn: () => api.post<NpConfig>("/api/payments/np/admin-config", form),
    onSuccess: (d) => { toast.success("Saved"); setForm(d); setDirty(false); q.refetch(); },
    onError: (e: any) => toast.error(e?.message || "Could not save"),
  });
  const set = (patch: Partial<NpConfig>) => { setForm((f) => ({ ...f, ...patch })); setDirty(true); };
  const conn = q.data?.connection;

  return (
    <div>
      <PageHeader
        title="Crypto Payments (NOWPayments)"
        description="Works like Razorpay, but for crypto — each payment gets its own address automatically, and the wallet credits itself when it settles."
      />

      <Card className="shadow-soft max-w-2xl">
        <CardHeader className="flex-row items-center justify-between space-y-0">
          <CardTitle className="text-base">Connection</CardTitle>
          {conn && (
            <Badge variant="outline" className={conn.ok ? "text-success border-success/40" : "text-destructive border-destructive/40"}>
              {conn.ok ? <CheckCircle2 className="h-3 w-3 mr-1" /> : <XCircle className="h-3 w-3 mr-1" />}
              {conn.ok ? "Connected" : conn.message}
            </Badge>
          )}
        </CardHeader>
        <CardContent className="space-y-4">
          <label className="flex items-center gap-3">
            <Switch checked={form.enabled} onCheckedChange={(v) => set({ enabled: v })} />
            <span className="text-sm font-medium">{form.enabled ? "Crypto payments are ON" : "Crypto payments are OFF"}</span>
          </label>

          <div className="grid gap-1.5">
            <Label>API key</Label>
            <Input value={form.api_key} onChange={(e) => set({ api_key: e.target.value })} placeholder="(not set)" className="font-mono text-xs" />
            <p className="text-xs text-muted-foreground">NOWPayments dashboard → Settings → Payments → API keys.</p>
          </div>

          <div className="grid gap-1.5">
            <Label>IPN secret</Label>
            <Input value={form.ipn_secret} onChange={(e) => set({ ipn_secret: e.target.value })} placeholder="(not set)" className="font-mono text-xs" />
            <p className="text-xs text-muted-foreground">
              Same page, "IPN secret key". Required — without it every webhook is rejected, because it's the only thing proving a
              "payment finished" callback actually came from NOWPayments and not from someone who found the URL.
            </p>
          </div>
          <Button className="gradient-brand" disabled={saveM.isPending} onClick={() => saveM.mutate()}>{saveM.isPending ? "Saving…" : "Save"}</Button>
        </CardContent>
      </Card>

      <Card className="shadow-soft max-w-2xl mt-4">
        <CardHeader><CardTitle className="text-base">Pricing</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-1.5">
            <Label>₹ per $1</Label>
            <Input type="number" min={0} step="0.5" value={form.inr_per_usd} onChange={(e) => set({ inr_per_usd: Number(e.target.value) })} />
            <p className="text-xs text-muted-foreground">
              Your INR→USD rate. Set manually on purpose — an automatic FX feed that glitches or gets manipulated would move every
              price with it. It's frozen onto each payment when it starts, so changing it never affects one already in progress.
            </p>
          </div>
          <div className="grid gap-1.5">
            <Label>Coin / network to charge in</Label>
            <div className="flex flex-wrap gap-2">
              {COINS.map((c) => (
                <Button key={c.id} type="button" size="sm" variant={form.pay_currency === c.id ? "default" : "outline"}
                  className={form.pay_currency === c.id ? "gradient-brand" : ""} onClick={() => set({ pay_currency: c.id })}>
                  {c.label}
                </Button>
              ))}
            </div>
          </div>
          <div className="grid gap-1.5">
            <Label>Minimum deposit (₹)</Label>
            <Input type="number" min={0} step="10" value={form.min_inr} onChange={(e) => set({ min_inr: Number(e.target.value) })} />
          </div>
          <Button className="gradient-brand" disabled={saveM.isPending} onClick={() => saveM.mutate()}>{saveM.isPending ? "Saving…" : "Save"}</Button>
        </CardContent>
      </Card>

      <Card className="shadow-soft max-w-2xl mt-4 border-success/30">
        <CardHeader><CardTitle className="text-base flex items-center gap-2"><ShieldCheck className="h-4 w-4 text-success" />How it's kept safe</CardTitle></CardHeader>
        <CardContent>
          <ul className="text-xs text-muted-foreground space-y-1.5 list-disc pl-4">
            <li>Every webhook is <b>signature-verified</b> (HMAC-SHA512 with your IPN secret). An unsigned or wrongly-signed one is rejected, so nobody can fake a "paid" callback.</li>
            <li>Each payment gets its <b>own address</b> from NOWPayments, so there's never any doubt about which user a deposit belongs to.</li>
            <li>A payment can be credited <b>once</b> — enforced by a unique index plus an atomic claim, so a replayed webhook does nothing.</li>
            <li>Only <code>finished</code>/<code>confirmed</code> credits. Partial or failed payments are recorded, never credited.</li>
            <li>The amount credited is the <b>invoice's INR value</b>, fixed when it was created — not anything the client sends.</li>
            <li>Your API key and IPN secret are <b>never returned</b> to any browser, admin included.</li>
          </ul>
          <p className="text-xs text-muted-foreground mt-3">
            NOWPayments is non-custodial — funds settle to the wallet address you set in <i>their</i> dashboard, not to a balance they hold for you.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
