import { Link, useParams } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { ArrowLeft, ShoppingCart, Clock, TrendingUp, Globe2 } from "lucide-react";
import { money } from "@/utils/format";
import { api } from "@/lib/apiClient";
import type { Country, Service } from "@/types";

type LivePrice = { price: number; count: number };
type LivePriceMap = Record<string, LivePrice>;

export default function ServiceDetails() {
  const { serviceId } = useParams({ strict: false }) as { serviceId: string };

  const servicesQ = useQuery({ queryKey: ["catalog", "services"], queryFn: () => api.get<Service[]>("/api/catalog/services") });
  const countriesQ = useQuery({ queryKey: ["catalog", "countries"], queryFn: () => api.get<Country[]>("/api/catalog/countries") });
  const { data: LIVE = {} } = useQuery({
    queryKey: ["live-prices"],
    queryFn: () => api.get<LivePriceMap>("/api/providers/live-prices"),
    refetchInterval: 60_000,
    staleTime: 30_000,
  });

  if (servicesQ.isLoading || countriesQ.isLoading) {
    return <div className="mx-auto max-w-3xl px-4 py-20 text-center text-muted-foreground">Loading…</div>;
  }

  const s = (servicesQ.data ?? []).find((x) => x.id === serviceId);
  const countries = countriesQ.data ?? [];

  if (!s) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-20 text-center">
        <h1 className="text-2xl font-bold">Service not found</h1>
        <Button asChild className="mt-4">
          <Link to={"/services" as any}>Back</Link>
        </Button>
      </div>
    );
  }

  const lp = LIVE[s.id];
  const isLive = !!lp;
  const price = lp ? lp.price : Number(s.price);
  const stock = lp ? lp.count : 0;

  return (
    <div className="mx-auto max-w-7xl px-4 py-12">
      <Button asChild variant="ghost" size="sm" className="mb-4">
        <Link to={"/services" as any}>
          <ArrowLeft className="h-4 w-4 mr-1" /> All services
        </Link>
      </Button>
      <Card className="glass shadow-glow border-primary/10 mb-8">
        <CardContent className="p-8 grid gap-6 md:grid-cols-[auto_1fr_auto] items-center">
          <div className="text-7xl">{s.icon}</div>
          <div>
            <h1 className="text-3xl font-bold">{s.name}</h1>
            <Badge variant="secondary" className="mt-2">
              {s.category}
            </Badge>
            <p className="mt-3 text-muted-foreground max-w-2xl">
              Receive one-time verification codes for {s.name} across supported countries. Real-time
              delivery, refunds if the OTP never arrives.
            </p>
            {isLive && (
              <p className="mt-2 text-xs text-success flex items-center gap-1.5">
                <span className="inline-block h-1.5 w-1.5 rounded-full bg-success animate-pulse" />
                Live · {stock.toLocaleString()} numbers in stock right now
              </p>
            )}
          </div>
          <div className="text-right">
            <div className="text-sm text-muted-foreground">Starting from</div>
            <div className="text-3xl font-bold text-gradient-brand">{money(price)}</div>
            <Button asChild className="mt-3 gradient-brand">
              <Link to={"/dashboard/buy-number" as any}>
                <ShoppingCart className="h-4 w-4 mr-2" />
                Buy Number
              </Link>
            </Button>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-6 md:grid-cols-3 mb-8">
        <Card className="shadow-soft">
          <CardContent className="p-6">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Clock className="h-4 w-4" /> Avg delivery
            </div>
            <div className="mt-2 text-3xl font-bold">3.4s</div>
          </CardContent>
        </Card>
        <Card className="shadow-soft">
          <CardContent className="p-6">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <TrendingUp className="h-4 w-4" /> Success rate
            </div>
            <div className="mt-2 text-3xl font-bold">{s.successRate ?? 95}%</div>
            <Progress value={s.successRate ?? 95} className="mt-3" />
          </CardContent>
        </Card>
        <Card className="shadow-soft">
          <CardContent className="p-6">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Globe2 className="h-4 w-4" /> Coverage
            </div>
            <div className="mt-2 text-3xl font-bold">{countries.length}+ countries</div>
          </CardContent>
        </Card>
      </div>

      <div className="mb-4 flex items-end justify-between">
        <h2 className="text-xl font-semibold">Available in</h2>
        <span className="text-sm text-muted-foreground">Live stock — updates every 30s</span>
      </div>
      <div className="grid gap-3 grid-cols-2 sm:grid-cols-3 lg:grid-cols-4">
        {countries.map((c) => (
          <Link key={c.code} to={"/countries/$countryCode" as any} params={{ countryCode: c.code } as any}>
            <Card className="shadow-soft hover:shadow-glow transition-all h-full">
              <CardContent className="p-4 flex items-center gap-3">
                <div className="text-3xl">{c.flag ?? "🌐"}</div>
                <div className="min-w-0 flex-1">
                  <p className="font-medium truncate">{c.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {money(Number(c.priceFrom))} · {c.numbersAvailable.toLocaleString()} left
                  </p>
                </div>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
