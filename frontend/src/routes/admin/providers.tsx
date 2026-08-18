import { Link } from "@tanstack/react-router";
import { useState } from "react";
import { PageHeader } from "@/components/common/PageHeader";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Search, Settings, Activity, PlugZap, Plus, Trash2, RefreshCw, Pencil, Heart, CircleDot, Loader2 } from "lucide-react";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { useQueryClient, useQuery } from "@tanstack/react-query";
import { useProvidersList } from "@/hooks/useProviders";
import { useProviderStore } from "@/store/providerStore";
import { ProviderStatusBadge, ProviderHealthPill } from "@/components/providers/ProviderStatusBadge";
import { Badge } from "@/components/ui/badge";
import { providersApi, syncJobsApi } from "@/lib/providersApi";
import { formatDistanceToNow } from "date-fns";

// NOTE: The monolith's <ServerPickerCard /> (global markup%/fx sync across all
// provider kinds, via 5 separate server functions) has no REST equivalent in
// the backend and is intentionally dropped here. TODO: if that global sync
// flow is needed, a backend endpoint must be added first.

const ADAPTER_INFO: Record<string, { secret: string; baseUrl: string; note: string }> = {
  grizzlysms: { secret: "GRIZZLYSMS_API_KEY", baseUrl: "https://api.grizzlysms.com/stubs/handler_api.php", note: "sms-activate protocol. Needs: API key. Fetches services, countries, live prices." },
  tigersms:   { secret: "TIGERSMS_API_KEY",   baseUrl: "https://api.tiger-sms.com/stubs/handler_api.php", note: "sms-activate protocol. Needs: API key. Fetches services, countries, live prices." },
  smsbower:   { secret: "SMSBOWER_API_KEY",   baseUrl: "https://smsbower.online/stubs/handler_api.php",   note: "sms-activate + getPricesV3 tiers (bronze/silver/gold). Needs: API key." },
  sastasms:   { secret: "SASTASMS_API_KEY",   baseUrl: "https://sastasms.pro/stubs/handler_api.php",     note: "sms-activate style JSON. Needs: API key. Includes aging/gaming numbers." },
  fivesim:    { secret: "FIVESIM_API_KEY",    baseUrl: "https://5sim.net/v1",                            note: "5sim REST API. Needs: Bearer API key. Prices auto-converted from RUB." },
  custom:     { secret: "—", baseUrl: "—", note: "No auto-sync. Prices/services must be added manually." },
};

function AdapterHint({ kind }: { kind: string }) {
  const info = ADAPTER_INFO[kind] ?? ADAPTER_INFO.custom;
  return (
    <div className="rounded-md border bg-muted/40 p-2 text-[11px] space-y-0.5">
      <div><span className="text-muted-foreground">Required secret:</span> <code className="font-mono">{info.secret}</code></div>
      <div><span className="text-muted-foreground">Suggested Base URL:</span> <code className="font-mono break-all">{info.baseUrl}</code></div>
      <div className="text-muted-foreground">{info.note}</div>
      {info.secret !== "—" && (
        <div className="mt-1 rounded bg-warning/10 text-foreground border border-warning/30 p-1.5 font-medium">
          ⚠ The API key field below is for your own reference only — it is NOT what this server actually connects
          with. The real key must be set as the <code className="font-mono">{info.secret}</code> environment
          variable on your backend host (Render → this service → Environment tab), then the service needs a
          restart to pick it up. Use "Health check" or "Test call" on this provider afterward to confirm it's
          really connected.
        </div>
      )}
    </div>
  );
}

function AdminProviders() {
  const s = useProviderStore();
  const list = useProvidersList({ q: s.q, category: s.category, status: s.status, env: s.env });
  const sum = useQuery({ queryKey: ["prov-sum"], queryFn: () => providersApi.summary() });
  const qc = useQueryClient();
  const invalidate = () => { qc.invalidateQueries({ queryKey: ["providers"] }); qc.invalidateQueries({ queryKey: ["prov-sum"] }); };
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ name: "", serverName: "", baseUrl: "https://", apiKey: "", markupPercent: 15, category: "otp" as any, environment: "production" as any, kind: "grizzlysms" });
  const [busy, setBusy] = useState(false);
  const [syncingId, setSyncingId] = useState<string | null>(null);
  const [editing, setEditing] = useState<any | null>(null);

  // Live connection health — auto-polls every 30s and updates providers.status in DB.
  const health = useQuery({
    queryKey: ["provider-health"],
    queryFn: async () => {
      const r = await providersApi.pingAll();
      qc.invalidateQueries({ queryKey: ["providers"] });
      qc.invalidateQueries({ queryKey: ["prov-sum"] });
      return r;
    },
    refetchInterval: 30_000,
    refetchOnWindowFocus: true,
    retry: 1,
  });
  const healthById = new Map<string, NonNullable<typeof health.data>[number]>();
  for (const h of health.data ?? []) healthById.set(h.id, h);
  const [editBusy, setEditBusy] = useState(false);
  const saveEdit = async () => {
    if (!editing) return;
    setEditBusy(true);
    try {
      await providersApi.update(editing.id, {
        name: editing.name,
        serverName: editing.serverName,
        baseUrl: editing.baseUrl,
        markupPercent: Number(editing.markupPercent) || 0,
        enabledInProduction: !!editing.enabledInProduction,
        enabledInSandbox: !!editing.enabledInSandbox,
      });
      toast.success("Provider updated");
      invalidate();
      setEditing(null);
    } catch (e) { toast.error((e as Error).message); }
    finally { setEditBusy(false); }
  };
  const submit = async () => {
    setBusy(true);
    try {
      await providersApi.create(form);
      toast.success(`API "${form.name}" added`);
      invalidate();
      setOpen(false);
      setForm({ name: "", serverName: "", baseUrl: "https://", apiKey: "", markupPercent: 15, category: "otp", environment: "production", kind: "grizzlysms" });
    } catch (e) { toast.error((e as Error).message); }
    finally { setBusy(false); }
  };
  const remove = async (id: string, name: string) => {
    if (!confirm(`Delete API "${name}"?`)) return;
    try { await providersApi.remove(id); toast.success("Deleted"); invalidate(); }
    catch (e) { toast.error((e as Error).message); }
  };
  const toggleLive = async (p: any, v: boolean) => {
    try {
      await providersApi.toggle(p.id, "production", v);
      toast.success(`${p.name} ${v ? "enabled" : "disabled"} for users`);
      invalidate();
    } catch (e) { toast.error((e as Error).message); }
  };
  const syncRow = async (p: any) => {
    setSyncingId(p.id);
    try {
      const r = await syncJobsApi.runServicesSync(p.id);
      if (r.status === "success") toast.success(`Synced ${r.items_out} services`);
      else toast.error(r.error ?? `Sync ${r.status}`);
      qc.invalidateQueries({ queryKey: ["catalog", "services"] });
      qc.invalidateQueries({ queryKey: ["catalog", "countries"] });
      qc.invalidateQueries({ queryKey: ["admin", "services"] });
      qc.invalidateQueries({ queryKey: ["admin", "countries"] });
      invalidate();
    } catch (e) { toast.error((e as Error).message); }
    finally { setSyncingId(null); }
  };

  return (
    <div>
      <PageHeader
        title="Provider APIs"
        description="Add multiple upstream APIs. Prices shown to users come from the API in real time, plus your markup %."
        actions={
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button className="gradient-brand"><Plus className="h-4 w-4 mr-1" />Add API</Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg">
              <DialogHeader><DialogTitle>Add new provider API</DialogTitle></DialogHeader>
              <div className="grid gap-3">
                <div className="grid gap-1.5">
                  <Label>Provider name</Label>
                  <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="e.g. SmsHub" />
                </div>
                <div className="grid gap-1.5">
                  <Label>Server name</Label>
                  <Input value={form.serverName} onChange={(e) => setForm({ ...form, serverName: e.target.value })} placeholder="e.g. eu-west-1" />
                </div>
                <div className="grid gap-1.5">
                  <Label>Base URL</Label>
                  <Input value={form.baseUrl} onChange={(e) => setForm({ ...form, baseUrl: e.target.value })} placeholder="https://api.example.com" />
                </div>
                <div className="grid gap-1.5">
                  <Label>API key</Label>
                  <Input value={form.apiKey} onChange={(e) => setForm({ ...form, apiKey: e.target.value })} placeholder="sk_live_…" />
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <div className="grid gap-1.5">
                    <Label>Category</Label>
                    <Select value={form.category} onValueChange={(v) => setForm({ ...form, category: v as any })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>{["sms","email","push","payment","storage","otp"].map((c) => <SelectItem key={c} value={c}>{c.toUpperCase()}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div className="grid gap-1.5">
                    <Label>Environment</Label>
                    <Select value={form.environment} onValueChange={(v) => setForm({ ...form, environment: v as any })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent><SelectItem value="sandbox">Sandbox</SelectItem><SelectItem value="production">Production</SelectItem></SelectContent>
                    </Select>
                  </div>
                  <div className="grid gap-1.5">
                    <Label>Markup %</Label>
                    <Input type="number" min={0} step="0.1" value={form.markupPercent}
                      onChange={(e) => setForm({ ...form, markupPercent: Number(e.target.value) })} />
                  </div>
                </div>
                <div className="grid gap-1.5">
                  <Label>Adapter (kind)</Label>
                  <Select value={form.kind} onValueChange={(v) => setForm({ ...form, kind: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="grizzlysms">GrizzlySMS (live sync)</SelectItem>
                      <SelectItem value="tigersms">TigerSMS (live sync)</SelectItem>
                      <SelectItem value="smsbower">SmsBower (live sync)</SelectItem>
                      <SelectItem value="sastasms">SastaSMS (live sync)</SelectItem>
                      <SelectItem value="fivesim">5sim (live sync)</SelectItem>
                      <SelectItem value="custom">Custom (manual only)</SelectItem>
                    </SelectContent>
                  </Select>
                  <AdapterHint kind={form.kind} />
                </div>
                <p className="text-xs text-muted-foreground">The end-user sees: <span className="font-medium">API price × (1 + markup%)</span>. Real-time pricing is fetched from the API — you only control the markup.</p>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
                <Button className="gradient-brand" disabled={busy} onClick={submit}>{busy ? "Adding…" : "Add API"}</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        }
      />

      <Card className="shadow-soft mb-4 border-primary/20 bg-primary/5">
        <CardContent className="p-4 text-sm">
          <p className="font-semibold mb-2">How to plug in a new API / platform</p>
          <ol className="list-decimal pl-5 space-y-1 text-muted-foreground text-[13px]">
            <li>Confirm the upstream follows the <span className="font-medium">sms-activate</span> protocol (getBalance, getNumbersStatus, getPrices, getServicesList, getNumber, getStatus, setStatus). If yes, pick <span className="font-medium">GrizzlySMS / TigerSMS / SmsBower</span> as the adapter (kind) — the sync will just work with the new API key.</li>
            <li>Add the API key as a project secret (name it like <code className="text-xs">NEWPROVIDER_API_KEY</code>). Ping support to wire a new adapter file if the protocol is different.</li>
            <li>Click <span className="font-medium">Add API</span> above. Required fields: <span className="font-medium">Name, Server name, Base URL, API key, Category=otp, Environment=production, Markup %, Adapter (kind)</span>.</li>
            <li>After saving, hit the row's <span className="font-medium">Sync</span> button to pull services + countries + live prices. Auto-sync runs every 2 minutes; users always see live upstream price × (1 + markup %).</li>
            <li>User-facing labels stay generic ("Server A / B / C") — the upstream vendor name is never exposed to end users.</li>
          </ol>
        </CardContent>
      </Card>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-6">
        {[
          { label: "Total", value: sum.data?.total, Icon: PlugZap },
          { label: "Connected", value: sum.data?.connected, Icon: PlugZap },
          { label: "Degraded", value: sum.data?.degraded, Icon: Activity },
          { label: "Avg latency", value: sum.data ? `${sum.data.avgLatency}ms` : "…", Icon: Activity },
          { label: "Avg success", value: sum.data ? `${sum.data.avgSuccess}%` : "…", Icon: Activity },
        ].map((it) => (
          <Card key={it.label} className="shadow-soft">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">{it.label}</span>
                <it.Icon className="h-4 w-4 text-muted-foreground" />
              </div>
              {sum.isLoading ? <Skeleton className="h-6 w-12 mt-2" /> : <div className="text-2xl font-bold mt-1">{it.value ?? "—"}</div>}
            </CardContent>
          </Card>
        ))}
      </div>

      {/* TODO: monolith's <ServerPickerCard /> (global markup%/fx sync across
          all provider kinds) dropped — no backend REST equivalent exists yet. */}

      <Card className="shadow-soft mb-6 border-primary/20">
        <CardContent className="p-4 space-y-3">
          <div className="flex items-start justify-between gap-3 flex-wrap">
            <div>
              <div className="flex items-center gap-2">
                <Heart className={`h-4 w-4 ${health.isFetching ? "text-primary animate-pulse" : "text-primary"}`} />
                <h3 className="font-semibold text-sm">Live connection health</h3>
                <Badge variant="secondary" className="text-[10px]">auto · every 30s</Badge>
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">
                Pings each server's balance endpoint and updates its Connected / Error status in real time.
                {health.dataUpdatedAt ? ` Last check ${formatDistanceToNow(new Date(health.dataUpdatedAt), { addSuffix: true })}.` : ""}
              </p>
            </div>
            <Button size="sm" variant="outline" disabled={health.isFetching} onClick={() => health.refetch()}>
              {health.isFetching ? <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5 mr-1.5" />}
              Check now
            </Button>
          </div>

          {health.isLoading ? (
            <Skeleton className="h-24" />
          ) : health.isError ? (
            <div className="text-sm text-destructive">Failed to check health: {(health.error as Error).message}</div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-2">
              {(health.data ?? []).map((h) => {
                const dot = h.status === "connected" ? "text-emerald-500" : h.status === "error" ? "text-red-500" : "text-zinc-400";
                const label = h.status === "connected" ? "Connected" : h.status === "error" ? "Disconnected" : "No adapter";
                return (
                  <div key={h.id} className="rounded-md border bg-card p-3 text-xs space-y-1">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-medium truncate">{h.name}</span>
                      <span className={`inline-flex items-center gap-1 ${dot}`}>
                        <CircleDot className={`h-3 w-3 ${h.status === "connected" ? "animate-pulse" : ""}`} />
                        {label}
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-muted-foreground">
                      <span className="font-mono">{h.kind ?? "—"}</span>
                      <span className="tabular-nums">{h.latencyMs}ms</span>
                    </div>
                    <div className="text-muted-foreground truncate" title={h.message}>
                      {h.balance != null ? `Balance: ${h.balance}` : h.message}
                    </div>
                  </div>
                );
              })}
              {(health.data ?? []).length === 0 && (
                <div className="text-xs text-muted-foreground col-span-full">No providers configured yet.</div>
              )}
            </div>
          )}
        </CardContent>
      </Card>


      <Card className="shadow-soft">
        <CardContent className="p-4 space-y-4">
          <div className="grid gap-3 md:grid-cols-4">
            <div className="relative md:col-span-2">
              <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Search providers…" value={s.q} onChange={(e) => s.setQ(e.target.value)} className="pl-9" />
            </div>
            <Select value={s.category} onValueChange={s.setCategory}>
              <SelectTrigger><SelectValue placeholder="Category" /></SelectTrigger>
              <SelectContent>{["all","sms","email","push","payment","storage","otp"].map((c) => <SelectItem key={c} value={c}>{c[0].toUpperCase()+c.slice(1)}</SelectItem>)}</SelectContent>
            </Select>
            <Select value={s.env} onValueChange={s.setEnv}>
              <SelectTrigger><SelectValue placeholder="Environment" /></SelectTrigger>
              <SelectContent>{["all","sandbox","production"].map((c) => <SelectItem key={c} value={c}>{c[0].toUpperCase()+c.slice(1)}</SelectItem>)}</SelectContent>
            </Select>
          </div>

          {list.isLoading ? (
            <Skeleton className="h-64" />
          ) : list.isError ? (
            <div className="p-10 text-center text-destructive">Failed to load providers.</div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader><TableRow>
                  <TableHead>Provider</TableHead>
                  <TableHead>Server</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead>Env</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Health</TableHead>
                  <TableHead className="text-right">Markup</TableHead>
                  <TableHead className="text-center">Live</TableHead>
                  <TableHead className="text-right">Success</TableHead>
                  <TableHead className="text-right">Latency</TableHead>
                  {/* 11 columns is wide enough to need horizontal scroll on
                      phones — a plain scrolling table hides Actions off
                      the right edge with no visual hint it's there at all,
                      which read as "the buttons are just missing". Sticky
                      + shadow keeps it pinned in view and visually
                      separated regardless of scroll position. */}
                  <TableHead className="text-right sticky right-0 bg-card shadow-[-8px_0_8px_-8px_rgba(0,0,0,0.15)]">Actions</TableHead>
                </TableRow></TableHeader>
                <TableBody>
                  {(list.data ?? []).map((p) => (
                    <TableRow key={p.id}>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <span className="text-lg">{p.logo}</span>
                          <div>
                            <div className="font-medium">{p.name}</div>
                            <div className="text-xs text-muted-foreground">{p.baseUrl}</div>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="text-xs font-mono">{p.serverName ?? "—"}</TableCell>
                      <TableCell><Badge variant="secondary">{p.category}</Badge></TableCell>
                      <TableCell className="text-xs">{p.environment}</TableCell>
                      <TableCell>
                        <ProviderStatusBadge status={(healthById.get(p.id)?.status as any) ?? p.status} />
                      </TableCell>
                      <TableCell>
                        {healthById.get(p.id)
                          ? <ProviderHealthPill health={healthById.get(p.id)!.ok ? "healthy" : "down"} />
                          : <ProviderHealthPill health={p.health} />}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        <Badge variant={((p.markupPercent ?? 0) > 0) ? "default" : "outline"}>+{p.markupPercent ?? 0}%</Badge>
                      </TableCell>
                      <TableCell className="text-center">
                        <Switch checked={!!p.enabledInProduction} onCheckedChange={(v) => toggleLive(p, v)} />
                      </TableCell>
                      <TableCell className="text-right">{p.successRate}%</TableCell>
                      <TableCell className="text-right tabular-nums">{healthById.get(p.id)?.latencyMs ?? p.latencyMs}ms</TableCell>
                      <TableCell className="text-right sticky right-0 bg-card shadow-[-8px_0_8px_-8px_rgba(0,0,0,0.15)]">
                        {/* Four ghost icon buttons in a row with no color
                            distinction all read as one gray blur — each
                            action now gets its own color (matching what it
                            does elsewhere in the app: info=sync/refresh,
                            brand=edit, muted=navigate, destructive=delete)
                            so they're distinguishable at a glance instead
                            of requiring a hover-and-read-the-tooltip pass
                            over every icon. */}
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            size="sm"
                            variant="ghost"
                            className="text-info hover:text-info hover:bg-info/10"
                            title="Sync services"
                            disabled={syncingId === p.id}
                            onClick={() => syncRow(p)}
                          >
                            <RefreshCw className={`h-4 w-4 ${syncingId === p.id ? "animate-spin" : ""}`} />
                          </Button>
                          <Button size="sm" variant="ghost" className="text-primary hover:text-primary hover:bg-primary/10" title="Edit" onClick={() => setEditing({ ...p })}>
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button asChild size="sm" variant="ghost" className="text-muted-foreground hover:text-foreground" title="Configure">
                            <Link to={"/gourav-ankit-adi/providers/$id" as any} params={{ id: p.id } as any}><Settings className="h-4 w-4" /></Link>
                          </Button>
                          <Button size="sm" variant="ghost" className="text-destructive hover:text-destructive hover:bg-destructive/10" title="Delete" onClick={() => remove(p.id, p.name)}>
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={!!editing} onOpenChange={(v) => !v && setEditing(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>Edit provider</DialogTitle></DialogHeader>
          {editing && (
            <div className="grid gap-3">
              <div className="grid gap-1.5">
                <Label>Provider name</Label>
                <Input value={editing.name ?? ""} onChange={(e) => setEditing({ ...editing, name: e.target.value })} />
              </div>
              <div className="grid gap-1.5">
                <Label>Server name</Label>
                <Input value={editing.serverName ?? ""} onChange={(e) => setEditing({ ...editing, serverName: e.target.value })} />
              </div>
              <div className="grid gap-1.5">
                <Label>Base URL</Label>
                <Input value={editing.baseUrl ?? ""} onChange={(e) => setEditing({ ...editing, baseUrl: e.target.value })} />
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div className="grid gap-1.5">
                  <Label>Markup %</Label>
                  <Input type="number" min={0} step="0.1" value={editing.markupPercent ?? 0}
                    onChange={(e) => setEditing({ ...editing, markupPercent: Number(e.target.value) })} />
                </div>
                <div className="grid gap-1.5">
                  <Label>Production</Label>
                  <Select value={editing.enabledInProduction ? "on" : "off"} onValueChange={(v) => setEditing({ ...editing, enabledInProduction: v === "on" })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent><SelectItem value="on">Enabled</SelectItem><SelectItem value="off">Disabled</SelectItem></SelectContent>
                  </Select>
                </div>
                <div className="grid gap-1.5">
                  <Label>Sandbox</Label>
                  <Select value={editing.enabledInSandbox ? "on" : "off"} onValueChange={(v) => setEditing({ ...editing, enabledInSandbox: v === "on" })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent><SelectItem value="on">Enabled</SelectItem><SelectItem value="off">Disabled</SelectItem></SelectContent>
                  </Select>
                </div>
              </div>
              <p className="text-[11px] text-muted-foreground">API key is stored securely as a server-side secret and cannot be edited here.</p>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditing(null)}>Cancel</Button>
            <Button className="gradient-brand" disabled={editBusy} onClick={saveEdit}>{editBusy ? "Saving…" : "Save changes"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default AdminProviders;
