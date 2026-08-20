import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { PageHeader } from "@/components/common/PageHeader";
import { AdminTable, StatusPill } from "@/components/admin/AdminTable";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Plus } from "lucide-react";
import { api } from "@/lib/apiClient";
import { money } from "@/utils/format";
import { toast } from "sonner";

interface AdminProviderRow {
  id: string; email: string | null; companyName: string; status: string; online: boolean; priority: number;
  pendingBalance: number; availableBalance: number; totalEarnings: number; completedRequests: number; failedRequests: number; successRate: number | null;
}

export default function AdminManualProviders() {
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ["admin", "mp", "providers"], queryFn: () => api.get<AdminProviderRow[]>("/api/manual-providers/admin/providers") });
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ email: "", companyName: "", country: "", priority: "0" });

  const createM = useMutation({
    mutationFn: () => api.post("/api/manual-providers/admin/providers", { email: form.email, companyName: form.companyName, country: form.country, priority: Number(form.priority) }),
    onSuccess: () => {
      toast.success("Provider onboarded");
      setOpen(false);
      setForm({ email: "", companyName: "", country: "", priority: "0" });
      qc.invalidateQueries({ queryKey: ["admin", "mp", "providers"] });
    },
    onError: (e: any) => toast.error(e?.message || "Could not onboard provider"),
  });

  const toggleM = useMutation({
    mutationFn: (v: { id: string; status: string }) => api.patch(`/api/manual-providers/admin/providers/${v.id}`, { status: v.status }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin", "mp", "providers"] }),
    onError: (e: any) => toast.error(e?.message || "Could not update"),
  });

  return (
    <div>
      <PageHeader
        title="Providers"
        description="Onboard sellers — they must already have a normal TenOTP account."
        actions={
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild><Button className="gradient-brand"><Plus className="h-4 w-4 mr-1" />Add provider</Button></DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Onboard a provider</DialogTitle></DialogHeader>
              <div className="grid gap-3">
                <div className="grid gap-1.5"><Label>User's existing account email</Label><Input value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="seller@example.com" /></div>
                <div className="grid gap-1.5"><Label>Company / display name</Label><Input value={form.companyName} onChange={(e) => setForm({ ...form, companyName: e.target.value })} /></div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="grid gap-1.5"><Label>Country</Label><Input value={form.country} onChange={(e) => setForm({ ...form, country: e.target.value })} /></div>
                  <div className="grid gap-1.5"><Label>Priority (higher = preferred)</Label><Input type="number" value={form.priority} onChange={(e) => setForm({ ...form, priority: e.target.value })} /></div>
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
                <Button className="gradient-brand" disabled={!form.email || !form.companyName || createM.isPending} onClick={() => createM.mutate()}>
                  {createM.isPending ? "Adding…" : "Add provider"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        }
      />
      <AdminTable
        rows={q.data ?? []}
        columns={[
          { key: "n", header: "Company", cell: (r) => <div><p className="font-medium">{r.companyName}</p><p className="text-xs text-muted-foreground">{r.email}</p></div> },
          { key: "st", header: "Status", cell: (r) => <StatusPill status={r.status === "active" ? (r.online ? "active" : "pending") : "suspended"} /> },
          { key: "pr", header: "Priority", cell: (r) => r.priority },
          { key: "sr", header: "Success", cell: (r) => r.successRate === null ? "—" : `${r.successRate}%` },
          { key: "c", header: "Completed", cell: (r) => r.completedRequests },
          { key: "pend", header: "Pending", cell: (r) => money(r.pendingBalance) },
          { key: "avail", header: "Available", cell: (r) => money(r.availableBalance) },
          { key: "act", header: "", cell: (r) => (
            <div className="flex gap-1">
              <Button asChild size="sm" variant="outline"><Link to={`/gourav-ankit-adi/manual-provider/providers/${r.id}` as any}>View</Link></Button>
              <Button size="sm" variant="outline" onClick={() => toggleM.mutate({ id: r.id, status: r.status === "active" ? "disabled" : "active" })}>
                {r.status === "active" ? "Disable" : "Enable"}
              </Button>
            </div>
          ) },
        ]}
        empty="No providers onboarded yet."
      />
    </div>
  );
}
