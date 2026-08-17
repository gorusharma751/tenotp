import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { PageHeader } from "@/components/common/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { api } from "@/lib/apiClient";

/* ============================== Razorpay ============================== */
// GET/POST /api/payments/razorpay/admin-status|admin-config — see
// backend/src/lib/razorpay.ts getRazorpayAdminStatus/saveRazorpayConfig.

type RazorpayStatus = { configured: boolean; enabled: boolean; key_id_masked: string; key_secret_masked: string };

function RazorpayPanel() {
  const qc = useQueryClient();
  const q = useQuery({
    queryKey: ["admin", "settings", "razorpay"],
    queryFn: () => api.get<RazorpayStatus>("/api/payments/razorpay/admin-status"),
  });
  const [keyId, setKeyId] = useState("");
  const [keySecret, setKeySecret] = useState("");
  const [enabled, setEnabled] = useState(false);
  const [touchedEnabled, setTouchedEnabled] = useState(false);

  useEffect(() => {
    if (q.data && !touchedEnabled) setEnabled(q.data.enabled);
  }, [q.data, touchedEnabled]);

  const saveM = useMutation({
    mutationFn: () =>
      api.post<{ ok: boolean }>("/api/payments/razorpay/admin-config", {
        ...(keyId ? { key_id: keyId } : {}),
        ...(keySecret ? { key_secret: keySecret } : {}),
        enabled,
      }),
    onSuccess: () => {
      toast.success("Razorpay settings saved");
      setKeySecret("");
      setTouchedEnabled(false);
      qc.invalidateQueries({ queryKey: ["admin", "settings", "razorpay"] });
    },
    onError: (e: any) => toast.error(e?.message || "Could not save Razorpay config"),
  });

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between gap-2">
        <CardTitle className="text-base">Razorpay</CardTitle>
        <div className="flex items-center gap-2">
          <Badge variant={q.data?.configured ? "default" : "secondary"}>
            {q.data?.configured ? "configured" : "not configured"}
          </Badge>
          <Badge variant={q.data?.enabled ? "default" : "secondary"}>{q.data?.enabled ? "live" : "off"}</Badge>
        </div>
      </CardHeader>
      <CardContent className="grid gap-4 sm:grid-cols-2">
        <div className="sm:col-span-2 flex items-center gap-3 rounded-lg border p-3">
          <Switch
            id="rzp-enabled"
            checked={enabled}
            onCheckedChange={(v) => {
              setEnabled(v);
              setTouchedEnabled(true);
            }}
          />
          <Label htmlFor="rzp-enabled">Show Razorpay to customers on the Deposit page</Label>
        </div>
        <div className="grid gap-1.5">
          <Label>Key ID</Label>
          <Input
            value={keyId}
            onChange={(e) => setKeyId(e.target.value)}
            placeholder={q.data?.key_id_masked || "rzp_live_xxxxxxxx"}
          />
        </div>
        <div className="grid gap-1.5">
          <Label>Key secret</Label>
          <Input
            type="password"
            value={keySecret}
            onChange={(e) => setKeySecret(e.target.value)}
            placeholder={q.data?.key_secret_masked || "paste key secret"}
          />
        </div>
        <div className="sm:col-span-2">
          <Button onClick={() => saveM.mutate()} disabled={saveM.isPending}>
            {saveM.isPending ? "Saving…" : "Save"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

/* ================================ Paytm ================================ */
// GET/POST /api/payments/paytm/admin-config — see backend/src/routes/payments.ts.

type PaytmConfig = {
  mid: string;
  env: "production" | "staging";
  enabled: boolean;
  qr_ttl_minutes: number;
  key_masked: string;
  mode: "upi" | "gateway";
  upi_id: string;
  payee_name: string;
  webhook_token: string;
  configured: boolean;
};

function PaytmPanel() {
  const qc = useQueryClient();
  const q = useQuery({
    queryKey: ["admin", "settings", "paytm"],
    queryFn: () => api.get<PaytmConfig>("/api/payments/paytm/admin-config"),
  });
  const [form, setForm] = useState({
    mid: "",
    merchant_key: "",
    env: "production" as "production" | "staging",
    enabled: false,
    qr_ttl_minutes: 5,
    mode: "upi" as "upi" | "gateway",
    upi_id: "",
    payee_name: "",
  });

  useEffect(() => {
    if (q.data) {
      setForm((f) => ({
        ...f,
        env: q.data.env,
        enabled: q.data.enabled,
        qr_ttl_minutes: q.data.qr_ttl_minutes,
        mode: q.data.mode,
        upi_id: q.data.upi_id || "",
        payee_name: q.data.payee_name || "",
      }));
    }
  }, [q.data]);

  const saveM = useMutation({
    mutationFn: () => api.post<{ ok: boolean; webhook_token: string }>("/api/payments/paytm/admin-config", form),
    onSuccess: () => {
      toast.success("Paytm config saved");
      setForm((f) => ({ ...f, merchant_key: "" }));
      qc.invalidateQueries({ queryKey: ["admin", "settings", "paytm"] });
    },
    onError: (e: any) => toast.error(e?.message || "Could not save Paytm config"),
  });

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between gap-2">
        <CardTitle className="text-base">Paytm</CardTitle>
        <Badge variant={q.data?.configured ? "default" : "secondary"}>
          {q.data?.configured ? "configured" : "not configured"}
        </Badge>
      </CardHeader>
      <CardContent className="grid gap-4 sm:grid-cols-2">
        <div className="grid gap-1.5">
          <Label>Mode</Label>
          <Select value={form.mode} onValueChange={(v) => setForm({ ...form, mode: v as "upi" | "gateway" })}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="upi">Direct UPI (no gateway keys needed)</SelectItem>
              <SelectItem value="gateway">Gateway (MID + Merchant key)</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="grid gap-1.5">
          <Label>Environment</Label>
          <Select value={form.env} onValueChange={(v) => setForm({ ...form, env: v as "production" | "staging" })}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="production">Production</SelectItem>
              <SelectItem value="staging">Staging</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="grid gap-1.5">
          <Label>MID</Label>
          <Input value={form.mid} onChange={(e) => setForm({ ...form, mid: e.target.value })} placeholder={q.data?.mid || "Merchant ID"} />
        </div>
        <div className="grid gap-1.5">
          <Label>Merchant key</Label>
          <Input type="password" value={form.merchant_key} onChange={(e) => setForm({ ...form, merchant_key: e.target.value })} placeholder={q.data?.key_masked || "paste merchant key"} />
        </div>
        <div className="grid gap-1.5">
          <Label>Merchant UPI ID</Label>
          <Input value={form.upi_id} onChange={(e) => setForm({ ...form, upi_id: e.target.value })} placeholder="merchant@paytm" />
        </div>
        <div className="grid gap-1.5">
          <Label>Payee name</Label>
          <Input value={form.payee_name} onChange={(e) => setForm({ ...form, payee_name: e.target.value })} />
        </div>
        <div className="grid gap-1.5">
          <Label>QR TTL (minutes)</Label>
          <Input
            type="number"
            min={1}
            max={30}
            value={form.qr_ttl_minutes}
            onChange={(e) => setForm({ ...form, qr_ttl_minutes: Number(e.target.value) || 5 })}
          />
        </div>
        <div className="flex items-center gap-3 pt-6">
          <Switch id="paytm-enabled" checked={form.enabled} onCheckedChange={(v) => setForm({ ...form, enabled: v })} />
          <Label htmlFor="paytm-enabled">Enabled for live deposits</Label>
        </div>
        <div className="sm:col-span-2">
          <Button onClick={() => saveM.mutate()} disabled={saveM.isPending}>
            {saveM.isPending ? "Saving…" : "Save & test"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

/* =============================== BharatPe =============================== */
// GET/POST /api/payments/bharatpe/admin-config, POST .../test-token — see
// backend/src/routes/payments.ts.

type BharatpeConfig = {
  merchant_id: string;
  upi_id: string;
  payee_name: string;
  enabled: boolean;
  qr_ttl_minutes: number;
  webhook_token: string;
  access_token_masked: string;
  has_access_token: boolean;
  token_status: string;
  token_message: string;
  token_checked_at: string | null;
  api_url: string;
  qr_image_url: string;
  show_upi_apps: boolean;
  configured: boolean;
};

function bharatpeTokenVariant(status: string): "default" | "secondary" | "destructive" {
  if (status === "working") return "default";
  if (status === "not_configured" || status === "unavailable") return "secondary";
  return "destructive";
}

function BharatpePanel() {
  const qc = useQueryClient();
  const q = useQuery({
    queryKey: ["admin", "settings", "bharatpe"],
    queryFn: () => api.get<BharatpeConfig>("/api/payments/bharatpe/admin-config"),
  });
  const [form, setForm] = useState({
    merchant_id: "",
    upi_id: "",
    payee_name: "",
    enabled: false,
    qr_ttl_minutes: 5,
    access_token: "",
    api_url: "",
    qr_image_url: "",
    show_upi_apps: false,
  });

  useEffect(() => {
    if (q.data) {
      setForm((f) => ({
        ...f,
        merchant_id: q.data.merchant_id || "",
        upi_id: q.data.upi_id || "",
        payee_name: q.data.payee_name || "",
        enabled: q.data.enabled,
        qr_ttl_minutes: q.data.qr_ttl_minutes,
        api_url: q.data.api_url || "",
        qr_image_url: q.data.qr_image_url || "",
        show_upi_apps: q.data.show_upi_apps,
      }));
    }
  }, [q.data]);

  const saveM = useMutation({
    mutationFn: () =>
      api.post<{ ok: boolean; webhook_token: string }>("/api/payments/bharatpe/admin-config", {
        merchant_id: form.merchant_id,
        upi_id: form.upi_id,
        payee_name: form.payee_name,
        enabled: form.enabled,
        qr_ttl_minutes: form.qr_ttl_minutes,
        access_token: form.access_token,
        api_url: form.api_url,
        qr_image_url: form.qr_image_url,
        show_upi_apps: form.show_upi_apps,
      }),
    onSuccess: () => {
      toast.success("BharatPe config saved");
      setForm((f) => ({ ...f, access_token: "" }));
      qc.invalidateQueries({ queryKey: ["admin", "settings", "bharatpe"] });
      testM.mutate();
    },
    onError: (e: any) => toast.error(e?.message || "Could not save BharatPe config"),
  });

  const testM = useMutation({
    mutationFn: () =>
      api.post<{ ok: boolean; status: string; count: number; latest: number | null; error?: string }>(
        "/api/payments/bharatpe/test-token",
        { access_token: form.access_token, merchant_id: form.merchant_id, api_url: form.api_url },
      ),
    onSuccess: (r) => {
      qc.invalidateQueries({ queryKey: ["admin", "settings", "bharatpe"] });
      if (r.ok) toast.success(`Token working · ${r.count} transaction(s) fetched`);
      else toast.error(r.error || "Token test failed");
    },
    onError: (e: any) => toast.error(e?.message || "Test failed"),
  });

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between gap-2">
        <CardTitle className="text-base">BharatPe</CardTitle>
        <div className="flex items-center gap-2">
          {q.data && <Badge variant={bharatpeTokenVariant(q.data.token_status)}>{q.data.token_status}</Badge>}
          <Badge variant={q.data?.configured ? "default" : "secondary"}>
            {q.data?.configured ? "configured" : "not configured"}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="grid gap-4 sm:grid-cols-2">
        <div className="grid gap-1.5">
          <Label>Merchant ID</Label>
          <Input value={form.merchant_id} onChange={(e) => setForm({ ...form, merchant_id: e.target.value })} />
        </div>
        <div className="grid gap-1.5">
          <Label>Merchant UPI ID</Label>
          <Input value={form.upi_id} onChange={(e) => setForm({ ...form, upi_id: e.target.value })} placeholder="merchant@upi" />
        </div>
        <div className="grid gap-1.5">
          <Label>Payee name</Label>
          <Input value={form.payee_name} onChange={(e) => setForm({ ...form, payee_name: e.target.value })} />
        </div>
        <div className="grid gap-1.5">
          <Label>Access token</Label>
          <Input
            type="password"
            value={form.access_token}
            onChange={(e) => setForm({ ...form, access_token: e.target.value })}
            placeholder={q.data?.access_token_masked || "paste BharatPe access token"}
          />
        </div>
        <div className="grid gap-1.5">
          <Label>Transactions API URL (optional)</Label>
          <Input value={form.api_url} onChange={(e) => setForm({ ...form, api_url: e.target.value })} placeholder="https://payments-tesseract.bharatpe.in (default)" />
        </div>
        <div className="grid gap-1.5">
          <Label>QR image URL (optional)</Label>
          <Input value={form.qr_image_url} onChange={(e) => setForm({ ...form, qr_image_url: e.target.value })} placeholder="https://... or leave blank" />
        </div>
        <div className="grid gap-1.5">
          <Label>QR TTL (minutes)</Label>
          <Input
            type="number"
            min={1}
            max={30}
            value={form.qr_ttl_minutes}
            onChange={(e) => setForm({ ...form, qr_ttl_minutes: Number(e.target.value) || 5 })}
          />
        </div>
        <div className="flex items-center gap-3 pt-6">
          <Switch id="bpe-enabled" checked={form.enabled} onCheckedChange={(v) => setForm({ ...form, enabled: v })} />
          <Label htmlFor="bpe-enabled">Enabled for live deposits</Label>
        </div>
        <div className="flex items-center gap-3">
          <Switch id="bpe-apps" checked={form.show_upi_apps} onCheckedChange={(v) => setForm({ ...form, show_upi_apps: v })} />
          <Label htmlFor="bpe-apps">Show "open in UPI app" buttons</Label>
        </div>
        {q.data?.token_message && <p className="sm:col-span-2 text-xs text-muted-foreground">{q.data.token_message}</p>}
        <div className="sm:col-span-2 flex flex-wrap gap-2">
          <Button onClick={() => saveM.mutate()} disabled={saveM.isPending}>
            {saveM.isPending ? "Saving…" : "Save & test"}
          </Button>
          <Button variant="outline" onClick={() => testM.mutate()} disabled={testM.isPending || !q.data?.has_access_token}>
            {testM.isPending ? "Testing…" : "Test token"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

/* ============================= Contact links ============================= */
// GET/POST /api/admin/contact-links — see backend/src/routes/admin.ts. This is
// a single settings document (telegram/whatsapp links + one announcement),
// not a list — the backend has no PATCH/DELETE for individual entries.

type ContactLinks = {
  telegramGroup: string;
  telegramSupport: string;
  whatsapp: string;
  announcementTitle: string;
  announcementText: string;
  announcementVersion: string;
};

function ContactLinksPanel() {
  const qc = useQueryClient();
  const q = useQuery({
    queryKey: ["admin", "settings", "contact-links"],
    queryFn: () => api.get<ContactLinks>("/api/admin/contact-links"),
  });
  const [form, setForm] = useState({
    telegramGroup: "",
    telegramSupport: "",
    whatsapp: "",
    announcementTitle: "",
    announcementText: "",
  });

  useEffect(() => {
    if (q.data) {
      setForm({
        telegramGroup: q.data.telegramGroup,
        telegramSupport: q.data.telegramSupport,
        whatsapp: q.data.whatsapp,
        announcementTitle: q.data.announcementTitle,
        announcementText: q.data.announcementText,
      });
    }
  }, [q.data]);

  const saveM = useMutation({
    mutationFn: (bumpVersion: boolean) => api.post<{ ok: boolean }>("/api/admin/contact-links", { ...form, bumpVersion }),
    onSuccess: () => {
      toast.success("Contact links saved");
      qc.invalidateQueries({ queryKey: ["admin", "settings", "contact-links"] });
    },
    onError: (e: any) => toast.error(e?.message || "Could not save contact links"),
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Contact links & announcement</CardTitle>
      </CardHeader>
      <CardContent className="grid gap-4 sm:grid-cols-2">
        <div className="grid gap-1.5">
          <Label>Telegram group URL</Label>
          <Input value={form.telegramGroup} onChange={(e) => setForm({ ...form, telegramGroup: e.target.value })} placeholder="https://t.me/..." />
        </div>
        <div className="grid gap-1.5">
          <Label>Telegram support URL</Label>
          <Input value={form.telegramSupport} onChange={(e) => setForm({ ...form, telegramSupport: e.target.value })} placeholder="https://t.me/..." />
        </div>
        <div className="grid gap-1.5">
          <Label>WhatsApp URL</Label>
          <Input value={form.whatsapp} onChange={(e) => setForm({ ...form, whatsapp: e.target.value })} placeholder="https://wa.me/..." />
        </div>
        <div className="grid gap-1.5">
          <Label>Announcement title</Label>
          <Input value={form.announcementTitle} onChange={(e) => setForm({ ...form, announcementTitle: e.target.value })} />
        </div>
        <div className="sm:col-span-2 grid gap-1.5">
          <Label>Announcement text</Label>
          <Input value={form.announcementText} onChange={(e) => setForm({ ...form, announcementText: e.target.value })} />
        </div>
        <div className="sm:col-span-2 flex flex-wrap gap-2">
          <Button onClick={() => saveM.mutate(false)} disabled={saveM.isPending}>
            {saveM.isPending ? "Saving…" : "Save"}
          </Button>
          <Button variant="outline" onClick={() => saveM.mutate(true)} disabled={saveM.isPending}>
            Save & bump announcement
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

export default function AdminSettings() {
  return (
    <div>
      <PageHeader title="System Settings" description="Payment gateways and contact links. Every panel has a Save & test button to confirm credentials work before going live." />
      <Tabs defaultValue="razorpay">
        <TabsList className="mb-4">
          <TabsTrigger value="razorpay">Razorpay</TabsTrigger>
          <TabsTrigger value="paytm">Paytm</TabsTrigger>
          <TabsTrigger value="bharatpe">BharatPe</TabsTrigger>
          <TabsTrigger value="contact">Contact links</TabsTrigger>
        </TabsList>
        <TabsContent value="razorpay"><RazorpayPanel /></TabsContent>
        <TabsContent value="paytm"><PaytmPanel /></TabsContent>
        <TabsContent value="bharatpe"><BharatpePanel /></TabsContent>
        <TabsContent value="contact"><ContactLinksPanel /></TabsContent>
      </Tabs>
    </div>
  );
}
