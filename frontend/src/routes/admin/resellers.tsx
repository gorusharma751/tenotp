import { useState } from "react";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { PageHeader } from "@/components/common/PageHeader";
import { AdminTable, StatusPill } from "@/components/admin/AdminTable";
import { Toolbar } from "@/components/admin/Toolbar";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { api } from "@/lib/apiClient";
import { money, dateShort, dateTime } from "@/utils/format";
import { toast } from "sonner";
import { Plus, Wallet, Pencil, Trash2, Eye, UserPlus, UserMinus } from "lucide-react";
import type { ResellerPanel, ResellerMember, ResellerLedgerEntry, ResellerBranding } from "@/types";

function parseBranding(json: string): ResellerBranding {
  try {
    return JSON.parse(json) as ResellerBranding;
  } catch {
    return {};
  }
}

function CreateDialog() {
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<"existing" | "new">("existing");
  const [ownerEmail, setOwnerEmail] = useState("");
  const [password, setPassword] = useState("");
  const [ownerName, setOwnerName] = useState("");
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [markup, setMarkup] = useState("20");
  const [busy, setBusy] = useState(false);
  const qc = useQueryClient();

  const reset = () => {
    setOwnerEmail(""); setPassword(""); setOwnerName(""); setName(""); setSlug(""); setMarkup("20"); setMode("existing");
  };

  const create = async () => {
    if (!ownerEmail.trim()) return toast.error("Owner email required");
    if (!name.trim()) return toast.error("Panel name required");
    if (!slug.trim()) return toast.error("Slug required");
    if (mode === "new" && (!ownerName.trim() || password.trim().length < 6)) {
      return toast.error("Name + password (min 6 chars) required for a new user");
    }
    setBusy(true);
    try {
      if (mode === "new") {
        await api.post("/api/admin/resellers", {
          email: ownerEmail.trim(), password, name: ownerName.trim(), slug: slug.trim(), markup: Number(markup) || 20,
        });
      } else {
        await api.post("/api/admin/reseller-panels", {
          ownerEmail: ownerEmail.trim(), name: name.trim(), slug: slug.trim(), markup: Number(markup) || 20,
        });
      }
      toast.success("Reseller panel created");
      setOpen(false);
      reset();
      qc.invalidateQueries({ queryKey: ["admin", "reseller-panels"] });
    } catch (e: any) {
      toast.error(e?.message || "Failed to create panel");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) reset(); }}>
      <DialogTrigger asChild>
        <Button className="gradient-brand">
          <Plus className="mr-2 h-4 w-4" />
          New reseller panel
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>Create reseller panel</DialogTitle></DialogHeader>
        <Tabs value={mode} onValueChange={(v) => setMode(v as "existing" | "new")}>
          <TabsList className="w-full">
            <TabsTrigger value="existing" className="flex-1">Existing user</TabsTrigger>
            <TabsTrigger value="new" className="flex-1">Create new user</TabsTrigger>
          </TabsList>
        </Tabs>
        <div className="space-y-3 pt-1">
          <div>
            <Label>{mode === "existing" ? "Owner email (existing user)" : "Owner email (new account)"}</Label>
            <Input value={ownerEmail} onChange={(e) => setOwnerEmail(e.target.value)} placeholder="owner@example.com" />
          </div>
          {mode === "new" && (
            <>
              <div>
                <Label>Owner name</Label>
                <Input value={ownerName} onChange={(e) => setOwnerName(e.target.value)} placeholder="Full name" />
              </div>
              <div>
                <Label>Password (min 6 chars)</Label>
                <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Set a login password" />
              </div>
            </>
          )}
          <div>
            <Label>Panel name</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Acme Resell" />
          </div>
          <div>
            <Label>Slug</Label>
            <Input value={slug} onChange={(e) => setSlug(e.target.value.toLowerCase())} placeholder="acme-resell" />
          </div>
          <div>
            <Label>Markup (%) — added on top of the normal price for this panel's members</Label>
            <Input type="number" min="0" step="0.1" value={markup} onChange={(e) => setMarkup(e.target.value)} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)} disabled={busy}>Cancel</Button>
          <Button onClick={create} disabled={busy}>{busy ? "Creating…" : "Create"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function EditDialog({ panel }: { panel: ResellerPanel }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(panel.name);
  const [markup, setMarkup] = useState(String(panel.markup_percent));
  const [status, setStatus] = useState(panel.status === "suspended" ? "suspended" : "active");
  const b = parseBranding(panel.branding_json);
  const [logoUrl, setLogoUrl] = useState(b.logoUrl ?? "");
  const [primaryColor, setPrimaryColor] = useState(b.primaryColor ?? "");
  const [supportContact, setSupportContact] = useState(b.supportContact ?? "");
  const [busy, setBusy] = useState(false);
  const qc = useQueryClient();

  const save = async () => {
    setBusy(true);
    try {
      await api.patch(`/api/admin/reseller-panels/${panel.id}`, {
        name: name.trim(),
        markup: Number(markup) || 0,
        status,
        branding: { logoUrl: logoUrl.trim(), primaryColor: primaryColor.trim(), supportContact: supportContact.trim() },
      });
      toast.success("Panel updated");
      setOpen(false);
      qc.invalidateQueries({ queryKey: ["admin", "reseller-panels"] });
    } catch (e: any) {
      toast.error(e?.message || "Failed to update panel");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild><Button variant="ghost" size="icon" title="Edit"><Pencil className="h-4 w-4" /></Button></DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>Edit — {panel.name}</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div>
            <Label>Panel name</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div>
            <Label>Markup (%)</Label>
            <Input type="number" min="0" step="0.1" value={markup} onChange={(e) => setMarkup(e.target.value)} />
          </div>
          <div>
            <Label>Status</Label>
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="suspended">Suspended</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="border-t pt-3">
            <p className="text-xs font-medium text-muted-foreground mb-2">Branding (white-label)</p>
            <div className="space-y-3">
              <div>
                <Label>Logo URL</Label>
                <Input value={logoUrl} onChange={(e) => setLogoUrl(e.target.value)} placeholder="https://…/logo.png" />
              </div>
              <div>
                <Label>Primary color (hex)</Label>
                <Input value={primaryColor} onChange={(e) => setPrimaryColor(e.target.value)} placeholder="#6d28d9" />
              </div>
              <div>
                <Label>Support contact</Label>
                <Input value={supportContact} onChange={(e) => setSupportContact(e.target.value)} placeholder="@handle or email" />
              </div>
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)} disabled={busy}>Cancel</Button>
          <Button onClick={save} disabled={busy}>{busy ? "Saving…" : "Save"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function WalletDialog({ panel }: { panel: ResellerPanel }) {
  const [open, setOpen] = useState(false);
  const [amt, setAmt] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const qc = useQueryClient();

  const confirm = async () => {
    const n = Number(amt);
    if (!n) return toast.error("Enter a non-zero amount");
    setBusy(true);
    try {
      const r = await api.post<{ balance: number }>(`/api/admin/reseller-panels/${panel.id}/wallet`, { amount: n, note });
      toast.success(`New balance ${money(r.balance)}`);
      setOpen(false); setAmt(""); setNote("");
      qc.invalidateQueries({ queryKey: ["admin", "reseller-panels"] });
    } catch (e: any) {
      toast.error(e?.message || "Failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild><Button variant="ghost" size="icon" title="Adjust wallet"><Wallet className="h-4 w-4" /></Button></DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>Adjust wallet — {panel.name}</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div>
            <Label>Amount (negative to deduct)</Label>
            <Input type="number" step="0.01" value={amt} onChange={(e) => setAmt(e.target.value)} placeholder="e.g. 100 or -50" />
          </div>
          <div>
            <Label>Note (optional)</Label>
            <Input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Reason / reference" />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)} disabled={busy}>Cancel</Button>
          <Button onClick={confirm} disabled={busy}>{busy ? "Processing…" : "Confirm"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function AddMemberDialog({ panelId }: { panelId: string }) {
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const qc = useQueryClient();

  const add = async () => {
    if (!email.trim()) return toast.error("Enter a user's email");
    setBusy(true);
    try {
      await api.post(`/api/admin/reseller-panels/${panelId}/members`, { email: email.trim() });
      toast.success("Member added — their future purchases now use this panel's markup");
      setEmail("");
      setOpen(false);
      qc.invalidateQueries({ queryKey: ["admin", "reseller-panels", panelId, "members"] });
      qc.invalidateQueries({ queryKey: ["admin", "reseller-panels"] });
    } catch (e: any) {
      toast.error(e?.message || "Failed to add member");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline"><UserPlus className="mr-1.5 h-3.5 w-3.5" />Add member</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>Add member by email</DialogTitle></DialogHeader>
        <div>
          <Label>User's email (must already have an account)</Label>
          <Input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="user@example.com" />
        </div>
        <p className="text-xs text-muted-foreground">
          Once added, this user's purchases are charged at the panel's markup instead of the standard price — the extra margin is credited to the panel's wallet automatically.
        </p>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)} disabled={busy}>Cancel</Button>
          <Button onClick={add} disabled={busy}>{busy ? "Adding…" : "Add"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function DetailDialog({ panel }: { panel: ResellerPanel }) {
  const [open, setOpen] = useState(false);
  const qc = useQueryClient();

  const membersQ = useQuery({
    queryKey: ["admin", "reseller-panels", panel.id, "members"],
    queryFn: () => api.get<ResellerMember[]>(`/api/admin/reseller-panels/${panel.id}/members`),
    enabled: open,
  });
  const ledgerQ = useQuery({
    queryKey: ["admin", "reseller-panels", panel.id, "ledger"],
    queryFn: () => api.get<ResellerLedgerEntry[]>(`/api/admin/reseller-panels/${panel.id}/ledger`),
    enabled: open,
  });

  const removeM = useMutation({
    mutationFn: (userId: string) => api.del(`/api/admin/reseller-panels/${panel.id}/members/${userId}`),
    onSuccess: () => {
      toast.success("Member removed");
      qc.invalidateQueries({ queryKey: ["admin", "reseller-panels", panel.id, "members"] });
      qc.invalidateQueries({ queryKey: ["admin", "reseller-panels"] });
    },
    onError: (e: any) => toast.error(e?.message || "Failed to remove member"),
  });

  const b = parseBranding(panel.branding_json);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild><Button variant="ghost" size="icon" title="View details"><Eye className="h-4 w-4" /></Button></DialogTrigger>
      <DialogContent className="max-w-2xl">
        <DialogHeader><DialogTitle>{panel.name} — /{panel.slug}</DialogTitle></DialogHeader>
        <Tabs defaultValue="overview">
          <TabsList>
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="members">Members ({membersQ.data?.length ?? panel.users_count ?? 0})</TabsTrigger>
            <TabsTrigger value="ledger">Wallet ledger</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-3">
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div><p className="text-muted-foreground text-xs">Owner</p><p className="font-medium">{panel.owner_email ?? panel.owner_user_id}</p></div>
              <div><p className="text-muted-foreground text-xs">Status</p><StatusPill status={panel.status} /></div>
              <div><p className="text-muted-foreground text-xs">Markup</p><p className="font-medium">{panel.markup_percent}%</p></div>
              <div><p className="text-muted-foreground text-xs">Wallet balance</p><p className="font-medium">{money(panel.wallet_balance)}</p></div>
              <div><p className="text-muted-foreground text-xs">Created</p><p className="font-medium">{dateShort(panel.created_at)}</p></div>
            </div>
            <div className="border-t pt-3 space-y-1.5 text-sm">
              <p className="text-xs font-medium text-muted-foreground">Branding</p>
              {b.logoUrl || b.primaryColor || b.supportContact ? (
                <>
                  {b.logoUrl && <p>Logo: <span className="font-mono text-xs break-all">{b.logoUrl}</span></p>}
                  {b.primaryColor && (
                    <p className="flex items-center gap-2">
                      Color: <span className="font-mono text-xs">{b.primaryColor}</span>
                      <span className="inline-block h-4 w-4 rounded border" style={{ backgroundColor: b.primaryColor }} />
                    </p>
                  )}
                  {b.supportContact && <p>Support: {b.supportContact}</p>}
                </>
              ) : (
                <p className="text-xs text-muted-foreground">Not configured — edit the panel to add a logo, color and support contact.</p>
              )}
            </div>
          </TabsContent>

          <TabsContent value="members" className="space-y-3">
            <div className="flex justify-end"><AddMemberDialog panelId={panel.id} /></div>
            <div className="max-h-72 overflow-y-auto space-y-1.5">
              {membersQ.isLoading && <p className="text-sm text-muted-foreground">Loading…</p>}
              {membersQ.data?.length === 0 && <p className="text-sm text-muted-foreground">No members yet — add one above.</p>}
              {membersQ.data?.map((m) => (
                <div key={m.id} className="flex items-center justify-between rounded-lg border p-2.5 text-sm">
                  <div>
                    <p className="font-medium">{m.name} {m.is_owner && <Badge variant="secondary" className="ml-1 text-[10px]">owner</Badge>}</p>
                    <p className="text-xs text-muted-foreground">{m.email} · wallet {money(m.wallet_balance)}</p>
                  </div>
                  {!m.is_owner && (
                    <Button variant="ghost" size="icon" title="Remove from panel" onClick={() => removeM.mutate(m.id)}>
                      <UserMinus className="h-4 w-4 text-destructive" />
                    </Button>
                  )}
                </div>
              ))}
            </div>
          </TabsContent>

          <TabsContent value="ledger" className="space-y-1.5">
            <div className="max-h-72 overflow-y-auto space-y-1.5">
              {ledgerQ.isLoading && <p className="text-sm text-muted-foreground">Loading…</p>}
              {ledgerQ.data?.length === 0 && <p className="text-sm text-muted-foreground">No wallet activity yet.</p>}
              {ledgerQ.data?.map((tx) => (
                <div key={tx.id} className="flex items-center justify-between rounded-lg border p-2.5 text-sm">
                  <div>
                    <p>{tx.note || (tx.type === "credit" ? "Credit" : "Debit")}</p>
                    <p className="text-xs text-muted-foreground">{dateTime(tx.created_at)}</p>
                  </div>
                  <div className="text-right">
                    <p className={`font-medium tabular-nums ${tx.amount >= 0 ? "text-success" : "text-destructive"}`}>
                      {tx.amount >= 0 ? "+" : ""}{money(tx.amount)}
                    </p>
                    <p className="text-xs text-muted-foreground tabular-nums">bal {money(tx.balance_after)}</p>
                  </div>
                </div>
              ))}
            </div>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}

export default function AdminResellers() {
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ["admin", "reseller-panels"], queryFn: () => api.get<ResellerPanel[]>("/api/admin/reseller-panels") });
  const [query, setQuery] = useState("");

  const deleteM = useMutation({
    mutationFn: (id: string) => api.del(`/api/admin/reseller-panels/${id}`),
    onSuccess: () => {
      toast.success("Panel deleted");
      qc.invalidateQueries({ queryKey: ["admin", "reseller-panels"] });
    },
    onError: (e: any) => toast.error(e?.message || "Failed to delete panel"),
  });

  const rows = (q.data ?? []).filter((p) =>
    p.name.toLowerCase().includes(query.toLowerCase()) ||
    p.slug.toLowerCase().includes(query.toLowerCase()) ||
    (p.owner_email ?? "").toLowerCase().includes(query.toLowerCase()),
  );

  return (
    <div>
      <PageHeader
        title="Resellers"
        description="White-label reseller panels — members buy at the panel's markup, the margin is credited to the panel's wallet automatically."
        actions={<CreateDialog />}
      />
      <Toolbar query={query} onQuery={setQuery} placeholder="Search name, slug or owner email..." />
      <AdminTable rows={rows} columns={[
        { key: "n", header: "Panel", cell: (p) => <div><p className="font-medium">{p.name}</p><p className="text-xs text-muted-foreground">/{p.slug}</p></div> },
        { key: "o", header: "Owner", cell: (p) => <span className="text-sm">{p.owner_email ?? p.owner_user_id}</span> },
        { key: "u", header: "Members", cell: (p) => <span className="tabular-nums">{p.users_count ?? 0}</span> },
        { key: "m", header: "Markup", cell: (p) => <span className="tabular-nums">{p.markup_percent}%</span> },
        { key: "b", header: "Wallet", cell: (p) => <span className="tabular-nums font-medium">{money(p.wallet_balance)}</span> },
        { key: "st", header: "Status", cell: (p) => <StatusPill status={p.status} /> },
        { key: "d", header: "Created", cell: (p) => <span className="text-xs">{dateShort(p.created_at)}</span> },
        { key: "act", header: "", cell: (p) => (
          <div className="flex gap-1">
            <DetailDialog panel={p} />
            <WalletDialog panel={p} />
            <EditDialog panel={p} />
            <Button variant="ghost" size="icon" title="Delete" onClick={() => {
              if (confirm(`Delete reseller panel "${p.name}"? Members will be detached and go back to standard pricing.`)) deleteM.mutate(p.id);
            }}>
              <Trash2 className="h-4 w-4 text-destructive" />
            </Button>
          </div>
        ) },
      ]} />
    </div>
  );
}
