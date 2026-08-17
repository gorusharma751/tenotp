import { useState } from "react";
import { PageHeader } from "@/components/common/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { useThemeStore } from "@/store/themeStore";
import { toast } from "sonner";

export default function Settings() {
  const theme = useThemeStore((s) => s.theme);
  const setTheme = useThemeStore((s) => s.set);
  const [prefs, setPrefs] = useState({
    emailOrders: true, emailBilling: true, emailMarketing: false,
    smsOrders: false, smsAlerts: true,
    pushDesktop: true, pushMobile: true,
    language: "en", tz: "UTC",
  });
  const set = (k: string, v: unknown) => setPrefs((p) => ({ ...p, [k]: v }));

  return (
    <div>
      <PageHeader title="Settings" description="Customize how TenOTP works for you." actions={
        <Button className="gradient-brand" onClick={() => toast.success("Preferences saved")}>Save preferences</Button>
      } />

      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="shadow-soft"><CardHeader><CardTitle>Appearance & locale</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div><Label>Theme</Label>
              <Select value={theme} onValueChange={(v) => setTheme(v as any)}>
                <SelectTrigger className="mt-2"><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="light">Light</SelectItem><SelectItem value="dark">Dark</SelectItem></SelectContent>
              </Select>
            </div>
            <div><Label>Language</Label>
              <Select value={prefs.language} onValueChange={(v) => set("language", v)}>
                <SelectTrigger className="mt-2"><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="en">English</SelectItem><SelectItem value="hi">हिन्दी</SelectItem><SelectItem value="es">Español</SelectItem></SelectContent>
              </Select>
            </div>
            <div><Label>Timezone</Label>
              <Select value={prefs.tz} onValueChange={(v) => set("tz", v)}>
                <SelectTrigger className="mt-2"><SelectValue /></SelectTrigger>
                <SelectContent>{["UTC", "America/New_York", "Europe/London", "Asia/Kolkata"].map((z) => <SelectItem key={z} value={z}>{z}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-soft"><CardHeader><CardTitle>Email notifications</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {[
              ["emailOrders", "Order updates", "OTP received, expired or refunded."],
              ["emailBilling", "Billing", "Deposits and receipts."],
              ["emailMarketing", "Marketing", "News and product updates."],
            ].map(([k, l, d]) => (
              <div key={k} className="flex items-center justify-between rounded-xl border p-3">
                <div><p className="font-medium text-sm">{l}</p><p className="text-xs text-muted-foreground">{d}</p></div>
                <Switch checked={(prefs as any)[k]} onCheckedChange={(v) => set(k as string, v)} />
              </div>
            ))}
          </CardContent>
        </Card>

        <Card className="shadow-soft"><CardHeader><CardTitle>SMS preferences</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {[["smsOrders", "Order SMS"], ["smsAlerts", "Security alerts"]].map(([k, l]) => (
              <div key={k} className="flex items-center justify-between rounded-xl border p-3">
                <p className="font-medium text-sm">{l}</p>
                <Switch checked={(prefs as any)[k]} onCheckedChange={(v) => set(k as string, v)} />
              </div>
            ))}
          </CardContent>
        </Card>

        <Card className="shadow-soft"><CardHeader><CardTitle>Push notifications</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {[["pushDesktop", "Desktop"], ["pushMobile", "Mobile"]].map(([k, l]) => (
              <div key={k} className="flex items-center justify-between rounded-xl border p-3">
                <p className="font-medium text-sm">{l}</p>
                <Switch checked={(prefs as any)[k]} onCheckedChange={(v) => set(k as string, v)} />
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
