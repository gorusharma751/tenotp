import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { PageHeader } from "@/components/common/PageHeader";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Search, Plus, Trash2 } from "lucide-react";
import { api } from "@/lib/apiClient";
import { toast } from "sonner";

interface SellerService {
  id: string; service: string; country: string; price: number | null; status: "active" | "disabled";
  availability: "available" | "busy" | "offline"; stock: number; completedRequests: number; failedRequests: number; successRate: number | null;
}

// Country picked ONCE, then the seller ADDS whichever services they offer
// there by searching the platform's real catalog (same one Buy Number
// uses) — instead of rendering the entire catalog (thousands of rows) up
// front, which is what made this page slow. Only what the seller has
// actually added ever renders.
export default function SellerServices() {
  const qc = useQueryClient();
  const catalog = useQuery({ queryKey: ["seller", "catalog"], queryFn: () => api.get<{ countries: string[]; services: string[] }>("/api/manual-providers/seller/catalog") });
  const [country, setCountry] = useState("");
  const existing = useQuery({
    queryKey: ["seller", "services"],
    queryFn: () => api.get<SellerService[]>("/api/manual-providers/seller/services"),
  });

  const [search, setSearch] = useState("");
  const matches = useMemo(() => {
    if (search.trim().length < 2 || !catalog.data) return [];
    const q = search.trim().toLowerCase();
    return catalog.data.services.filter((s) => s.toLowerCase().includes(q)).slice(0, 20);
  }, [search, catalog.data]);

  const myServicesForCountry = (existing.data ?? []).filter((s) => s.country === country && s.status === "active");
  const activeCountries = Array.from(new Set((existing.data ?? []).filter((s) => s.status === "active").map((s) => s.country)));

  const addM = useMutation({
    mutationFn: (v: { service: string; price: string; stock: string }) =>
      api.post<SellerService>("/api/manual-providers/seller/services", {
        service: v.service, country, price: v.price.trim() === "" ? null : Number(v.price), stock: Number(v.stock) || 1,
      }),
    onSuccess: () => { toast.success("Added"); setSearch(""); qc.invalidateQueries({ queryKey: ["seller", "services"] }); },
    onError: (e: any) => toast.error(e?.message || "Could not add"),
  });

  const updateM = useMutation({
    mutationFn: (v: { id: string; patch: Record<string, unknown> }) => api.patch(`/api/manual-providers/seller/services/${v.id}`, v.patch),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["seller", "services"] }),
    onError: (e: any) => toast.error(e?.message || "Could not update"),
  });

  return (
    <div>
      <PageHeader title="My services" description="Pick a country once, then add whichever services you offer there — search the catalog, set your price and how many numbers you have." />

      <Card className="shadow-soft mb-4">
        <CardContent className="p-4 grid gap-3 sm:grid-cols-[280px_1fr] items-end">
          <div className="grid gap-1.5">
            <Label>Country</Label>
            <Select value={country} onValueChange={setCountry}>
              <SelectTrigger><SelectValue placeholder="Pick a country" /></SelectTrigger>
              <SelectContent>{(catalog.data?.countries ?? []).map((c) => <SelectItem key={c} value={c}>{c}{activeCountries.includes(c) ? " ✓" : ""}</SelectItem>)}</SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {country && (
        <>
          <Card className="shadow-soft mb-4">
            <CardContent className="p-4">
              <Label className="mb-1.5 block">Search the catalog to add a service</Label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input placeholder="Type at least 2 letters…" value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
              </div>
              {matches.length > 0 && (
                <div className="mt-2 divide-y rounded-lg border max-h-64 overflow-auto">
                  {matches.map((svc) => {
                    const already = myServicesForCountry.some((s) => s.service === svc);
                    return <AddRow key={svc} service={svc} already={already} onAdd={(price, stock) => addM.mutate({ service: svc, price, stock })} busy={addM.isPending} />;
                  })}
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="shadow-soft">
            <CardContent className="p-0 divide-y">
              {myServicesForCountry.map((s) => (
                <div key={s.id} className="flex items-center gap-3 p-3">
                  <Switch checked={s.status === "active"} onCheckedChange={(v) => updateM.mutate({ id: s.id, patch: { status: v ? "active" : "disabled" } })} />
                  <span className="flex-1 text-sm font-medium">{s.service}</span>
                  {s.completedRequests > 0 && <span className="text-xs text-muted-foreground">{s.successRate}% · {s.completedRequests} done</span>}
                  <Input
                    type="number" min={0} step="0.01" placeholder="Ask for price" defaultValue={s.price ?? ""}
                    onBlur={(e) => { const v = e.target.value.trim(); updateM.mutate({ id: s.id, patch: { price: v === "" ? null : Number(v) } }); }}
                    className="w-32 h-8" title="Your price"
                  />
                  <Input
                    type="number" min={0} step="1" defaultValue={s.stock}
                    onBlur={(e) => updateM.mutate({ id: s.id, patch: { stock: Number(e.target.value) || 0 } })}
                    className="w-24 h-8" title="How many numbers you have"
                  />
                  <Button size="icon" variant="ghost" className="h-8 w-8 text-destructive" onClick={() => { if (confirm(`Stop offering ${s.service} in ${s.country}?`)) updateM.mutate({ id: s.id, patch: { status: "disabled" } }); }}>
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              ))}
              {myServicesForCountry.length === 0 && <div className="p-8 text-center text-sm text-muted-foreground">Search above to add your first service for {country}.</div>}
            </CardContent>
          </Card>
        </>
      )}
      {!country && <p className="text-sm text-muted-foreground">Pick a country above to get started.</p>}

      {activeCountries.length > 0 && (
        <div className="mt-4 flex flex-wrap gap-1.5">
          <span className="text-xs text-muted-foreground self-center mr-1">Already set up for:</span>
          {activeCountries.map((c) => <Button key={c} size="sm" variant={c === country ? "default" : "outline"} className="h-6 px-2 text-xs" onClick={() => setCountry(c)}>{c}</Button>)}
        </div>
      )}
    </div>
  );
}

function AddRow({ service, already, onAdd, busy }: { service: string; already: boolean; onAdd: (price: string, stock: string) => void; busy: boolean }) {
  const [price, setPrice] = useState("");
  const [stock, setStock] = useState("1");
  if (already) return <div className="flex items-center gap-2 p-2 px-3 text-sm text-muted-foreground"><span className="flex-1">{service}</span><span className="text-xs italic">already added</span></div>;
  return (
    <div className="flex items-center gap-2 p-2 px-3">
      <span className="flex-1 text-sm">{service}</span>
      <Input type="number" min={0} step="0.01" placeholder="Price (blank = ask)" value={price} onChange={(e) => setPrice(e.target.value)} className="w-32 h-8" />
      <Input type="number" min={0} step="1" placeholder="Stock" value={stock} onChange={(e) => setStock(e.target.value)} className="w-20 h-8" title="How many numbers" />
      <Button size="sm" disabled={busy} onClick={() => onAdd(price, stock)}><Plus className="h-3.5 w-3.5 mr-1" />Add</Button>
    </div>
  );
}
