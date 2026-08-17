import { Link } from "@tanstack/react-router";
import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { PageHeader } from "@/components/common/PageHeader";
import { AdminTable, StatusPill } from "@/components/admin/AdminTable";
import { Toolbar } from "@/components/admin/Toolbar";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Pagination, PaginationContent, PaginationItem, PaginationLink, PaginationNext, PaginationPrevious } from "@/components/ui/pagination";
import { api } from "@/lib/apiClient";
import { money, dateShort } from "@/utils/format";
import { toast } from "sonner";
import { Download, MoreHorizontal, Eye } from "lucide-react";
import { UserEditDialog } from "@/components/admin/UserEditDialog";
import type { AdminUser } from "@/types";

export default function Page() {
  const q = useQuery({ queryKey: ["admin", "users"], queryFn: () => api.get<AdminUser[]>("/api/admin/users") });
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("all");
  const [role, setRole] = useState("all");
  const [page, setPage] = useState(1);
  const perPage = 10;

  const filtered = useMemo(() => (q.data ?? []).filter((u) =>
    (status === "all" || u.status === status) &&
    (role === "all" || u.role === role) &&
    (query === "" || u.name.toLowerCase().includes(query.toLowerCase()) || u.email.toLowerCase().includes(query.toLowerCase()))
  ), [q.data, status, role, query]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / perPage));
  const rows = filtered.slice((page - 1) * perPage, page * perPage);

  const exportCsv = () => {
    const csv = ["id,name,email,country,role,status,wallet,orders,createdAt", ...filtered.map((u) => [u.id, u.name, u.email, u.country, u.role, u.status, u.wallet, u.orders, u.createdAt].join(","))].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = "users.csv"; a.click(); URL.revokeObjectURL(url);
    toast.success("Exported CSV");
  };

  return (
    <div>
      <PageHeader title="Users" description="Search, filter, and manage every registered account." actions={<>
        <Button variant="outline" onClick={exportCsv}><Download className="mr-2 h-4 w-4" />Export CSV</Button>
      </>} />

      <Toolbar query={query} onQuery={(v) => { setQuery(v); setPage(1); }} placeholder="Search name or email...">
        <Select value={status} onValueChange={(v) => { setStatus(v); setPage(1); }}>
          <SelectTrigger className="w-36"><SelectValue placeholder="Status" /></SelectTrigger>
          <SelectContent><SelectItem value="all">All statuses</SelectItem><SelectItem value="active">Active</SelectItem><SelectItem value="suspended">Suspended</SelectItem><SelectItem value="pending">Pending</SelectItem></SelectContent>
        </Select>
        <Select value={role} onValueChange={(v) => { setRole(v); setPage(1); }}>
          <SelectTrigger className="w-36"><SelectValue placeholder="Role" /></SelectTrigger>
          <SelectContent><SelectItem value="all">All roles</SelectItem><SelectItem value="user">User</SelectItem><SelectItem value="reseller">Reseller</SelectItem><SelectItem value="admin">Admin</SelectItem></SelectContent>
        </Select>
      </Toolbar>

      <AdminTable rows={rows} columns={[
        { key: "name", header: "User", cell: (u) => <div><p className="font-medium">{u.name}</p><p className="text-xs text-muted-foreground">{u.email}</p></div> },
        { key: "country", header: "Country", cell: (u) => u.country },
        { key: "role", header: "Role", cell: (u) => <span className="capitalize text-xs">{u.role}</span> },
        { key: "status", header: "Status", cell: (u) => <StatusPill status={u.status} /> },
        { key: "wallet", header: "Wallet", cell: (u) => <span className="tabular-nums">{money(u.wallet)}</span> },
        { key: "orders", header: "Orders", cell: (u) => u.orders },
        { key: "ref", header: "Referral", cell: (u) => (u.referral ? <span className="text-xs text-muted-foreground">{u.referral}</span> : "—") },
        { key: "joined", header: "Joined", cell: (u) => <span className="text-xs">{dateShort(u.createdAt)}</span> },
        { key: "act", header: "", cell: (u) => (
          <div className="flex items-center gap-1">
            <UserEditDialog userId={u.id} initial={{ name: u.name, email: u.email, status: u.status, wallet: u.wallet, role: u.role }} />
            <DropdownMenu>
              <DropdownMenuTrigger asChild><Button variant="ghost" size="icon"><MoreHorizontal className="h-4 w-4" /></Button></DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem asChild><Link to={`/admin/user/${u.id}` as any}><Eye className="mr-2 h-4 w-4" />View</Link></DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        ) },
      ]} />

      <div className="mt-4 flex items-center justify-between text-sm">
        <span className="text-muted-foreground">Showing {rows.length} of {filtered.length}</span>
        <Pagination>
          <PaginationContent>
            <PaginationItem><PaginationPrevious onClick={() => setPage((p) => Math.max(1, p - 1))} /></PaginationItem>
            {Array.from({ length: pageCount }).map((_, i) => (
              <PaginationItem key={i}><PaginationLink isActive={page === i + 1} onClick={() => setPage(i + 1)}>{i + 1}</PaginationLink></PaginationItem>
            ))}
            <PaginationItem><PaginationNext onClick={() => setPage((p) => Math.min(pageCount, p + 1))} /></PaginationItem>
          </PaginationContent>
        </Pagination>
      </div>
    </div>
  );
}
