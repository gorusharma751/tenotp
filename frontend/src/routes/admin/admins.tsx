import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { PageHeader } from "@/components/common/PageHeader";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { UserPlus, Trash2, ShieldCheck, KeyRound } from "lucide-react";
import { useUserStore } from "@/store/userStore";
import { toast } from "sonner";
import { dateShort } from "@/utils/format";
import { api } from "@/lib/apiClient";

export type AdminRoleName = "admin" | "sub_admin";
export interface AdminRow {
  user_id: string;
  email: string;
  name: string | null;
  role: AdminRoleName;
  created_at: string;
}

type AdminRole = AdminRoleName;

export default function AdminAdmins() {
  const qc = useQueryClient();
  const currentAdmin = useUserStore((s) => s.admin);
  const { data: admins = [] } = useQuery<AdminRow[]>({
    queryKey: ["admin", "admins"],
    queryFn: () => api.get<AdminRow[]>("/api/admin/admins"),
  });
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<{ email: string; role: AdminRole }>({
    email: "",
    role: "sub_admin",
  });

  const grant = useMutation({
    mutationFn: async ({ email, role }: { email: string; role: AdminRole }) => {
      await api.post("/api/admin/admins/grant", { email, role });
    },
    onSuccess: () => {
      toast.success("Role granted");
      qc.invalidateQueries({ queryKey: ["admin", "admins"] });
      setOpen(false);
      setForm({ email: "", role: "sub_admin" });
    },
    onError: (e) => toast.error((e as Error).message),
  });

  const revoke = useMutation({
    mutationFn: async ({ userId, role }: { userId: string; role: AdminRole }) => {
      await api.post("/api/admin/admins/revoke", { user_id: userId, role });
    },
    onSuccess: () => {
      toast.success("Role revoked");
      qc.invalidateQueries({ queryKey: ["admin", "admins"] });
    },
    onError: (e) => toast.error((e as Error).message),
  });

  return (
    <div>
      <PageHeader
        title="Admins"
        description="Grant admin or sub-admin access. User must already have an account."
        actions={
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button className="gradient-brand">
                <UserPlus className="h-4 w-4 mr-1" />
                Grant role
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle>Grant admin role</DialogTitle>
              </DialogHeader>
              <div className="grid gap-3">
                <div className="grid gap-1.5">
                  <Label>Email</Label>
                  <Input
                    type="email"
                    value={form.email}
                    onChange={(e) => setForm({ ...form, email: e.target.value })}
                    placeholder="user@company.com"
                  />
                </div>
                <div className="grid gap-1.5">
                  <Label>Role</Label>
                  <Select
                    value={form.role}
                    onValueChange={(v) => setForm({ ...form, role: v as AdminRole })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="sub_admin">Sub-admin (limited)</SelectItem>
                      <SelectItem value="admin">Admin (full access)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <p className="text-xs text-muted-foreground">User must already be registered.</p>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setOpen(false)}>
                  Cancel
                </Button>
                <Button
                  className="gradient-brand"
                  disabled={grant.isPending}
                  onClick={() => grant.mutate({ email: form.email.trim(), role: form.role })}
                >
                  Grant
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        }
      />

      <Card className="shadow-soft">
        <CardContent className="p-4">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Admin</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Since</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {admins.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                      No admins yet
                    </TableCell>
                  </TableRow>
                )}
                {admins.map((a) => (
                  <TableRow key={`${a.user_id}-${a.role}`}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <div className="h-8 w-8 rounded-full bg-primary/10 grid place-items-center text-primary">
                          <ShieldCheck className="h-4 w-4" />
                        </div>
                        <div>
                          <div className="font-medium">{a.name ?? a.email.split("@")[0]}</div>
                          {currentAdmin?.email.toLowerCase() === a.email.toLowerCase() && (
                            <div className="text-xs text-primary">You</div>
                          )}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="text-sm">{a.email}</TableCell>
                    <TableCell>
                      <Badge variant={a.role === "admin" ? "default" : "secondary"}>
                        {a.role === "admin" ? "Admin" : "Sub-admin"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {dateShort(a.created_at)}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        {a.role === "sub_admin" && (
                          <PermissionsDialog userId={a.user_id} label={a.email} />
                        )}
                        <Button
                          size="sm"
                          variant="ghost"
                          className="text-destructive"
                          disabled={currentAdmin?.email.toLowerCase() === a.email.toLowerCase()}
                          onClick={() => {
                            if (
                              confirm(
                                `Revoke ${a.role === "admin" ? "admin" : "sub-admin"} for ${a.email}?`,
                              )
                            )
                              revoke.mutate({ userId: a.user_id, role: a.role });
                          }}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

const PERMISSION_KEYS = [
  { key: "orders.view", label: "View orders" },
  { key: "orders.manage", label: "Manage orders" },
  { key: "users.view", label: "View users" },
  { key: "users.manage", label: "Manage users" },
  { key: "wallets.view", label: "View wallets" },
  { key: "wallets.adjust", label: "Adjust wallets" },
  { key: "services.view", label: "View services" },
  { key: "services.manage", label: "Manage services" },
  { key: "providers.view", label: "View providers" },
  { key: "providers.manage", label: "Manage providers" },
  { key: "resellers.manage", label: "Manage resellers" },
  { key: "coupons.manage", label: "Manage coupons" },
  { key: "reports.view", label: "View reports" },
];

function PermissionsDialog({ userId, label }: { userId: string; label: string }) {
  const [open, setOpen] = useState(false);
  const perms = useQuery({
    queryKey: ["admin", "user-perms", userId],
    queryFn: () => api.get<{ permission_key: string; allowed: boolean }[]>(`/api/admin/users/${userId}/permissions`),
    enabled: open,
  });
  const allowed = new Set((perms.data ?? []).filter((p) => p.allowed).map((p) => p.permission_key));
  const toggle = async (key: string, next: boolean) => {
    try {
      await api.post(`/api/admin/users/${userId}/permissions`, { key, allowed: next });
      perms.refetch();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed");
    }
  };
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="ghost" title="Permissions">
          <KeyRound className="h-4 w-4" />
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Permissions · {label}</DialogTitle>
        </DialogHeader>
        <div className="grid gap-2 max-h-[60vh] overflow-y-auto">
          {PERMISSION_KEYS.map((p) => (
            <label
              key={p.key}
              className="flex items-center justify-between rounded-lg border p-2 text-sm"
            >
              <span>{p.label}</span>
              <Checkbox checked={allowed.has(p.key)} onCheckedChange={(v) => toggle(p.key, !!v)} />
            </label>
          ))}
        </div>
        <p className="text-xs text-muted-foreground">
          Sub-admin will see only checked pages. Full admins bypass all checks.
        </p>
      </DialogContent>
    </Dialog>
  );
}
