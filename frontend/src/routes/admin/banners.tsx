import { useQuery, useQueryClient } from "@tanstack/react-query";
import { PageHeader } from "@/components/common/PageHeader";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { Trash2, ImageIcon } from "lucide-react";
import { api } from "@/lib/apiClient";
import type { Promotion } from "@/types";

// The monolith's "Banners" page rendered a hardcoded local mock array with no
// server calls at all. There is no distinct "banners" collection on the
// backend — banners are promotions with kind === "banner" (see
// backend/src/routes/admin.ts GET/PATCH/DELETE /api/admin/promotions), so
// this page is wired to that real endpoint, filtered to that kind.
const GRADIENTS = [
  "from-orange-500/30 to-red-500/30",
  "from-emerald-500/30 to-teal-500/30",
  "from-indigo-500/30 to-purple-500/30",
  "from-pink-500/30 to-rose-500/30",
];

export default function AdminBanners() {
  const qc = useQueryClient();
  const q = useQuery({
    queryKey: ["admin", "promotions"],
    queryFn: () => api.get<Promotion[]>("/api/admin/promotions"),
  });
  const banners = (q.data ?? []).filter((p) => p.kind === "banner");
  const invalidate = () => qc.invalidateQueries({ queryKey: ["admin", "promotions"] });

  const toggle = async (b: Promotion, v: boolean) => {
    try {
      await api.patch(`/api/admin/promotions/${b.id}`, { status: v ? "live" : "draft" });
      toast.success(`Banner ${v ? "enabled" : "disabled"}`);
      invalidate();
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  const del = async (id: string) => {
    if (!confirm("Delete this banner?")) return;
    try {
      await api.del(`/api/admin/promotions/${id}`);
      toast.success("Deleted");
      invalidate();
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  return (
    <div>
      <PageHeader title="Banners" description="Manage homepage and product-area banners (promotions of kind 'banner')." />
      <div className="grid gap-4 sm:grid-cols-2">
        {banners.length === 0 && (
          <p className="text-sm text-muted-foreground">No banners yet. Create one from the Promotions page (kind: Banner).</p>
        )}
        {banners.map((b, i) => (
          <Card key={b.id} className="shadow-soft overflow-hidden">
            {b.imageUrl ? (
              <img src={b.imageUrl} alt={b.title} className="h-32 w-full object-cover" />
            ) : (
              <div className={`h-32 bg-gradient-to-br ${GRADIENTS[i % GRADIENTS.length]} grid place-items-center`}>
                <ImageIcon className="h-8 w-8 text-white/70" />
              </div>
            )}
            <CardContent className="p-4">
              <p className="font-semibold">{b.title}</p>
              <p className="text-xs text-muted-foreground">{b.audience || "All audiences"}</p>
              <div className="mt-3 flex items-center justify-between">
                <Switch checked={b.status === "live"} onCheckedChange={(v) => toggle(b, v)} />
                <div className="flex gap-1">
                  <Button variant="ghost" size="icon" onClick={() => del(b.id)}>
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
