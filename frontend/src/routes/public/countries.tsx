import { Link, useNavigate, useSearch } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Pagination, PaginationContent, PaginationItem, PaginationLink, PaginationNext, PaginationPrevious } from "@/components/ui/pagination";
import { api } from "@/lib/apiClient";
import type { Country } from "@/types";
import { Search, LayoutGrid, List } from "lucide-react";

const PAGE_SIZE = 8;

export default function CountriesPage() {
  const search = useSearch({ strict: false }) as { q?: string; sort?: string; view?: string; page?: number };
  const q = search.q ?? "";
  const sort = search.sort ?? "name";
  const view = search.view ?? "grid";
  const page = search.page ?? 1;
  const navigate = useNavigate({ from: "/countries" });
  const [query, setQuery] = useState(q);
  const { data: COUNTRIES = [] } = useQuery({ queryKey: ["catalog", "countries"], queryFn: () => api.get<Country[]>("/api/catalog/countries") });

  const filtered = useMemo(() => {
    const list = COUNTRIES.filter((c) => c.name.toLowerCase().includes(q.toLowerCase()));
    if (sort === "price") return [...list].sort((a, b) => a.priceFrom - b.priceFrom);
    if (sort === "stock") return [...list].sort((a, b) => b.numbersAvailable - a.numbersAvailable);
    return [...list].sort((a, b) => a.name.localeCompare(b.name));
  }, [COUNTRIES, q, sort]);

  const pages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(Math.max(1, page), pages);
  const pageItems = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  const update = (patch: Record<string, unknown>) =>
    navigate({ search: (prev: Record<string, unknown>) => ({ ...prev, ...patch, page: patch.page ?? 1 }) as any });

  return (
    <div className="mx-auto max-w-7xl px-4 py-16">
      <div className="text-center mb-8">
        <h1 className="text-4xl font-bold">Countries</h1>
        <p className="mt-2 text-muted-foreground">Real carrier numbers in every major market.</p>
      </div>

      <Card className="shadow-soft mb-6">
        <CardContent className="p-4 grid gap-3 md:grid-cols-[1fr_auto_auto_auto]">
          <form onSubmit={(e) => { e.preventDefault(); update({ q: query }); }} className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Search country…" value={query} onChange={(e) => setQuery(e.target.value)} className="pl-9" />
          </form>
          <Select value={sort} onValueChange={(v) => update({ sort: v })}>
            <SelectTrigger className="min-w-[140px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="name">Sort: Name</SelectItem>
              <SelectItem value="price">Sort: Price</SelectItem>
              <SelectItem value="stock">Sort: Stock</SelectItem>
            </SelectContent>
          </Select>
          <Tabs value={view} onValueChange={(v) => update({ view: v })}>
            <TabsList>
              <TabsTrigger value="grid"><LayoutGrid className="h-4 w-4" /></TabsTrigger>
              <TabsTrigger value="table"><List className="h-4 w-4" /></TabsTrigger>
            </TabsList>
          </Tabs>
          <Button className="gradient-brand" onClick={() => update({ q: query })}>Apply</Button>
        </CardContent>
      </Card>

      {view === "grid" ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {pageItems.map((c) => (
            <Link key={c.code} to={"/countries/$countryCode" as any} params={{ countryCode: c.code } as any}>
              <Card className="shadow-soft hover:shadow-glow transition-all hover:-translate-y-1 h-full">
                <CardContent className="p-5 flex items-center gap-4">
                  <div className="text-4xl">{c.flag}</div>
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold truncate">{c.name}</p>
                    <p className="text-xs text-muted-foreground">{c.numbersAvailable.toLocaleString()} numbers</p>
                    <p className="text-xs text-muted-foreground">from ${c.priceFrom.toFixed(2)}</p>
                  </div>
                  <Badge variant="secondary">Open</Badge>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      ) : (
        <Card className="shadow-soft overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Country</TableHead>
                <TableHead>Numbers</TableHead>
                <TableHead>Price from</TableHead>
                <TableHead className="text-right">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {pageItems.map((c) => (
                <TableRow key={c.code}>
                  <TableCell className="font-medium"><span className="mr-2 text-lg">{c.flag}</span>{c.name}</TableCell>
                  <TableCell>{c.numbersAvailable.toLocaleString()}</TableCell>
                  <TableCell>${c.priceFrom.toFixed(2)}</TableCell>
                  <TableCell className="text-right">
                    <Button asChild size="sm" variant="outline"><Link to={"/countries/$countryCode" as any} params={{ countryCode: c.code } as any}>Open</Link></Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}

      {pages > 1 && (
        <Pagination className="mt-8">
          <PaginationContent>
            <PaginationItem><PaginationPrevious href="#" onClick={(e) => { e.preventDefault(); update({ page: Math.max(1, safePage - 1) }); }} /></PaginationItem>
            {Array.from({ length: pages }).map((_, i) => (
              <PaginationItem key={i}><PaginationLink href="#" isActive={i + 1 === safePage} onClick={(e) => { e.preventDefault(); update({ page: i + 1 }); }}>{i + 1}</PaginationLink></PaginationItem>
            ))}
            <PaginationItem><PaginationNext href="#" onClick={(e) => { e.preventDefault(); update({ page: Math.min(pages, safePage + 1) }); }} /></PaginationItem>
          </PaginationContent>
        </Pagination>
      )}
    </div>
  );
}
