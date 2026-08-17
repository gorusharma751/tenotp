import { Link } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { PageHeader } from "@/components/common/PageHeader";
import { AdminTable, StatusPill } from "@/components/admin/AdminTable";
import { Toolbar } from "@/components/admin/Toolbar";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { api } from "@/lib/apiClient";
import { money, dateTime } from "@/utils/format";
import { Eye, MoreHorizontal } from "lucide-react";
import type { AdminOrder } from "@/types";

export default function AdminOrdersPage() {
  const q = useQuery({ queryKey: ["admin", "orders"], queryFn: () => api.get<AdminOrder[]>("/api/admin/orders") });
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("all");
  const rows = (q.data ?? []).filter((o) =>
    (status === "all" || o.status === status) &&
    (query === "" || o.number.includes(query) || o.user.toLowerCase().includes(query.toLowerCase()) || o.service.toLowerCase().includes(query.toLowerCase()))
  );
  return (
    <div>
      <PageHeader title="Orders" description="Every OTP purchase, filterable by status, service, country, and user." />
      <Toolbar query={query} onQuery={setQuery} placeholder="Search order, user, service...">
        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
          <SelectContent><SelectItem value="all">All</SelectItem><SelectItem value="received">Received</SelectItem><SelectItem value="pending">Pending</SelectItem><SelectItem value="expired">Expired</SelectItem><SelectItem value="cancelled">Cancelled</SelectItem></SelectContent>
        </Select>
      </Toolbar>
      <AdminTable rows={rows} columns={[
        { key: "id", header: "Order", cell: (o) => <span className="font-mono text-xs">{o.id}</span> },
        { key: "u", header: "User", cell: (o) => <Link to={"/gourav-ankit-adi/user/$id" as any} params={{ id: o.userId } as any} className="hover:underline">{o.user}</Link> },
        { key: "s", header: "Service", cell: (o) => o.service },
        { key: "c", header: "Country", cell: (o) => o.country },
        { key: "op", header: "Operator", cell: (o) => <span className="text-xs">{o.operator}</span> },
        { key: "n", header: "Number", cell: (o) => <span className="font-mono text-xs">{o.number}</span> },
        { key: "p", header: "Price", cell: (o) => money(o.price) },
        { key: "st", header: "Status", cell: (o) => <StatusPill status={o.status} /> },
        { key: "d", header: "Date", cell: (o) => <span className="text-xs">{dateTime(o.createdAt)}</span> },
        { key: "act", header: "", cell: (o) => (
          <DropdownMenu>
            <DropdownMenuTrigger asChild><Button variant="ghost" size="icon"><MoreHorizontal className="h-4 w-4" /></Button></DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem asChild><Link to={"/gourav-ankit-adi/order/$id" as any} params={{ id: o.id } as any}><Eye className="mr-2 h-4 w-4" />View</Link></DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )},
      ]} />
    </div>
  );
}
