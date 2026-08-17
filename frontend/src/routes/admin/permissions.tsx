import { useState } from "react";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { PageHeader } from "@/components/common/PageHeader";
import { AdminTable, StatusPill } from "@/components/admin/AdminTable";
import { Toolbar } from "@/components/admin/Toolbar";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { api } from "@/lib/apiClient";
import { toast } from "sonner";
import { ShieldCheck } from "lucide-react";
import type { AdminUser, PermissionModule, UserPermission } from "@/types";

function PermissionsDialog({ user, open, onOpenChange }: { user: AdminUser; open: boolean; onOpenChange: (v: boolean) => void }) {
  const qc = useQueryClient();
  const modulesQ = useQuery({ queryKey: ["admin", "permissions"], queryFn: () => api.get<PermissionModule[]>("/api/admin/permissions"), enabled: open });
  const userPermsQ = useQuery({
    queryKey: ["admin", "user", user.id, "permissions"],
    queryFn: () => api.get<UserPermission[]>(`/api/admin/users/${user.id}/permissions`),
    enabled: open,
  });

  const toggleM = useMutation({
    mutationFn: ({ key, allowed }: { key: string; allowed: boolean }) => api.post(`/api/admin/users/${user.id}/permissions`, { key, allowed }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin", "user", user.id, "permissions"] });
    },
    onError: (e: any) => toast.error(e?.message || "Failed to update permission"),
  });

  const allowedKeys = new Set((userPermsQ.data ?? []).filter((p) => p.allowed).map((p) => p.permission_key));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[80vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader><DialogTitle>Permissions — {user.name || user.email}</DialogTitle></DialogHeader>
        <div className="space-y-4">
          {(modulesQ.data ?? []).map((m) => (
            <div key={m.module}>
              <p className="mb-2 text-sm font-semibold">{m.module}</p>
              <div className="grid grid-cols-2 gap-2">
                {m.perms.map((p) => {
                  const key = `${m.module}:${p}`;
                  return (
                    <div key={key} className="flex items-center justify-between rounded-lg border px-3 py-2">
                      <Label className="text-xs capitalize">{p}</Label>
                      <Switch
                        checked={allowedKeys.has(key)}
                        disabled={toggleM.isPending}
                        onCheckedChange={(checked) => toggleM.mutate({ key, allowed: checked })}
                      />
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
          {modulesQ.data && modulesQ.data.length === 0 ? <p className="text-sm text-muted-foreground">No permission modules defined.</p> : null}
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default function Page() {
  const q = useQuery({ queryKey: ["admin", "users"], queryFn: () => api.get<AdminUser[]>("/api/admin/users") });
  const [query, setQuery] = useState("");
  const [activeUser, setActiveUser] = useState<AdminUser | null>(null);

  const rows = (q.data ?? []).filter((u) => u.name.toLowerCase().includes(query.toLowerCase()) || u.email.toLowerCase().includes(query.toLowerCase()));

  return (
    <div>
      <PageHeader title="Permissions" description="Fine-grained sub-admin permissions." />
      <Toolbar query={query} onQuery={setQuery} placeholder="Search user or email..." />
      <AdminTable rows={rows} columns={[
        { key: "u", header: "User", cell: (u) => <div><p className="font-medium">{u.name}</p><p className="text-xs text-muted-foreground">{u.email}</p></div> },
        { key: "r", header: "Role", cell: (u) => <span className="capitalize text-xs">{u.role}</span> },
        { key: "st", header: "Status", cell: (u) => <StatusPill status={u.status} /> },
        { key: "act", header: "", cell: (u) => (
          <Button variant="outline" size="sm" onClick={() => setActiveUser(u)}><ShieldCheck className="mr-2 h-4 w-4" />Permissions</Button>
        ) },
      ]} empty="No users found" />

      {activeUser ? (
        <PermissionsDialog user={activeUser} open={!!activeUser} onOpenChange={(v) => !v && setActiveUser(null)} />
      ) : null}
    </div>
  );
}
