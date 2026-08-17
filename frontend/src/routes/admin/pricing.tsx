import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { PageHeader } from "@/components/common/PageHeader";
import { AdminTable } from "@/components/admin/AdminTable";
import { Toolbar } from "@/components/admin/Toolbar";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
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
import { Badge } from "@/components/ui/badge";
import { api } from "@/lib/apiClient";
import { dateTime } from "@/utils/format";
import { toast } from "sonner";
import { Plus, Pencil, Trash2 } from "lucide-react";
import type { PriceRule, ProviderConfig } from "@/types";

const SCOPES = ["global", "provider", "category", "service"] as const;
const MARKUP_TYPES = ["percent", "fixed"] as const;

type RuleForm = {
  provider_id: string;
  scope: (typeof SCOPES)[number];
  scope_ref: string;
  markup_type: (typeof MARKUP_TYPES)[number];
  markup_value: string;
  min_price: string;
  max_price: string;
  currency: string;
  region: string;
  priority: string;
  active: boolean;
};

function emptyForm(): RuleForm {
  return {
    provider_id: "",
    scope: "global",
    scope_ref: "",
    markup_type: "percent",
    markup_value: "0",
    min_price: "",
    max_price: "",
    currency: "INR",
    region: "",
    priority: "100",
    active: true,
  };
}

function ruleToForm(r: PriceRule): RuleForm {
  return {
    provider_id: r.provider_id ?? "",
    scope: r.scope,
    scope_ref: r.scope_ref ?? "",
    markup_type: r.markup_type,
    markup_value: String(r.markup_value ?? 0),
    min_price: r.min_price === null || r.min_price === undefined ? "" : String(r.min_price),
    max_price: r.max_price === null || r.max_price === undefined ? "" : String(r.max_price),
    currency: r.currency ?? "INR",
    region: r.region ?? "",
    priority: String(r.priority ?? 100),
    active: r.active,
  };
}

function formToPayload(f: RuleForm) {
  return {
    provider_id: f.provider_id || null,
    scope: f.scope,
    scope_ref: f.scope_ref || null,
    markup_type: f.markup_type,
    markup_value: Number(f.markup_value) || 0,
    min_price: f.min_price === "" ? null : Number(f.min_price),
    max_price: f.max_price === "" ? null : Number(f.max_price),
    currency: f.currency || "INR",
    region: f.region || null,
    priority: Number(f.priority) || 100,
    active: f.active,
  };
}

function RuleDialog({
  rule,
  providers,
  open,
  onOpenChange,
  onSaved,
}: {
  rule: PriceRule | null;
  providers: ProviderConfig[];
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onSaved: () => void;
}) {
  const [form, setForm] = useState<RuleForm>(rule ? ruleToForm(rule) : emptyForm());

  const reset = () => setForm(rule ? ruleToForm(rule) : emptyForm());

  const save = async () => {
    try {
      const payload = formToPayload(form);
      if (rule) {
        await api.patch(`/api/providers/price-rules/${rule.id}`, payload);
        toast.success("Price rule updated");
      } else {
        await api.post("/api/providers/price-rules", payload);
        toast.success("Price rule created");
      }
      onOpenChange(false);
      onSaved();
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (v) reset();
        onOpenChange(v);
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{rule ? "Edit price rule" : "New price rule"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label>Provider (optional — leave unset to apply to all)</Label>
            <Select
              value={form.provider_id || "__all__"}
              onValueChange={(v) => setForm({ ...form, provider_id: v === "__all__" ? "" : v })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__all__">All providers</SelectItem>
                {providers.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Scope</Label>
              <Select value={form.scope} onValueChange={(v) => setForm({ ...form, scope: v as RuleForm["scope"] })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {SCOPES.map((s) => (
                    <SelectItem key={s} value={s} className="capitalize">
                      {s}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Scope ref (category/service id)</Label>
              <Input
                value={form.scope_ref}
                onChange={(e) => setForm({ ...form, scope_ref: e.target.value })}
                placeholder="e.g. whatsapp"
                disabled={form.scope === "global" || form.scope === "provider"}
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Markup type</Label>
              <Select
                value={form.markup_type}
                onValueChange={(v) => setForm({ ...form, markup_type: v as RuleForm["markup_type"] })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="percent">Percent (%)</SelectItem>
                  <SelectItem value="fixed">Fixed (₹)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Markup value</Label>
              <Input
                type="number"
                step="0.01"
                value={form.markup_value}
                onChange={(e) => setForm({ ...form, markup_value: e.target.value })}
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Min price (optional)</Label>
              <Input
                type="number"
                step="0.01"
                value={form.min_price}
                onChange={(e) => setForm({ ...form, min_price: e.target.value })}
              />
            </div>
            <div>
              <Label>Max price (optional)</Label>
              <Input
                type="number"
                step="0.01"
                value={form.max_price}
                onChange={(e) => setForm({ ...form, max_price: e.target.value })}
              />
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <Label>Currency</Label>
              <Input value={form.currency} onChange={(e) => setForm({ ...form, currency: e.target.value.toUpperCase() })} />
            </div>
            <div>
              <Label>Region (optional)</Label>
              <Input value={form.region} onChange={(e) => setForm({ ...form, region: e.target.value })} />
            </div>
            <div>
              <Label>Priority</Label>
              <Input
                type="number"
                value={form.priority}
                onChange={(e) => setForm({ ...form, priority: e.target.value })}
              />
            </div>
          </div>
          <div className="flex items-center justify-between rounded-md border p-3">
            <Label className="mb-0">Active</Label>
            <Switch checked={form.active} onCheckedChange={(v) => setForm({ ...form, active: v })} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button className="gradient-brand" onClick={save}>
            {rule ? "Save changes" : "Create rule"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default function AdminPricing() {
  const qc = useQueryClient();
  const q = useQuery({
    queryKey: ["admin", "price-rules"],
    queryFn: () => api.get<PriceRule[]>("/api/providers/price-rules"),
  });
  const providersQ = useQuery({
    queryKey: ["admin", "providers"],
    queryFn: () => api.get<ProviderConfig[]>("/api/providers"),
  });
  const providers = providersQ.data ?? [];
  const providerName = (id: string | null) => providers.find((p) => p.id === id)?.name ?? "All providers";

  const [query, setQuery] = useState("");
  const [providerFilter, setProviderFilter] = useState("__all__");
  const [scopeFilter, setScopeFilter] = useState("__all__");

  const [createOpen, setCreateOpen] = useState(false);
  const [editRule, setEditRule] = useState<PriceRule | null>(null);

  const invalidate = () => qc.invalidateQueries({ queryKey: ["admin", "price-rules"] });

  const del = async (id: string) => {
    if (!confirm("Delete this price rule?")) return;
    try {
      await api.del(`/api/providers/price-rules/${id}`);
      toast.success("Price rule deleted");
      invalidate();
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  const toggleActive = async (r: PriceRule, v: boolean) => {
    try {
      await api.patch(`/api/providers/price-rules/${r.id}`, { active: v });
      toast.success(v ? "Rule activated" : "Rule deactivated");
      invalidate();
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  const rows = useMemo(() => {
    let list = q.data ?? [];
    if (providerFilter !== "__all__") list = list.filter((r) => (r.provider_id ?? "") === providerFilter);
    if (scopeFilter !== "__all__") list = list.filter((r) => r.scope === scopeFilter);
    if (query.trim()) {
      const s = query.trim().toLowerCase();
      list = list.filter((r) => {
        const name = providerName(r.provider_id).toLowerCase();
        return (
          name.includes(s) ||
          r.scope.includes(s) ||
          (r.scope_ref ?? "").toLowerCase().includes(s) ||
          (r.region ?? "").toLowerCase().includes(s) ||
          r.currency.toLowerCase().includes(s)
        );
      });
    }
    return list;
    // eslint-disable-next-line react-hooks/exhaustive-deps -- providerName is derived from `providers`, already a dep
  }, [q.data, providerFilter, scopeFilter, query, providers]);

  return (
    <div>
      <PageHeader
        title="Live Pricing"
        description="Cross-server pricing lookup."
        actions={
          <Button className="gradient-brand" onClick={() => setCreateOpen(true)}>
            <Plus className="mr-2 h-4 w-4" />
            New rule
          </Button>
        }
      />
      <Toolbar query={query} onQuery={setQuery} placeholder="Search by provider, scope, region, currency...">
        <Select value={providerFilter} onValueChange={setProviderFilter}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Provider" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__all__">All providers</SelectItem>
            {providers.map((p) => (
              <SelectItem key={p.id} value={p.id}>
                {p.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={scopeFilter} onValueChange={setScopeFilter}>
          <SelectTrigger className="w-[150px]">
            <SelectValue placeholder="Scope" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__all__">All scopes</SelectItem>
            {SCOPES.map((s) => (
              <SelectItem key={s} value={s} className="capitalize">
                {s}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Toolbar>
      <AdminTable
        rows={rows}
        columns={[
          {
            key: "provider",
            header: "Provider",
            cell: (r) => <span className="font-medium">{providerName(r.provider_id)}</span>,
          },
          {
            key: "scope",
            header: "Scope",
            cell: (r) => (
              <div className="flex flex-col">
                <Badge variant="secondary" className="capitalize text-[10px] w-fit">
                  {r.scope}
                </Badge>
                {r.scope_ref ? <span className="text-xs text-muted-foreground mt-1">{r.scope_ref}</span> : null}
              </div>
            ),
          },
          {
            key: "markup",
            header: "Markup",
            cell: (r) => (r.markup_type === "percent" ? `${r.markup_value}%` : `₹${r.markup_value}`),
          },
          {
            key: "range",
            header: "Price range",
            cell: (r) => (
              <span className="text-xs">
                {r.min_price ?? "—"} – {r.max_price ?? "—"} {r.currency}
              </span>
            ),
          },
          {
            key: "region",
            header: "Region",
            cell: (r) => <span className="text-xs">{r.region || "Global"}</span>,
          },
          {
            key: "priority",
            header: "Priority",
            cell: (r) => r.priority,
          },
          {
            key: "active",
            header: "Active",
            cell: (r) => <Switch checked={r.active} onCheckedChange={(v) => toggleActive(r, v)} />,
          },
          {
            key: "updated",
            header: "Updated",
            cell: (r) => <span className="text-xs">{dateTime(r.updated_at)}</span>,
          },
          {
            key: "act",
            header: "",
            cell: (r) => (
              <div className="flex gap-1">
                <Button variant="ghost" size="icon" onClick={() => setEditRule(r)}>
                  <Pencil className="h-4 w-4" />
                </Button>
                <Button variant="ghost" size="icon" onClick={() => del(r.id)}>
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              </div>
            ),
          },
        ]}
      />
      <RuleDialog
        rule={null}
        providers={providers}
        open={createOpen}
        onOpenChange={setCreateOpen}
        onSaved={invalidate}
      />
      {editRule ? (
        <RuleDialog
          rule={editRule}
          providers={providers}
          open={!!editRule}
          onOpenChange={(v) => !v && setEditRule(null)}
          onSaved={invalidate}
        />
      ) : null}
    </div>
  );
}
