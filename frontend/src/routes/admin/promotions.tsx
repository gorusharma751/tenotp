import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { PageHeader } from "@/components/common/PageHeader";
import { AdminTable, StatusPill } from "@/components/admin/AdminTable";
import { Toolbar } from "@/components/admin/Toolbar";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { api } from "@/lib/apiClient";
import { dateShort } from "@/utils/format";
import { toast } from "sonner";
import { Plus, Pencil, Trash2 } from "lucide-react";
import type { Promotion } from "@/types";

// Promotions is the single backend collection that also backs the Banners
// page (kind === "banner") — see admin/banners.tsx. This page manages the
// full set (banner/offer/popup/announcement) against the real
// GET/POST/PATCH/DELETE /api/admin/promotions endpoints.
const KINDS = ["banner", "offer", "popup", "announcement"] as const;
const STATUSES = ["draft", "scheduled", "live", "ended"] as const;

type PromoForm = {
  title: string;
  kind: (typeof KINDS)[number];
  audience: string;
  status: (typeof STATUSES)[number];
  startsAt: string;
  endsAt: string;
  description: string;
  linkUrl: string;
  imageUrl: string;
};

function emptyForm(): PromoForm {
  return {
    title: "",
    kind: "banner",
    audience: "",
    status: "draft",
    startsAt: "",
    endsAt: "",
    description: "",
    linkUrl: "",
    imageUrl: "",
  };
}

function toLocalInput(iso?: string) {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function promoToForm(p: Promotion): PromoForm {
  return {
    title: p.title,
    kind: p.kind,
    audience: p.audience ?? "",
    status: p.status,
    startsAt: toLocalInput(p.startsAt),
    endsAt: toLocalInput(p.endsAt),
    description: p.description ?? "",
    linkUrl: p.linkUrl ?? "",
    imageUrl: p.imageUrl ?? "",
  };
}

function formToPayload(f: PromoForm) {
  return {
    title: f.title,
    kind: f.kind,
    audience: f.audience || undefined,
    status: f.status,
    startsAt: f.startsAt ? new Date(f.startsAt).toISOString() : null,
    endsAt: f.endsAt ? new Date(f.endsAt).toISOString() : null,
    description: f.description || null,
    linkUrl: f.linkUrl || null,
    imageUrl: f.imageUrl || null,
  };
}

function PromoDialog({
  promo,
  open,
  onOpenChange,
  onSaved,
}: {
  promo: Promotion | null;
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onSaved: () => void;
}) {
  const [form, setForm] = useState<PromoForm>(promo ? promoToForm(promo) : emptyForm());

  const reset = () => setForm(promo ? promoToForm(promo) : emptyForm());

  const save = async () => {
    if (!form.title.trim()) {
      toast.error("Title is required");
      return;
    }
    try {
      const payload = formToPayload(form);
      if (promo) {
        await api.patch(`/api/admin/promotions/${promo.id}`, payload);
        toast.success("Promotion updated");
      } else {
        await api.post("/api/admin/promotions", payload);
        toast.success("Promotion created");
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
          <DialogTitle>{promo ? "Edit promotion" : "New promotion"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label>Title</Label>
            <Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="e.g. Diwali offer" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Kind</Label>
              <Select value={form.kind} onValueChange={(v) => setForm({ ...form, kind: v as PromoForm["kind"] })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {KINDS.map((k) => (
                    <SelectItem key={k} value={k} className="capitalize">
                      {k}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Status</Label>
              <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v as PromoForm["status"] })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {STATUSES.map((s) => (
                    <SelectItem key={s} value={s} className="capitalize">
                      {s}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div>
            <Label>Audience (optional)</Label>
            <Input value={form.audience} onChange={(e) => setForm({ ...form, audience: e.target.value })} placeholder="e.g. all, users, resellers" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Starts at (optional)</Label>
              <Input type="datetime-local" value={form.startsAt} onChange={(e) => setForm({ ...form, startsAt: e.target.value })} />
            </div>
            <div>
              <Label>Ends at (optional)</Label>
              <Input type="datetime-local" value={form.endsAt} onChange={(e) => setForm({ ...form, endsAt: e.target.value })} />
            </div>
          </div>
          <div>
            <Label>Description (optional)</Label>
            <Textarea rows={3} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Link URL (optional)</Label>
              <Input value={form.linkUrl} onChange={(e) => setForm({ ...form, linkUrl: e.target.value })} placeholder="https://..." />
            </div>
            <div>
              <Label>Image URL (optional)</Label>
              <Input value={form.imageUrl} onChange={(e) => setForm({ ...form, imageUrl: e.target.value })} placeholder="https://..." />
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button className="gradient-brand" onClick={save}>
            {promo ? "Save changes" : "Create promotion"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default function AdminPromotions() {
  const qc = useQueryClient();
  const q = useQuery({
    queryKey: ["admin", "promotions"],
    queryFn: () => api.get<Promotion[]>("/api/admin/promotions"),
  });

  const [query, setQuery] = useState("");
  const [kindFilter, setKindFilter] = useState("__all__");
  const [statusFilter, setStatusFilter] = useState("__all__");

  const [createOpen, setCreateOpen] = useState(false);
  const [editPromo, setEditPromo] = useState<Promotion | null>(null);

  const invalidate = () => qc.invalidateQueries({ queryKey: ["admin", "promotions"] });

  const del = async (id: string) => {
    if (!confirm("Delete this promotion?")) return;
    try {
      await api.del(`/api/admin/promotions/${id}`);
      toast.success("Promotion deleted");
      invalidate();
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  const toggleLive = async (p: Promotion, v: boolean) => {
    try {
      await api.patch(`/api/admin/promotions/${p.id}`, { status: v ? "live" : "draft" });
      toast.success(v ? "Promotion set live" : "Promotion set to draft");
      invalidate();
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  const rows = useMemo(() => {
    let list = q.data ?? [];
    if (kindFilter !== "__all__") list = list.filter((p) => p.kind === kindFilter);
    if (statusFilter !== "__all__") list = list.filter((p) => p.status === statusFilter);
    if (query.trim()) {
      const s = query.trim().toLowerCase();
      list = list.filter(
        (p) =>
          p.title.toLowerCase().includes(s) ||
          (p.audience ?? "").toLowerCase().includes(s) ||
          (p.description ?? "").toLowerCase().includes(s),
      );
    }
    return list;
  }, [q.data, kindFilter, statusFilter, query]);

  return (
    <div>
      <PageHeader
        title="Promotions"
        description="Banners, offers and announcements."
        actions={
          <Button className="gradient-brand" onClick={() => setCreateOpen(true)}>
            <Plus className="mr-2 h-4 w-4" />
            New promotion
          </Button>
        }
      />
      <Toolbar query={query} onQuery={setQuery} placeholder="Search by title, audience, description...">
        <Select value={kindFilter} onValueChange={setKindFilter}>
          <SelectTrigger className="w-[150px]">
            <SelectValue placeholder="Kind" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__all__">All kinds</SelectItem>
            {KINDS.map((k) => (
              <SelectItem key={k} value={k} className="capitalize">
                {k}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[150px]">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__all__">All statuses</SelectItem>
            {STATUSES.map((s) => (
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
            key: "title",
            header: "Title",
            cell: (p) => <span className="font-medium">{p.title}</span>,
          },
          {
            key: "kind",
            header: "Kind",
            cell: (p) => (
              <Badge variant="secondary" className="capitalize text-[10px]">
                {p.kind}
              </Badge>
            ),
          },
          {
            key: "audience",
            header: "Audience",
            cell: (p) => <span className="text-xs">{p.audience || "All audiences"}</span>,
          },
          {
            key: "window",
            header: "Window",
            cell: (p) => (
              <span className="text-xs">
                {p.startsAt ? dateShort(p.startsAt) : "—"} → {p.endsAt ? dateShort(p.endsAt) : "—"}
              </span>
            ),
          },
          {
            key: "live",
            header: "Live",
            cell: (p) => <Switch checked={p.status === "live"} onCheckedChange={(v) => toggleLive(p, v)} />,
          },
          {
            key: "status",
            header: "Status",
            cell: (p) => <StatusPill status={p.status} />,
          },
          {
            key: "act",
            header: "",
            cell: (p) => (
              <div className="flex gap-1">
                <Button variant="ghost" size="icon" onClick={() => setEditPromo(p)}>
                  <Pencil className="h-4 w-4" />
                </Button>
                <Button variant="ghost" size="icon" onClick={() => del(p.id)}>
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              </div>
            ),
          },
        ]}
      />
      <PromoDialog promo={null} open={createOpen} onOpenChange={setCreateOpen} onSaved={invalidate} />
      {editPromo ? (
        <PromoDialog
          promo={editPromo}
          open={!!editPromo}
          onOpenChange={(v) => !v && setEditPromo(null)}
          onSaved={invalidate}
        />
      ) : null}
    </div>
  );
}
