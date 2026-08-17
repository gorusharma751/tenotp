import { useParams, useRouter } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { PageHeader } from "@/components/common/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowLeft, Activity, Send, Save } from "lucide-react";
import { useProvider, useProviderLogs, useProviderActions } from "@/hooks/useProviders";
import { ProviderStatusBadge, ProviderHealthPill } from "@/components/providers/ProviderStatusBadge";
import { dateTime } from "@/utils/format";

function ProviderDetails() {
  const { id } = useParams({ strict: false }) as { id: string };
  const router = useRouter();
  const q = useProvider(id);
  const logs = useProviderLogs(id);
  const actions = useProviderActions(id);
  const [form, setForm] = useState<Record<string, unknown>>({});
  useEffect(() => { if (q.data) setForm({ baseUrl: q.data.baseUrl, serverName: q.data.serverName ?? "", markupPercent: q.data.markupPercent ?? 0, apiKey: q.data.apiKey, apiSecret: q.data.apiSecret, webhookSecret: q.data.webhookSecret ?? "", timeoutMs: q.data.timeoutMs, retries: q.data.retries, rateLimitPerMinute: q.data.rateLimitPerMinute, environment: q.data.environment }); }, [q.data]);

  if (q.isLoading || !q.data) return <div className="space-y-4"><Skeleton className="h-10 w-1/3" /><Skeleton className="h-64" /></div>;
  const p = q.data;

  return (
    <div>
      <Button variant="ghost" size="sm" onClick={() => router.history.back()} className="mb-3"><ArrowLeft className="h-4 w-4 mr-1" />Back</Button>
      <PageHeader title={`${p.logo} ${p.name}`} description={p.baseUrl} actions={
        <div className="flex flex-wrap gap-2">
          <ProviderStatusBadge status={p.status} />
          <ProviderHealthPill health={p.health} />
          <Button size="sm" variant="outline" onClick={actions.healthCheck}><Activity className="h-4 w-4 mr-1" />Health check</Button>
          <Button size="sm" className="gradient-brand" onClick={() => actions.test({ ping: true })}><Send className="h-4 w-4 mr-1" />Test call</Button>
        </div>
      } />

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="shadow-soft lg:col-span-2">
          <CardContent className="p-6">
            <Tabs defaultValue="config">
              <TabsList className="flex-wrap">
                <TabsTrigger value="config">Configuration</TabsTrigger>
                <TabsTrigger value="logs">Request / Response logs</TabsTrigger>
                <TabsTrigger value="rate">Rate & retries</TabsTrigger>
              </TabsList>

              <TabsContent value="config" className="mt-6 space-y-4">
                <div className="grid gap-4 md:grid-cols-2">
                  <Field label="Base URL"><Input value={String(form.baseUrl ?? "")} onChange={(e) => setForm((f) => ({ ...f, baseUrl: e.target.value }))} /></Field>
                  <Field label="Server name"><Input value={String(form.serverName ?? "")} onChange={(e) => setForm((f) => ({ ...f, serverName: e.target.value }))} placeholder="e.g. eu-west-1" /></Field>
                  <Field label="Environment">
                    <Select value={String(form.environment ?? "sandbox")} onValueChange={(v) => setForm((f) => ({ ...f, environment: v }))}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent><SelectItem value="sandbox">Sandbox</SelectItem><SelectItem value="production">Production</SelectItem></SelectContent>
                    </Select>
                  </Field>
                  <Field label="Markup % over API price">
                    <Input type="number" min={0} step="0.1" value={Number(form.markupPercent ?? 0)}
                      onChange={(e) => setForm((f) => ({ ...f, markupPercent: Number(e.target.value) }))} />
                  </Field>
                  <Field label="API Key (placeholder)"><Input type="password" value={String(form.apiKey ?? "")} onChange={(e) => setForm((f) => ({ ...f, apiKey: e.target.value }))} /></Field>
                  <Field label="API Secret (placeholder)"><Input type="password" value={String(form.apiSecret ?? "")} onChange={(e) => setForm((f) => ({ ...f, apiSecret: e.target.value }))} /></Field>
                  <Field label="Webhook secret"><Input type="password" value={String(form.webhookSecret ?? "")} onChange={(e) => setForm((f) => ({ ...f, webhookSecret: e.target.value }))} /></Field>
                </div>
                <div className="flex items-center gap-6">
                  <ToggleRow label="Enabled in sandbox" checked={p.enabledInSandbox} onChange={(v) => actions.toggleEnv("sandbox", v)} />
                  <ToggleRow label="Enabled in production" checked={p.enabledInProduction} onChange={(v) => actions.toggleEnv("production", v)} />
                </div>
                <Button className="gradient-brand" onClick={() => actions.save(form)}><Save className="h-4 w-4 mr-1" />Save configuration</Button>
              </TabsContent>

              <TabsContent value="logs" className="mt-4">
                {logs.isLoading ? <Skeleton className="h-40" /> : (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader><TableRow>
                        <TableHead>When</TableHead><TableHead>Direction</TableHead><TableHead>Method</TableHead>
                        <TableHead>Path</TableHead><TableHead>Status</TableHead><TableHead className="text-right">Latency</TableHead>
                      </TableRow></TableHeader>
                      <TableBody>
                        {((logs.data ?? []) as any[]).map((l) => (
                          <TableRow key={l.id}>
                            <TableCell className="text-xs text-muted-foreground">{dateTime(l.at)}</TableCell>
                            <TableCell><Badge variant="outline">{l.direction}</Badge></TableCell>
                            <TableCell className="font-mono text-xs">{l.method}</TableCell>
                            <TableCell className="font-mono text-xs">{l.path}</TableCell>
                            <TableCell><Badge variant={l.status >= 500 ? "destructive" : l.status >= 400 ? "secondary" : "default"}>{l.status}</Badge></TableCell>
                            <TableCell className="text-right text-xs">{l.latencyMs}ms</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </TabsContent>

              <TabsContent value="rate" className="mt-4 space-y-4">
                <div className="grid gap-4 md:grid-cols-3">
                  <Field label="Timeout (ms)"><Input type="number" value={Number(form.timeoutMs ?? 0)} onChange={(e) => setForm((f) => ({ ...f, timeoutMs: Number(e.target.value) }))} /></Field>
                  <Field label="Retries"><Input type="number" value={Number(form.retries ?? 0)} onChange={(e) => setForm((f) => ({ ...f, retries: Number(e.target.value) }))} /></Field>
                  <Field label="Rate limit (req/min)"><Input type="number" value={Number(form.rateLimitPerMinute ?? 0)} onChange={(e) => setForm((f) => ({ ...f, rateLimitPerMinute: Number(e.target.value) }))} /></Field>
                </div>
                <Button className="gradient-brand" onClick={() => actions.save(form)}><Save className="h-4 w-4 mr-1" />Save</Button>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>

        <div className="space-y-4">
          <Card className="shadow-soft">
            <CardHeader><CardTitle className="text-base">Snapshot</CardTitle></CardHeader>
            <CardContent className="space-y-2 text-sm">
              <Row k="Category" v={<Badge variant="secondary">{p.category}</Badge>} />
              <Row k="Success rate" v={`${p.successRate}%`} />
              <Row k="Latency" v={`${p.latencyMs}ms`} />
              <Row k="Rate limit" v={`${p.rateLimitPerMinute}/min`} />
              <Row k="Timeout" v={`${p.timeoutMs}ms`} />
              <Row k="Retries" v={p.retries} />
              {p.lastCheckAt && <Row k="Last check" v={dateTime(p.lastCheckAt)} />}
              <Row k="Updated" v={dateTime(p.updatedAt)} />
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div><Label className="text-xs mb-1 block text-muted-foreground">{label}</Label>{children}</div>;
}
function ToggleRow({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return <label className="flex items-center gap-2 text-sm"><Switch checked={checked} onCheckedChange={onChange} />{label}</label>;
}
function Row({ k, v }: { k: string; v: React.ReactNode }) {
  return <div className="flex items-center justify-between"><span className="text-muted-foreground">{k}</span><span className="font-medium">{v}</span></div>;
}

export default ProviderDetails;
