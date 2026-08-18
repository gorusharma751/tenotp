import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import { Edit, KeyRound } from "lucide-react";
import { api } from "@/lib/apiClient";

interface Props {
  userId: string;
  initial: { name: string; email: string; phone?: string; status?: string; wallet?: number; role?: string };
}

export function UserEditDialog({ userId, initial }: Props) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(initial.name || "");
  const [email, setEmail] = useState(initial.email || "");
  const [phone, setPhone] = useState(initial.phone || "");
  const [status, setStatus] = useState(initial.status || "active");
  const [wallet, setWallet] = useState(String(initial.wallet ?? ""));
  const [role, setRole] = useState(initial.role || "user");
  const [pw, setPw] = useState("");
  const [busy, setBusy] = useState(false);
  const qc = useQueryClient();

  const save = async () => {
    // Wallet-balance overwrite and role escalation (esp. granting "admin")
    // used to fire on a single "Save changes" click with no distinct
    // warning at all — bundled in with harmless fields like name/phone.
    const walletChanged = wallet !== "" && Number(wallet) !== Number(initial.wallet ?? 0);
    const roleChanged = Boolean(role) && role !== initial.role;
    if (walletChanged || roleChanged) {
      const parts: string[] = [];
      if (walletChanged) parts.push(`set the wallet balance to ₹${Number(wallet).toFixed(2)}`);
      if (roleChanged) parts.push(`grant the "${role}" role`);
      if (!confirm(`This will ${parts.join(" and ")}. Continue?`)) return;
    }
    setBusy(true);
    try {
      await api.post(`/api/admin/users/${userId}/profile`, {
        name, email, phone, status,
        wallet_balance: wallet === "" ? undefined : Number(wallet),
      });
      if (role && role !== initial.role) {
        // add new role; caller can also remove old via UI later
        await api.post(`/api/admin/users/${userId}/role`, { role, add: true });
      }
      if (pw) {
        await api.post(`/api/admin/users/${userId}/reset-password`, { new_password: pw });
      }
      toast.success("User updated");
      setPw("");
      setOpen(false);
      qc.invalidateQueries({ queryKey: ["admin", "users"] });
      qc.invalidateQueries({ queryKey: ["admin", "wallets"] });
    } catch (e: any) {
      toast.error(e?.message || "Failed to update");
    } finally { setBusy(false); }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="icon" title="Edit user"><Edit className="h-4 w-4" /></Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader><DialogTitle>Edit user</DialogTitle></DialogHeader>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="sm:col-span-2"><Label>Name</Label><Input value={name} onChange={(e) => setName(e.target.value)} /></div>
          <div><Label>Email</Label><Input value={email} onChange={(e) => setEmail(e.target.value)} /></div>
          <div><Label>Phone</Label><Input value={phone} onChange={(e) => setPhone(e.target.value)} /></div>
          <div>
            <Label>Status</Label>
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="frozen">Frozen</SelectItem>
                <SelectItem value="blocked">Blocked</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Role</Label>
            <Select value={role} onValueChange={setRole}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="user">User</SelectItem>
                <SelectItem value="reseller">Reseller</SelectItem>
                <SelectItem value="sub_admin">Sub-admin</SelectItem>
                <SelectItem value="admin">Admin</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="sm:col-span-2"><Label>Wallet balance (₹)</Label><Input type="number" step="0.01" value={wallet} onChange={(e) => setWallet(e.target.value)} /></div>
          <Separator className="sm:col-span-2 my-1" />
          <div className="sm:col-span-2">
            <Label className="flex items-center gap-1.5"><KeyRound className="h-3.5 w-3.5" />Reset password (optional, ≥8 chars)</Label>
            <Input type="text" value={pw} onChange={(e) => setPw(e.target.value)} placeholder="Leave empty to skip" />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)} disabled={busy}>Cancel</Button>
          <Button onClick={save} disabled={busy}>{busy ? "Saving…" : "Save changes"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
