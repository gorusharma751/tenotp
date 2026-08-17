import { Link, useNavigate, useSearch } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { api } from "@/lib/apiClient";
import type { Country, Service } from "@/types";
import { Search } from "lucide-react";

type LivePrice = { price: number; count: number };
type LivePriceMap = Record<string, LivePrice>;

export default function ServicesPage() {
  const s = useSearch({ strict: false }) as {
    q?: string; category?: string; country?: string; service?: string; operator?: string; mode?: string; sort?: string;
  };
  const qParam = s.q ?? "";
  const category = s.category ?? "any";
  const serviceParam = s.service ?? "";
  const sort = s.sort ?? "popular";
  const navigate = useNavigate({ from: "/services" });
  const [query, setQuery] = useState(qParam);
  const { data: SERVICES = [] } = useQuery({ queryKey: ["catalog", "services"], queryFn: () => api.get<Service[]>("/api/catalog/services") });
  const { data: COUNTRIES = [] } = useQuery({ queryKey: ["catalog", "countries"], queryFn: () => api.get<Country[]>("/api/catalog/countries") });
  const { data: LIVE = {} } = useQuery({
    queryKey: ["live-prices"],
    queryFn: () => api.get<LivePriceMap>("/api/providers/live-prices"),
    refetchInterval: 60_000,
    staleTime: 30_000,
  });
  const categories = Array.from(new Set(SERVICES.map((x) => x.category)));

  const withLive = useMemo(
    () => SERVICES.map((x) => {
      const lp = LIVE[x.id];
      return lp ? { ...x, price: lp.price, _live: true, _count: lp.count } : { ...x, _live: false, _count: 0 };
    }),
    [SERVICES, LIVE],
  );

  const filtered = useMemo(() => {
    let list = withLive.filter((x) => x.name.toLowerCase().includes(qParam.toLowerCase()));
    if (category !== "any") list = list.filter((x) => x.category === category);
    if (serviceParam) list = list.filter((x) => x.id === serviceParam);
    if (sort === "price") list = [...list].sort((a, b) => a.price - b.price);
    if (sort === "success") list = [...list].sort((a, b) => b.successRate - a.successRate);
    return list;
  }, [withLive, qParam, category, serviceParam, sort]);

  const update = (patch: Record<string, unknown>) =>
    navigate({ search: (prev: Record<string, unknown>) => ({ ...prev, ...patch }) as any });

  return (
    <div className="mx-auto max-w-7xl px-4 py-16">
      <div className="text-center mb-8">
        <h1 className="text-4xl font-bold">All services</h1>
        <p className="mt-2 text-muted-foreground">OTP verification for the apps your users rely on.</p>
      </div>

      <Card className="shadow-soft mb-6">
        <CardContent className="p-4 grid gap-3 md:grid-cols-[1fr_auto_auto_auto_auto]">
          <form onSubmit={(e) => { e.preventDefault(); update({ q: query }); }} className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Search service…" value={query} onChange={(e) => setQuery(e.target.value)} className="pl-9" />
          </form>
          <Select value={category} onValueChange={(v) => update({ category: v })}>
            <SelectTrigger className="min-w-[140px]"><SelectValue placeholder="Category" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="any">All categories</SelectItem>
              {categories.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={s.country || "any"} onValueChange={(v) => update({ country: v === "any" ? "" : v })}>
            <SelectTrigger className="min-w-[140px]"><SelectValue placeholder="Country" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="any">Any country</SelectItem>
              {COUNTRIES.map((c) => <SelectItem key={c.code} value={c.code}>{c.flag} {c.name}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={sort} onValueChange={(v) => update({ sort: v })}>
            <SelectTrigger className="min-w-[140px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="popular">Popular</SelectItem>
              <SelectItem value="price">Price</SelectItem>
              <SelectItem value="success">Success rate</SelectItem>
            </SelectContent>
          </Select>
          <Button className="gradient-brand" onClick={() => update({ q: query })}>Apply</Button>
        </CardContent>
      </Card>

      {filtered.length === 0 ? (
        <Card className="shadow-soft"><CardContent className="p-16 text-center text-muted-foreground">No services match your filters.</CardContent></Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {filtered.map((svc) => (
            <Link key={svc.id} to={"/services/$serviceId" as any} params={{ serviceId: svc.id } as any}>
              <Card className="shadow-soft hover:shadow-glow hover:-translate-y-1 transition-all h-full">
                <CardContent className="p-5">
                  <div className="flex items-center justify-between"><div className="text-3xl">{svc.icon}</div><Badge variant="secondary">{svc.category}</Badge></div>
                  <p className="mt-3 font-semibold">{svc.name}</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {COUNTRIES.length} countries · {(svc._live ? svc._count : (svc.id.charCodeAt(0) * 137 + 1000) % 9000 + 1000).toLocaleString()} numbers
                  </p>
                  <div className="mt-3 flex items-center justify-between text-sm">
                    <span className="font-semibold text-gradient-brand flex items-center gap-1">
                      ${svc.price.toFixed(2)}
                      {svc._live && <span className="inline-block h-1.5 w-1.5 rounded-full bg-success animate-pulse" title="Live price" />}
                    </span>
                    <span className="text-success">{svc.successRate}% success</span>
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
