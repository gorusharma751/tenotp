import { Link } from "@tanstack/react-router";
import { PageHeader } from "@/components/common/PageHeader";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/apiClient";
import { Heart, Signal } from "lucide-react";

interface Country { code: string; name: string; flag: string; priceFrom: number }
interface Service { id: string; name: string; icon: string; category: string; price: number; successRate: number }

const OPERATORS = ["Virtual"];

export default function Favorites() {
  const { data: COUNTRIES = [] } = useQuery({ queryKey: ["catalog", "countries"], queryFn: () => api.get<Country[]>("/api/catalog/countries") });
  const { data: SERVICES = [] } = useQuery({ queryKey: ["catalog", "services"], queryFn: () => api.get<Service[]>("/api/catalog/services") });
  return (
    <div>
      <PageHeader title="Favorites" description="Quick access to your most-used items." />
      <Tabs defaultValue="services">
        <TabsList><TabsTrigger value="services">Services</TabsTrigger><TabsTrigger value="countries">Countries</TabsTrigger><TabsTrigger value="operators">Operators</TabsTrigger></TabsList>
        <TabsContent value="services" className="mt-4">
          <div className="grid gap-3 grid-cols-2 sm:grid-cols-3 lg:grid-cols-4">
            {SERVICES.slice(0, 6).map((s) => (
              <Card key={s.id} className="shadow-soft"><CardContent className="p-5">
                <div className="flex items-center justify-between"><div className="text-3xl">{s.icon}</div><Heart className="h-4 w-4 text-destructive fill-current" /></div>
                <p className="mt-2 font-medium">{s.name}</p>
                <Button asChild size="sm" variant="outline" className="mt-3 w-full"><Link to="/dashboard/buy-number">Open</Link></Button>
              </CardContent></Card>
            ))}
            {SERVICES.length === 0 && <p className="text-sm text-muted-foreground col-span-full py-8 text-center">No services yet.</p>}
          </div>
        </TabsContent>
        <TabsContent value="countries" className="mt-4">
          <div className="grid gap-3 grid-cols-2 sm:grid-cols-3 lg:grid-cols-4">
            {COUNTRIES.slice(0, 6).map((c) => (
              <Card key={c.code} className="shadow-soft"><CardContent className="p-5 flex items-center gap-3">
                <div className="text-3xl">{c.flag}</div>
                <div className="min-w-0 flex-1"><p className="font-medium truncate">{c.name}</p><p className="text-xs text-muted-foreground">from ₹{c.priceFrom.toFixed(2)}</p></div>
                <Heart className="h-4 w-4 text-destructive fill-current" />
              </CardContent></Card>
            ))}
            {COUNTRIES.length === 0 && <p className="text-sm text-muted-foreground col-span-full py-8 text-center">No countries yet.</p>}
          </div>
        </TabsContent>
        <TabsContent value="operators" className="mt-4">
          <div className="grid gap-3 grid-cols-2 sm:grid-cols-3 lg:grid-cols-4">
            {OPERATORS.map((o) => (
              <Card key={o} className="shadow-soft"><CardContent className="p-5 flex items-center gap-3">
                <div className="grid h-10 w-10 place-items-center rounded-lg bg-primary/10 text-primary"><Signal className="h-5 w-5" /></div>
                <div className="flex-1"><p className="font-medium">{o}</p><p className="text-xs text-muted-foreground">Preferred carrier</p></div>
                <Heart className="h-4 w-4 text-destructive fill-current" />
              </CardContent></Card>
            ))}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
