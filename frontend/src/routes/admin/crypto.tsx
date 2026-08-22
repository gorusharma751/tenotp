import { useEffect, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { PageHeader } from "@/components/common/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { ShieldCheck } from "lucide-react";
import { api } from "@/lib/apiClient";
import { toast } from "sonner";

interface CryptoConfig {
  enabled: boolean;
  address_trc20: string;
  address_bep20: string;
  usdt_inr_rate: number;
  min_usdt: number;
  confirmations_required: number;
  bscscan_api_key: string;
}

export default function AdminCrypto() {
  const q = useQuery({ queryKey: ["admin", "crypto", "config"], queryFn: () => api.get<CryptoConfig>("/api/payments/crypto/admin-config") });
  const [dirty, setDirty] = useState(false);
  const [form, setForm] = useState<CryptoConfig>({
    enabled: false, address_trc20: "", address_bep20: "", usdt_inr_rate: 0,
    min_usdt: 1, confirmations_required: 1, bscscan_api_key: "",
  });

  useEffect(() => { if (q.data && !dirty) setForm(q.data); }, [q.data, dirty]);

  const saveM = useMutation({
    mutationFn: () => api.post<CryptoConfig>("/api/payments/crypto/admin-config", form),
    onSuccess: (d) => { toast.success("Saved"); setForm(d); setDirty(false); },
    onError: (e: any) => toast.error(e?.message || "Could not save"),
  });
  const set = (patch: Partial<CryptoConfig>) => { setForm((f) => ({ ...f, ...patch })); setDirty(true); };

  return (
    <div>
      <PageHeader title="Crypto (USDT) Deposits" description="Users send USDT to your address and paste the transaction hash — it's verified on-chain and credited automatically." />

      <Card className="shadow-soft max-w-2xl">
        <CardHeader><CardTitle className="text-base">Receiving addresses</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <label className="flex items-center gap-3">
            <Switch checked={form.enabled} onCheckedChange={(v) => set({ enabled: v })} />
            <span className="text-sm font-medium">{form.enabled ? "Crypto deposits are ON" : "Crypto deposits are OFF"}</span>
          </label>

          <div className="grid gap-1.5">
            <Label>USDT · TRC20 address (Tron)</Label>
            <Input value={form.address_trc20} onChange={(e) => set({ address_trc20: e.target.value })} placeholder="T…" className="font-mono text-xs" />
            <p className="text-xs text-muted-foreground">Leave blank to disable this network. Double-check it — deposits go straight here.</p>
          </div>

          <div className="grid gap-1.5">
            <Label>USDT · BEP20 address (BSC)</Label>
            <Input value={form.address_bep20} onChange={(e) => set({ address_bep20: e.target.value })} placeholder="0x…" className="font-mono text-xs" />
          </div>

          <div className="grid gap-1.5">
            <Label>BscScan API key (only needed for BEP20)</Label>
            <Input value={form.bscscan_api_key} onChange={(e) => set({ bscscan_api_key: e.target.value })} placeholder="(not set)" className="font-mono text-xs" />
            <p className="text-xs text-muted-foreground">Free key from bscscan.com. TRC20 needs no key. Leave the masked value untouched to keep the saved one.</p>
          </div>
          <Button className="gradient-brand" disabled={saveM.isPending} onClick={() => saveM.mutate()}>{saveM.isPending ? "Saving…" : "Save"}</Button>
        </CardContent>
      </Card>

      <Card className="shadow-soft max-w-2xl mt-4">
        <CardHeader><CardTitle className="text-base">Rate &amp; limits</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-1.5">
            <Label>1 USDT = ₹</Label>
            <Input type="number" min={0} step="0.01" value={form.usdt_inr_rate} onChange={(e) => set({ usdt_inr_rate: Number(e.target.value) })} />
            <p className="text-xs text-muted-foreground">
              Set manually on purpose — a live price feed that glitches or gets manipulated would move your rate with it. The rate is frozen onto each deposit when it starts, so changing it never affects one already in progress.
            </p>
          </div>
          <div className="grid gap-1.5">
            <Label>Minimum deposit (USDT)</Label>
            <Input type="number" min={0} step="0.1" value={form.min_usdt} onChange={(e) => set({ min_usdt: Number(e.target.value) })} />
          </div>
          <div className="grid gap-1.5">
            <Label>Confirmations required</Label>
            <Input type="number" min={1} step="1" value={form.confirmations_required} onChange={(e) => set({ confirmations_required: Number(e.target.value) })} />
            <p className="text-xs text-muted-foreground">How many block confirmations before crediting. 1 is normal for USDT; raise it if you want to be stricter.</p>
          </div>
          <Button className="gradient-brand" disabled={saveM.isPending} onClick={() => saveM.mutate()}>{saveM.isPending ? "Saving…" : "Save"}</Button>
        </CardContent>
      </Card>

      <Card className="shadow-soft max-w-2xl mt-4 border-success/30">
        <CardHeader><CardTitle className="text-base flex items-center gap-2"><ShieldCheck className="h-4 w-4 text-success" />What's checked before crediting</CardTitle></CardHeader>
        <CardContent>
          <ul className="text-xs text-muted-foreground space-y-1.5 list-disc pl-4">
            <li>The token is the <b>real USDT contract</b> — a look-alike token someone deployed themselves is rejected.</li>
            <li>The transfer went to <b>your address above</b>, not somewhere else.</li>
            <li>The transaction has enough <b>confirmations</b>.</li>
            <li>The amount is read <b>from the chain</b>, never from what the user typed — and that's what gets credited.</li>
            <li>Each transaction hash can be credited <b>once</b>, enforced by a unique index, so it can't be replayed.</li>
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
