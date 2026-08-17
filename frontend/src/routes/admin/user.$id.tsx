import { Link, useParams } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { PageHeader } from "@/components/common/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { AdminTable, StatusPill } from "@/components/admin/AdminTable";
import { ArrowLeft, Mail, Globe2, Wallet, Package, ShieldCheck, Activity } from "lucide-react";
import { api } from "@/lib/apiClient";
import { money, dateShort, dateTime, timeAgo } from "@/utils/format";
import type { AdminUser, AdminOrder } from "@/types";

export default function Detail() {
  const { id } = useParams({ strict: false }) as { id: string };
  const u = useQuery({ queryKey: ["admin", "user", id], queryFn: () => api.get<AdminUser>(`/api/admin/users/${id}`) });
  const orders = useQuery({ queryKey: ["admin", "orders"], queryFn: () => api.get<AdminOrder[]>("/api/admin/orders") });
  const user = u.data;

  return (
    <div>
      <Button asChild variant="ghost" size="sm" className="mb-4"><Link to={"/admin/users" as any}><ArrowLeft className="mr-1 h-4 w-4" />Back to users</Link></Button>
      <PageHeader title={user?.name ?? `User #${id}`} description={user?.email ?? ""} />

      <div className="grid gap-4 lg:grid-cols-4">
        <Card className="shadow-soft lg:col-span-1"><CardContent className="p-6">
          <div className="flex flex-col items-center text-center">
            <Avatar className="h-20 w-20"><AvatarFallback className="text-2xl">{user?.name?.[0] ?? "U"}</AvatarFallback></Avatar>
            <p className="mt-3 font-semibold">{user?.name}</p>
            <p className="text-xs text-muted-foreground">{user?.email}</p>
            <div className="mt-3"><StatusPill status={user?.status ?? "active"} /></div>
          </div>
          <div className="mt-6 space-y-2 text-sm">
            <div className="flex items-center justify-between"><span className="text-muted-foreground flex items-center gap-2"><Globe2 className="h-4 w-4" />Country</span><span>{user?.country}</span></div>
            <div className="flex items-center justify-between"><span className="text-muted-foreground flex items-center gap-2"><ShieldCheck className="h-4 w-4" />Role</span><span className="capitalize">{user?.role}</span></div>
            <div className="flex items-center justify-between"><span className="text-muted-foreground flex items-center gap-2"><Wallet className="h-4 w-4" />Wallet</span><span>{money(user?.wallet ?? 0)}</span></div>
            <div className="flex items-center justify-between"><span className="text-muted-foreground flex items-center gap-2"><Package className="h-4 w-4" />Orders</span><span>{user?.orders}</span></div>
            <div className="flex items-center justify-between"><span className="text-muted-foreground flex items-center gap-2"><Mail className="h-4 w-4" />Joined</span><span>{user?.createdAt ? dateShort(user.createdAt) : "—"}</span></div>
            <div className="flex items-center justify-between"><span className="text-muted-foreground flex items-center gap-2"><Activity className="h-4 w-4" />Last login</span><span>{user?.lastLogin ? timeAgo(user.lastLogin) : "—"}</span></div>
          </div>
        </CardContent></Card>

        <div className="lg:col-span-3">
          <Tabs defaultValue="orders">
            <TabsList className="mb-4">
              <TabsTrigger value="orders">Orders</TabsTrigger>
              <TabsTrigger value="wallet">Wallet</TabsTrigger>
              <TabsTrigger value="tx">Transactions</TabsTrigger>
              <TabsTrigger value="api">API</TabsTrigger>
              <TabsTrigger value="timeline">Activity</TabsTrigger>
              <TabsTrigger value="referrals">Referrals</TabsTrigger>
              <TabsTrigger value="tickets">Tickets</TabsTrigger>
            </TabsList>
            <TabsContent value="orders">
              <AdminTable rows={(orders.data ?? []).slice(0, 8)} columns={[
                { key: "id", header: "Order", cell: (o) => <span className="font-mono text-xs">{o.id}</span> },
                { key: "s", header: "Service", cell: (o) => o.service },
                { key: "c", header: "Country", cell: (o) => o.country },
                { key: "st", header: "Status", cell: (o) => <StatusPill status={o.status} /> },
                { key: "p", header: "Price", cell: (o) => money(o.price) },
                { key: "d", header: "Date", cell: (o) => dateTime(o.createdAt) },
              ]} />
            </TabsContent>
            <TabsContent value="wallet"><Card className="shadow-soft"><CardHeader><CardTitle>Current balance</CardTitle></CardHeader><CardContent className="text-3xl font-bold">{money(user?.wallet ?? 0)}</CardContent></Card></TabsContent>
            <TabsContent value="tx"><Card className="shadow-soft"><CardContent className="p-6 text-sm text-muted-foreground">Transactions feed — hydrated from API.</CardContent></Card></TabsContent>
            <TabsContent value="api"><Card className="shadow-soft"><CardContent className="p-6 text-sm text-muted-foreground">API usage per hour / day / month.</CardContent></Card></TabsContent>
            <TabsContent value="timeline"><Card className="shadow-soft"><CardContent className="p-6 space-y-3 text-sm">
              {["Logged in from 192.168.1.14", "Purchased WhatsApp OTP", "Deposit received via Card", "Refund requested for ord_1012", "Password changed"].map((e, i) => (
                <div key={i} className="flex items-center gap-3"><span className="h-2 w-2 rounded-full bg-primary" /><span>{e}</span><span className="ml-auto text-xs text-muted-foreground">{i + 1}h ago</span></div>
              ))}
            </CardContent></Card></TabsContent>
            <TabsContent value="referrals"><Card className="shadow-soft"><CardContent className="p-6 text-sm text-muted-foreground">Referral activity for this user.</CardContent></Card></TabsContent>
            <TabsContent value="tickets"><Card className="shadow-soft"><CardContent className="p-6 text-sm text-muted-foreground">No open tickets.</CardContent></Card></TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
}
