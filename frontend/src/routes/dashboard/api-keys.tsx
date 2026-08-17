import { PageHeader } from "@/components/common/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { StatCard } from "@/components/common/StatCard";
import { dateShort } from "@/utils/format";
import { KeyRound, Copy, Trash2, RefreshCw, Plus, Webhook, Activity } from "lucide-react";
import { toast } from "sonner";
import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";

interface ApiKey { id: string; label: string; prefix: string; createdAt: string; lastUsed?: string; scopes: string[] }

// TODO(backend): no /api/dev/keys endpoints are ported yet — keys are
// generated and held client-side only for this session (not persisted).
export default function Keys() {
  const [keys, setKeys] = useState<ApiKey[]>([]);
  const [label, setLabel] = useState("");
  const [webhook, setWebhook] = useState("https://api.yourapp.com/webhooks/otp");
  const [newKey, setNewKey] = useState<{ plaintext: string; prefix: string } | null>(null);
  const [creating, setCreating] = useState(false);

  async function handleCreate() {
    setCreating(true);
    try {
      const bytes = new Uint8Array(24);
      crypto.getRandomValues(bytes);
      const rand = Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
      const plaintext = `sk_live_${rand}`;
      const prefix = plaintext.slice(0, 12);
      setKeys((k) => [{ id: crypto.randomUUID(), label: label || "Untitled", prefix, createdAt: new Date().toISOString(), scopes: ["orders:read", "orders:write", "otp:read"] }, ...k]);
      setNewKey({ plaintext, prefix });
      setLabel("");
    } finally {
      setCreating(false);
    }
  }

  function handleRevoke(id: string) {
    setKeys((k) => k.filter((x) => x.id !== id));
    toast.success("Key revoked");
  }

  return (
    <div>
      <PageHeader title="API keys" description="Programmatic access for orders, OTPs and wallet." />

      <div className="grid gap-4 grid-cols-2 lg:grid-cols-4 mb-6">
        <StatCard label="Requests today" value="—" icon={Activity} tone="brand" />
        <StatCard label="This month" value="—" icon={Activity} tone="success" />
        <StatCard label="Rate limit" value="60/s" icon={KeyRound} tone="info" />
        <StatCard label="Active keys" value={String(keys.length)} icon={KeyRound} tone="warning" />
      </div>

      <Card className="shadow-soft mb-6"><CardHeader><CardTitle>Create a new key</CardTitle></CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-3 items-end">
            <div className="flex-1 min-w-[220px]">
              <Label>Label</Label>
              <Input placeholder="e.g. Production" value={label} onChange={(e) => setLabel(e.target.value)} className="mt-2" />
            </div>
            <Button className="gradient-brand" onClick={handleCreate} disabled={creating}>
              <Plus className="h-4 w-4 mr-1" /> {creating ? "Generating…" : "Generate key"}
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card className="shadow-soft mb-6"><CardContent className="p-0">
        <Table>
          <TableHeader><TableRow><TableHead>Label</TableHead><TableHead>Prefix</TableHead><TableHead>Scopes</TableHead><TableHead>Created</TableHead><TableHead>Last used</TableHead><TableHead className="text-right">Actions</TableHead></TableRow></TableHeader>
          <TableBody>
            {keys.map((k) => (
              <TableRow key={k.id}>
                <TableCell className="font-medium">{k.label}</TableCell>
                <TableCell className="font-mono text-xs">{k.prefix}••••</TableCell>
                <TableCell><div className="flex flex-wrap gap-1">{k.scopes.map((s) => <Badge key={s} variant="secondary" className="text-xs">{s}</Badge>)}</div></TableCell>
                <TableCell className="text-xs text-muted-foreground">{dateShort(k.createdAt)}</TableCell>
                <TableCell className="text-xs text-muted-foreground">{k.lastUsed ? dateShort(k.lastUsed) : "—"}</TableCell>
                <TableCell className="text-right">
                  <Button size="sm" variant="ghost" onClick={() => { navigator.clipboard.writeText(k.prefix); toast.success("Prefix copied"); }}><Copy className="h-3.5 w-3.5" /></Button>
                  <Button size="sm" variant="ghost" onClick={() => handleRevoke(k.id)}><Trash2 className="h-3.5 w-3.5 text-destructive" /></Button>
                </TableCell>
              </TableRow>
            ))}
            {keys.length === 0 && <TableRow><TableCell colSpan={6} className="text-center text-sm text-muted-foreground py-6">No keys yet.</TableCell></TableRow>}
          </TableBody>
        </Table>
      </CardContent></Card>

      <Card className="shadow-soft"><CardHeader><CardTitle className="flex items-center gap-2"><Webhook className="h-4 w-4" /> Webhook endpoint</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <div className="flex gap-2">
            <Input value={webhook} onChange={(e) => setWebhook(e.target.value)} />
            <Button variant="outline" onClick={() => toast.success("Webhook saved")}>Save</Button>
          </div>
          <div>
            <Label>Signing secret</Label>
            <div className="mt-2 flex gap-2">
              <Input readOnly value="whsec_••••••••••••" className="font-mono" />
              <Button variant="outline" onClick={() => toast.success("New secret generated")}><RefreshCw className="h-4 w-4" /></Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <Dialog open={!!newKey} onOpenChange={(o) => !o && setNewKey(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Your new API key</DialogTitle>
            <DialogDescription>Copy it now — for security, we won't show it again.</DialogDescription>
          </DialogHeader>
          <div className="flex gap-2">
            <Input readOnly value={newKey?.plaintext ?? ""} className="font-mono text-xs" />
            <Button variant="outline" onClick={() => { navigator.clipboard.writeText(newKey?.plaintext ?? ""); toast.success("Copied"); }}>
              <Copy className="h-4 w-4" />
            </Button>
          </div>
          <DialogFooter>
            <Button onClick={() => setNewKey(null)}>Done</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
