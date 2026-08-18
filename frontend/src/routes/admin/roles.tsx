import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { PageHeader } from "@/components/common/PageHeader";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { api } from "@/lib/apiClient";
import { Plus, Users2, ShieldCheck } from "lucide-react";
import type { AdminRole } from "@/types";

// TODO(backend): role definitions (name/description/permission-set) are
// read-only from GET /api/admin/roles — there's no create/edit endpoint,
// so "Add role" and "Edit" used to fake success with a toast and no
// network call at all. Left honestly disabled instead. "Permissions" now
// links to the real per-user permission editor (/gourav-ankit-adi/permissions,
// backed by GET/POST /api/admin/users/:id/permissions) rather than faking
// a role-scoped editor that doesn't exist.
export default function Page() {
  const q = useQuery({ queryKey: ["admin", "roles"], queryFn: () => api.get<AdminRole[]>("/api/admin/roles") });
  return (
    <div>
      <PageHeader title="Roles" description="Super Admin, Manager, Support, Finance, Viewer." actions={
        <Button className="gradient-brand" disabled title="No backend endpoint yet to create custom roles"><Plus className="mr-2 h-4 w-4" />Add role</Button>
      } />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {(q.data ?? []).map((r) => (
          <Card key={r.id} className="shadow-soft">
            <CardContent className="p-5">
              <div className="flex items-center gap-3">
                <div className="grid h-10 w-10 place-items-center rounded-xl bg-primary/10 text-primary"><ShieldCheck className="h-5 w-5" /></div>
                <div><p className="font-semibold">{r.name}</p><p className="text-xs text-muted-foreground flex items-center gap-1"><Users2 className="h-3 w-3" />{r.members} members</p></div>
              </div>
              <p className="mt-3 text-sm text-muted-foreground">{r.description}</p>
              <div className="mt-3 flex flex-wrap gap-1">
                {r.permissions.slice(0, 4).map((p) => <Badge key={p} variant="outline" className="text-[10px]">{p}</Badge>)}
                {r.permissions.length > 4 && <Badge variant="outline" className="text-[10px]">+{r.permissions.length - 4}</Badge>}
              </div>
              <div className="mt-4 flex gap-2">
                <Button size="sm" variant="outline" className="flex-1" asChild>
                  <Link to={"/gourav-ankit-adi/permissions" as any}>Permissions</Link>
                </Button>
                <Button size="sm" variant="ghost" disabled title="No backend endpoint yet to edit role definitions">Edit</Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
