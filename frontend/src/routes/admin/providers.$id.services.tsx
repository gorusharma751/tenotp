import { useParams, Link } from "@tanstack/react-router";
import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { ArrowLeft, RefreshCw, Search } from "lucide-react";
import { PageHeader } from "@/components/common/PageHeader";
import { useProviderServices, useProviderCategoriesList, useProviderModuleActions } from "@/hooks/useProviderModule";
import { money } from "@/utils/format";
import { ProviderSubNav } from "@/components/providers/ProviderSubNav";

function ProviderServicesPage() {
  const { id } = useParams({ strict: false }) as { id: string };
  const [q, setQ] = useState("");
  const [category, setCategory] = useState("all");
  const [sort, setSort] = useState<"name" | "cost" | "recent">("name");
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const pageSize = 25;
  const services = useProviderServices(id, { q, category, sort, page, pageSize });
  const cats = useProviderCategoriesList(id);
  const actions = useProviderModuleActions(id);
  const total = services.data?.total ?? 0;
  const pages = Math.max(1, Math.ceil(total / pageSize));

  return (
    <div>
      <Button variant="ghost" size="sm" asChild className="mb-3">
        <Link to={"/gourav-ankit-adi/providers/$id" as any} params={{ id } as any}><ArrowLeft className="h-4 w-4 mr-1" />Provider</Link>
      </Button>
      <PageHeader title="External service catalog" description="Imported services from this provider. Map to internal services below." actions={
        <Button size="sm" onClick={() => actions.syncServices.mutate()} disabled={actions.syncServices.isPending}>
          <RefreshCw className="h-4 w-4 mr-1" />{actions.syncServices.isPending ? "Syncing…" : "Sync now"}
        </Button>
      } />
      <ProviderSubNav id={id} />
      <Card className="shadow-soft">
        <CardContent className="p-4 space-y-4">
          <div className="grid gap-3 md:grid-cols-4">
            <div className="relative md:col-span-2">
              <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Search external services…" value={q} onChange={(e) => { setQ(e.target.value); setPage(1); }} className="pl-9" />
            </div>
            <Select value={category} onValueChange={(v) => { setCategory(v); setPage(1); }}>
              <SelectTrigger><SelectValue placeholder="Category" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All categories</SelectItem>
                {(cats.data ?? []).map((c) => <SelectItem key={c.id} value={c.external_id}>{c.external_name}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={sort} onValueChange={(v: any) => setSort(v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="name">Sort by name</SelectItem>
                <SelectItem value="cost">Sort by cost</SelectItem>
                <SelectItem value="recent">Recently seen</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {services.isLoading ? <Skeleton className="h-64" /> : services.isError ? (
            <div className="p-10 text-center text-destructive">Failed to load services.</div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader><TableRow>
                  <TableHead className="w-10"></TableHead>
                  <TableHead>External name</TableHead>
                  <TableHead>External ID</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead>Region</TableHead>
                  <TableHead className="text-right">Base cost</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow></TableHeader>
                <TableBody>
                  {(services.data?.items ?? []).map((row) => (
                    <TableRow key={row.id}>
                      <TableCell><Checkbox checked={!!selected[row.id]} onCheckedChange={(v) => setSelected((s) => ({ ...s, [row.id]: !!v }))} /></TableCell>
                      <TableCell className="font-medium">{row.external_name}</TableCell>
                      <TableCell className="font-mono text-xs">{row.external_id}</TableCell>
                      <TableCell><Badge variant="secondary">{row.external_category ?? "—"}</Badge></TableCell>
                      <TableCell className="text-xs">{row.region ?? "—"}</TableCell>
                      <TableCell className="text-right tabular-nums">{money(Number(row.base_cost) * 100)}</TableCell>
                      <TableCell><Badge variant={row.active ? "default" : "outline"}>{row.active ? "active" : "inactive"}</Badge></TableCell>
                    </TableRow>
                  ))}
                  {(services.data?.items ?? []).length === 0 && (
                    <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-10">No services imported yet. Click "Sync now" to fetch from provider.</TableCell></TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          )}

          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Selected: {Object.values(selected).filter(Boolean).length} · Total: {total}</span>
            <div className="flex items-center gap-2">
              <Button size="sm" variant="outline" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>Prev</Button>
              <span className="text-xs">{page} / {pages}</span>
              <Button size="sm" variant="outline" disabled={page >= pages} onClick={() => setPage((p) => p + 1)}>Next</Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export default ProviderServicesPage;
