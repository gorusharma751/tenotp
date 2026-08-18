import { PageHeader } from "@/components/common/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { AlertTriangle, RefreshCw, Trash2, Database } from "lucide-react";

// TODO(backend): none of this page's actions have a real endpoint yet — no
// maintenance-mode flag, cache-clear, config-reload, DB-backup-trigger, or
// worker-restart route exists anywhere in backend/src/routes/*.ts. This
// used to fake every action with a success toast and no network call at
// all, which is actively misleading for an ops page (an admin flipping
// "maintenance mode" believing it froze the platform, when nothing
// happened). Now every control is honestly disabled with an explanatory
// tooltip instead — same pattern as the Coupons page's disabled create
// button — until a real endpoint exists for each.
export default function AdminMaintenance() {
  return (
    <div>
      <PageHeader title="Maintenance" description="Downtime toggles, cache clears, backups." />
      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="shadow-soft border-warning/40 bg-warning/5">
          <CardHeader><CardTitle className="flex items-center gap-2"><AlertTriangle className="h-5 w-5 text-warning" />Maintenance mode</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-muted-foreground">Freeze all user actions and show a downtime banner across the platform.</p>
            <Label>Banner message</Label>
            <Textarea rows={3} placeholder="We'll be back shortly. Sorry for the inconvenience." disabled title="Not wired up — no backend maintenance-mode endpoint yet" />
            <div className="flex items-center justify-between rounded-lg border p-3">
              <span className="text-sm font-medium">Enable maintenance mode</span>
              <Switch disabled title="Not wired up — no backend maintenance-mode endpoint yet" />
            </div>
            <p className="text-xs text-muted-foreground">Not wired up yet — no backend endpoint to actually freeze the platform exists.</p>
          </CardContent>
        </Card>
        <Card className="shadow-soft">
          <CardHeader><CardTitle>Utilities</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            <Button variant="outline" className="w-full justify-start" disabled title="No backend endpoint yet"><Trash2 className="mr-2 h-4 w-4" />Clear caches</Button>
            <Button variant="outline" className="w-full justify-start" disabled title="No backend endpoint yet"><RefreshCw className="mr-2 h-4 w-4" />Reload config</Button>
            <Button variant="outline" className="w-full justify-start" disabled title="No backend endpoint yet"><Database className="mr-2 h-4 w-4" />Trigger DB backup</Button>
            <Button variant="outline" className="w-full justify-start" disabled title="No backend endpoint yet"><RefreshCw className="mr-2 h-4 w-4" />Restart workers</Button>
            <p className="text-xs text-muted-foreground pt-1">None of these have a backend endpoint yet — disabled rather than faking success.</p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
