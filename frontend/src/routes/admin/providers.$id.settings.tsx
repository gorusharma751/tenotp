import { useParams, Link, useNavigate } from "@tanstack/react-router";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { ArrowLeft, Archive, Trash2, Activity } from "lucide-react";
import { PageHeader } from "@/components/common/PageHeader";
import { useProvider, useProviderActions } from "@/hooks/useProviders";
import { useProviderModuleActions } from "@/hooks/useProviderModule";
import { providersApi } from "@/lib/providersApi";
import { toast } from "sonner";
import { Skeleton } from "@/components/ui/skeleton";
import { ProviderSubNav } from "@/components/providers/ProviderSubNav";

// NOTE: the monolith's `archiveProviderFn` server function (sets
// archivedAt/status via a raw Mongo update) has no matching REST endpoint in
// backend/src/routes/providers.ts — PATCH /api/providers/:id does not accept
// an `archivedAt` field. TODO: add an /api/providers/:id/archive endpoint (or
// extend PATCH) on the backend, then wire this button to it. Until then this
// button is a no-op that surfaces the limitation via a toast.
function archiveProviderUnavailable() {
  toast.error("Archive is not available yet — no backend endpoint for it.");
}

function ProviderSettingsPage() {
  const { id } = useParams({ strict: false }) as { id: string };
  const navigate = useNavigate();
  const q = useProvider(id);
  const actions = useProviderActions(id);
  const mod = useProviderModuleActions(id);

  if (q.isLoading || !q.data) return <Skeleton className="h-64" />;
  const p = q.data;

  const archive = () => {
    archiveProviderUnavailable();
  };
  const del = async () => {
    if (!confirm(`Delete "${p.name}" and all its data?`)) return;
    try {
      await providersApi.remove(id);
      toast.success("Deleted");
      navigate({ to: "/gourav-ankit-adi/providers" as any });
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  return (
    <div>
      <Button variant="ghost" size="sm" asChild className="mb-3">
        <Link to={"/gourav-ankit-adi/providers/$id" as any} params={{ id } as any}>
          <ArrowLeft className="h-4 w-4 mr-1" />
          Provider
        </Link>
      </Button>
      <PageHeader title={`${p.name} — settings`} description="Enable/disable, archive, delete." />
      <ProviderSubNav id={id} />
      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="shadow-soft">
          <CardHeader>
            <CardTitle className="text-base">Environment</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <label className="flex items-center justify-between">
              <Label>Enabled in sandbox</Label>
              <Switch
                checked={p.enabledInSandbox}
                onCheckedChange={(v) => actions.toggleEnv("sandbox", v)}
              />
            </label>
            <label className="flex items-center justify-between">
              <Label>Enabled in production</Label>
              <Switch
                checked={p.enabledInProduction}
                onCheckedChange={(v) => actions.toggleEnv("production", v)}
              />
            </label>
            <Button
              variant="outline"
              onClick={() => mod.healthCheck.mutate()}
              disabled={mod.healthCheck.isPending}
            >
              <Activity className="h-4 w-4 mr-1" />
              Run health check
            </Button>
          </CardContent>
        </Card>
        <Card className="shadow-soft border-destructive/40">
          <CardHeader>
            <CardTitle className="text-base text-destructive">Danger zone</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm">Archive provider (hide but keep data)</span>
              <Button size="sm" variant="outline" onClick={archive}>
                <Archive className="h-4 w-4 mr-1" />
                Archive
              </Button>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm">Delete provider and all mappings</span>
              <Button size="sm" variant="destructive" onClick={del}>
                <Trash2 className="h-4 w-4 mr-1" />
                Delete
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

export default ProviderSettingsPage;
