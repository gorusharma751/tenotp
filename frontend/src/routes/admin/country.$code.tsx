import { Link, useParams } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { PageHeader } from "@/components/common/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { AdminTable, StatusPill } from "@/components/admin/AdminTable";
import { ArrowLeft } from "lucide-react";
import { api } from "@/lib/apiClient";
import { money } from "@/utils/format";
import type { AdminCountry, AdminService, NumberInventoryItem } from "@/types";

export default function AdminCountryDetail() {
  const { code } = useParams({ strict: false }) as { code: string };
  const c = useQuery({
    queryKey: ["admin", "country", code],
    queryFn: () => api.get<AdminCountry | null>(`/api/admin/countries/${code}`),
  });
  const nums = useQuery({
    queryKey: ["admin", "numbers"],
    queryFn: () => api.get<NumberInventoryItem[]>("/api/admin/numbers"),
  });
  const services = useQuery({
    queryKey: ["admin", "services"],
    queryFn: () => api.get<AdminService[]>("/api/admin/services"),
  });
  const country = c.data;
  const inventory = (nums.data ?? []).filter((n) => n.countryCode === code);

  return (
    <div>
      <Button asChild variant="ghost" size="sm" className="mb-4">
        <Link to={"/admin/countries" as any}><ArrowLeft className="mr-1 h-4 w-4" />Back to countries</Link>
      </Button>
      <PageHeader title={country ? `${country.flag} ${country.name}` : code} description={`Code ${code} · ${country?.operators ?? 0} operators`} />

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="shadow-soft"><CardHeader><CardTitle>Overview</CardTitle></CardHeader><CardContent className="space-y-2 text-sm">
          <div className="flex justify-between"><span className="text-muted-foreground">Stock</span><span>{country?.numbersAvailable.toLocaleString()}</span></div>
          <div className="flex justify-between"><span className="text-muted-foreground">Price from</span><span>{money(country?.priceFrom ?? 0)}</span></div>
          <div className="flex justify-between"><span className="text-muted-foreground">Priority</span><span>#{country?.priority}</span></div>
          <div className="flex justify-between"><span className="text-muted-foreground">Status</span><StatusPill status={country?.enabled ? "active" : "suspended"} /></div>
        </CardContent></Card>

        <Card className="shadow-soft lg:col-span-2">
          <CardHeader><CardTitle>Operators</CardTitle></CardHeader>
          <CardContent className="grid gap-2 sm:grid-cols-2">
            {["Virtual"].map((op, i) => (
              <div key={op} className="flex items-center justify-between rounded-lg border p-3 text-sm">
                <div><p className="font-medium">{op}</p><p className="text-xs text-muted-foreground">Priority #{i + 1}</p></div>
                <StatusPill status="active" />
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      <div className="mt-6">
        <Tabs defaultValue="services">
          <TabsList><TabsTrigger value="services">Supported services</TabsTrigger><TabsTrigger value="inv">Inventory</TabsTrigger><TabsTrigger value="rules">Price rules</TabsTrigger></TabsList>
          <TabsContent value="services" className="mt-4">
            <AdminTable rows={(services.data ?? []).slice(0, 8)} columns={[
              { key: "n", header: "Service", cell: (s) => <span>{s.icon} {s.name}</span> },
              { key: "cat", header: "Category", cell: (s) => s.category },
              { key: "p", header: "Price", cell: (s) => money(s.price) },
              { key: "sr", header: "Success", cell: (s) => `${s.successRate}%` },
              { key: "st", header: "Enabled", cell: (s) => <StatusPill status={s.enabled ? "active" : "suspended"} /> },
            ]} />
          </TabsContent>
          <TabsContent value="inv" className="mt-4">
            <AdminTable rows={inventory} empty="No numbers in stock for this country" columns={[
              { key: "num", header: "Number", cell: (n) => <span className="font-mono">{n.number}</span> },
              { key: "svc", header: "Service", cell: (n) => n.service },
              { key: "op", header: "Operator", cell: (n) => n.operator },
              { key: "st", header: "Status", cell: (n) => <StatusPill status={n.status} /> },
            ]} />
          </TabsContent>
          <TabsContent value="rules" className="mt-4">
            <Card className="shadow-soft"><CardContent className="p-6 text-sm text-muted-foreground">Custom price rules per service and operator. Backend integration will hydrate.</CardContent></Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
