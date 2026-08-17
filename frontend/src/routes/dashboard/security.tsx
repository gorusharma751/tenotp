import { useState } from "react";
import { PageHeader } from "@/components/common/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";
import { Shield, Monitor, MapPin } from "lucide-react";

const SESSIONS = [
  { id: "s1", device: "Chrome on macOS", location: "Delhi, IN", ip: "45.***.***.12", last: "just now", current: true },
  { id: "s2", device: "Safari on iPhone", location: "Mumbai, IN", ip: "182.***.***.4", last: "2h ago", current: false },
  { id: "s3", device: "Firefox on Windows", location: "London, GB", ip: "88.***.***.7", last: "3d ago", current: false },
];

// TODO(backend): no password-change / 2FA / sessions endpoints are ported
// yet — kept as local UI, same as the monolith's placeholder behavior.
export default function Security() {
  const [tfa, setTfa] = useState(false);
  return (
    <div>
      <PageHeader title="Security" description="Keep your account safe." />
      <div className="grid gap-6 lg:grid-cols-2 mb-6">
        <Card className="shadow-soft"><CardHeader><CardTitle>Change password</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <div><Label>Current password</Label><Input type="password" className="mt-2" /></div>
            <div><Label>New password</Label><Input type="password" className="mt-2" /></div>
            <div><Label>Confirm new password</Label><Input type="password" className="mt-2" /></div>
            <Button className="gradient-brand" onClick={() => toast.success("Password updated")}>Update password</Button>
          </CardContent>
        </Card>
        <Card className="shadow-soft"><CardHeader><CardTitle className="flex items-center gap-2"><Shield className="h-4 w-4" /> Two-factor authentication</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center justify-between rounded-xl border p-4">
              <div><p className="font-medium">Authenticator app</p><p className="text-xs text-muted-foreground">Use Google Authenticator or 1Password.</p></div>
              <Switch checked={tfa} onCheckedChange={(v) => { setTfa(v); toast.success(v ? "2FA enabled" : "2FA disabled"); }} />
            </div>
            <div className="flex items-center justify-between rounded-xl border p-4">
              <div><p className="font-medium">SMS backup</p><p className="text-xs text-muted-foreground">Fallback code via SMS.</p></div>
              <Badge variant="outline">Not configured</Badge>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="shadow-soft"><CardHeader><CardTitle>Active sessions & trusted devices</CardTitle></CardHeader>
        <CardContent className="p-0"><Table>
          <TableHeader><TableRow><TableHead>Device</TableHead><TableHead>Location</TableHead><TableHead>IP</TableHead><TableHead>Last seen</TableHead><TableHead className="text-right">Action</TableHead></TableRow></TableHeader>
          <TableBody>
            {SESSIONS.map((s) => (
              <TableRow key={s.id}>
                <TableCell className="flex items-center gap-2"><Monitor className="h-4 w-4 text-muted-foreground" />{s.device}{s.current && <Badge className="ml-2" variant="secondary">This device</Badge>}</TableCell>
                <TableCell className="text-sm"><MapPin className="h-3 w-3 inline mr-1 text-muted-foreground" />{s.location}</TableCell>
                <TableCell className="font-mono text-xs">{s.ip}</TableCell>
                <TableCell className="text-xs text-muted-foreground">{s.last}</TableCell>
                <TableCell className="text-right">{!s.current && <Button size="sm" variant="ghost" onClick={() => toast("Session revoked")}>Revoke</Button>}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table></CardContent>
      </Card>
    </div>
  );
}
