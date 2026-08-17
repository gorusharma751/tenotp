import { PageHeader } from "@/components/common/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { AlertTriangle, RefreshCw, Trash2, Database } from "lucide-react";

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
            <Textarea rows={3} placeholder="We'll be back shortly. Sorry for the inconvenience." />
            <div className="flex items-center justify-between rounded-lg border p-3"><span className="text-sm font-medium">Enable maintenance mode</span><Switch onCheckedChange={(v) => toast.warning(`Maintenance ${v ? "ON" : "OFF"}`)} /></div>
          </CardContent>
        </Card>
        <Card className="shadow-soft">
          <CardHeader><CardTitle>Utilities</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            <Button variant="outline" className="w-full justify-start" onClick={() => toast.success("Cache cleared")}><Trash2 className="mr-2 h-4 w-4" />Clear caches</Button>
            <Button variant="outline" className="w-full justify-start" onClick={() => toast.success("Config reloaded")}><RefreshCw className="mr-2 h-4 w-4" />Reload config</Button>
            <Button variant="outline" className="w-full justify-start" onClick={() => toast.success("Backup queued")}><Database className="mr-2 h-4 w-4" />Trigger DB backup</Button>
            <Button variant="outline" className="w-full justify-start" onClick={() => toast.info("Workers restarted")}><RefreshCw className="mr-2 h-4 w-4" />Restart workers</Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
