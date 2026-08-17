import { useParams, Link } from "@tanstack/react-router";
import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { ArrowLeft, Plus, Trash2 } from "lucide-react";
import { PageHeader } from "@/components/common/PageHeader";
import { usePriceRules, useProviderModuleActions } from "@/hooks/useProviderModule";
import { ProviderSubNav } from "@/components/providers/ProviderSubNav";

function ProviderPricingPage() {
  const { id } = useParams({ strict: false }) as { id: string };
  const rules = usePriceRules(id);
  const actions = useProviderModuleActions(id);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ scope: "provider", scope_ref: "", markup_type: "percent" as "percent" | "fixed", markup_value: 15, min_price: "", max_price: "", currency: "INR", region: "", priority: 100, active: true });

  const submit = () => {
    actions.createRule.mutate({
      scope: form.scope as any, scope_ref: form.scope_ref || null,
      markup_type: form.markup_type, markup_value: Number(form.markup_value),
      min_price: form.min_price ? Number(form.min_price) : null,
      max_price: form.max_price ? Number(form.max_price) : null,
      currency: form.currency, region: form.region || null,
      priority: Number(form.priority), active: form.active,
    } as any);
    setOpen(false);
  };

  return (
    <div>
      <Button variant="ghost" size="sm" asChild className="mb-3">
        <Link to={"/gourav-ankit-adi/providers/$id" as any} params={{ id } as any}><ArrowLeft className="h-4 w-4 mr-1" />Provider</Link>
      </Button>
      <PageHeader title="Pricing rules" description="Base cost + rules → final price (min/max/region-aware)." actions={
        <Sheet open={open} onOpenChange={setOpen}>
          <SheetTrigger asChild><Button size="sm" className="gradient-brand"><Plus className="h-4 w-4 mr-1" />New rule</Button></SheetTrigger>
          <SheetContent className="sm:max-w-md">
            <SheetHeader><SheetTitle>New price rule</SheetTitle></SheetHeader>
            <div className="grid gap-3 py-4">
              <div className="grid gap-1.5"><Label>Scope</Label>
                <Select value={form.scope} onValueChange={(v) => setForm({ ...form, scope: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="global">Global</SelectItem>
                    <SelectItem value="provider">Provider</SelectItem>
                    <SelectItem value="category">Category</SelectItem>
                    <SelectItem value="service">Service</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {(form.scope === "category" || form.scope === "service") && (
                <div className="grid gap-1.5"><Label>{form.scope === "category" ? "Category name" : "Service ID"}</Label>
                  <Input value={form.scope_ref} onChange={(e) => setForm({ ...form, scope_ref: e.target.value })} /></div>
              )}
              <div className="grid grid-cols-2 gap-3">
                <div className="grid gap-1.5"><Label>Markup type</Label>
                  <Select value={form.markup_type} onValueChange={(v: any) => setForm({ ...form, markup_type: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent><SelectItem value="percent">Percent (%)</SelectItem><SelectItem value="fixed">Fixed (₹)</SelectItem></SelectContent>
                  </Select>
                </div>
                <div className="grid gap-1.5"><Label>Value</Label>
                  <Input type="number" step="0.01" value={form.markup_value} onChange={(e) => setForm({ ...form, markup_value: Number(e.target.value) })} /></div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="grid gap-1.5"><Label>Min price</Label><Input type="number" step="0.01" value={form.min_price} onChange={(e) => setForm({ ...form, min_price: e.target.value })} /></div>
                <div className="grid gap-1.5"><Label>Max price</Label><Input type="number" step="0.01" value={form.max_price} onChange={(e) => setForm({ ...form, max_price: e.target.value })} /></div>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div className="grid gap-1.5"><Label>Currency</Label><Input value={form.currency} onChange={(e) => setForm({ ...form, currency: e.target.value })} /></div>
                <div className="grid gap-1.5"><Label>Region</Label><Input value={form.region} onChange={(e) => setForm({ ...form, region: e.target.value })} placeholder="IN" /></div>
                <div className="grid gap-1.5"><Label>Priority</Label><Input type="number" value={form.priority} onChange={(e) => setForm({ ...form, priority: Number(e.target.value) })} /></div>
              </div>
              <Button className="gradient-brand mt-2" onClick={submit} disabled={actions.createRule.isPending}>Save rule</Button>
            </div>
          </SheetContent>
        </Sheet>
      } />
      <ProviderSubNav id={id} />
      <Card className="shadow-soft"><CardContent className="p-4">
        {rules.isLoading ? <Skeleton className="h-64" /> : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader><TableRow>
                <TableHead>Scope</TableHead><TableHead>Ref</TableHead>
                <TableHead>Markup</TableHead><TableHead>Min/Max</TableHead>
                <TableHead>Region</TableHead><TableHead>Priority</TableHead>
                <TableHead>Status</TableHead><TableHead className="text-right">Actions</TableHead>
              </TableRow></TableHeader>
              <TableBody>
                {(rules.data ?? []).map((r) => (
                  <TableRow key={r.id}>
                    <TableCell><Badge variant="secondary">{r.scope}</Badge></TableCell>
                    <TableCell className="text-xs font-mono">{r.scope_ref ?? "—"}</TableCell>
                    <TableCell>{r.markup_type === "percent" ? `+${r.markup_value}%` : `+₹${r.markup_value}`}</TableCell>
                    <TableCell className="text-xs">{r.min_price ?? "—"} / {r.max_price ?? "—"}</TableCell>
                    <TableCell className="text-xs">{r.region ?? "—"}</TableCell>
                    <TableCell>{r.priority}</TableCell>
                    <TableCell><Badge variant={r.active ? "default" : "outline"}>{r.active ? "active" : "off"}</Badge></TableCell>
                    <TableCell className="text-right">
                      <Button size="sm" variant="ghost" className="text-destructive" onClick={() => actions.deleteRule.mutate(r.id)}><Trash2 className="h-4 w-4" /></Button>
                    </TableCell>
                  </TableRow>
                ))}
                {(rules.data ?? []).length === 0 && (
                  <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground py-10">No rules yet.</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent></Card>
    </div>
  );
}

export default ProviderPricingPage;
