import { Link, useParams } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ArrowLeft, Signal, ShoppingCart } from "lucide-react";
import { money } from "@/utils/format";
import { api } from "@/lib/apiClient";
import type { Country, Service } from "@/types";

export default function CountryDetails() {
  const { countryCode } = useParams({ strict: false }) as { countryCode: string };

  const countriesQ = useQuery({ queryKey: ["catalog", "countries"], queryFn: () => api.get<Country[]>("/api/catalog/countries") });
  const servicesQ = useQuery({ queryKey: ["catalog", "services"], queryFn: () => api.get<Service[]>("/api/catalog/services") });

  if (countriesQ.isLoading || servicesQ.isLoading) {
    return <div className="mx-auto max-w-3xl px-4 py-20 text-center text-muted-foreground">Loading…</div>;
  }

  const c = (countriesQ.data ?? []).find((x) => x.code.toLowerCase() === countryCode?.toLowerCase());
  const services = servicesQ.data ?? [];

  if (!c) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-20 text-center">
        <h1 className="text-2xl font-bold">Country not found</h1>
        <Button asChild className="mt-4">
          <Link to={"/countries" as any}>Back to countries</Link>
        </Button>
      </div>
    );
  }

  const operators = ["Virtual"];

  return (
    <div className="mx-auto max-w-7xl px-4 py-12">
      <Button asChild variant="ghost" size="sm" className="mb-4">
        <Link to={"/countries" as any}>
          <ArrowLeft className="h-4 w-4 mr-1" /> All countries
        </Link>
      </Button>
      <Card className="glass shadow-glow border-primary/10 mb-8">
        <CardContent className="p-8 grid gap-6 md:grid-cols-[auto_1fr_auto] items-center">
          <div className="text-7xl">{c.flag ?? "🌐"}</div>
          <div>
            <h1 className="text-3xl font-bold">{c.name}</h1>
            <p className="mt-1 text-muted-foreground">
              Country code {c.code} · {Number(c.numbersAvailable).toLocaleString()} numbers in
              stock
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              {operators.map((o) => (
                <Badge key={o} variant="secondary">
                  <Signal className="h-3 w-3 mr-1" />
                  {o}
                </Badge>
              ))}
            </div>
          </div>
          <div className="text-right">
            <div className="text-sm text-muted-foreground">Starting from</div>
            <div className="text-3xl font-bold text-gradient-brand">
              {money(Number(c.priceFrom))}
            </div>
            <Button asChild className="mt-3 gradient-brand">
              <Link to={"/dashboard/buy-number" as any}>
                <ShoppingCart className="h-4 w-4 mr-2" />
                Buy Number
              </Link>
            </Button>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-3 mb-8">
        {[
          { label: "Numbers available", value: Number(c.numbersAvailable).toLocaleString() },
          { label: "Supported services", value: `${services.length}+` },
          { label: "Avg delivery", value: "3.4s" },
        ].map((s) => (
          <Card key={s.label} className="shadow-soft">
            <CardContent className="p-6">
              <div className="text-sm text-muted-foreground">{s.label}</div>
              <div className="mt-2 text-3xl font-bold">{s.value}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card className="shadow-soft overflow-hidden">
        <div className="px-6 py-4 border-b">
          <h2 className="font-semibold">Supported services & pricing</h2>
        </div>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Service</TableHead>
              <TableHead>Category</TableHead>
              <TableHead>Price</TableHead>
              <TableHead>Success</TableHead>
              <TableHead className="text-right">Buy</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {services.map((s) => (
              <TableRow key={s.id}>
                <TableCell className="font-medium">
                  <span className="mr-2 text-lg">{s.icon ?? "🔌"}</span>
                  {s.name}
                </TableCell>
                <TableCell>
                  <Badge variant="secondary">{s.category ?? "—"}</Badge>
                </TableCell>
                <TableCell>{money(Number(s.price))}</TableCell>
                <TableCell className="text-success">{s.successRate ?? 95}%</TableCell>
                <TableCell className="text-right">
                  <Button asChild size="sm">
                    <Link to={"/dashboard/buy-number" as any}>Buy</Link>
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}
