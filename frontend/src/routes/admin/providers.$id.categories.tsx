import { useParams, Link } from "@tanstack/react-router";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, RefreshCw } from "lucide-react";
import { PageHeader } from "@/components/common/PageHeader";
import { useProviderCategoriesList, useProviderModuleActions } from "@/hooks/useProviderModule";
import { providerCatalogApi } from "@/lib/providersApi";
import { useState } from "react";
import { toast } from "sonner";
import { ProviderSubNav } from "@/components/providers/ProviderSubNav";

function ProviderCategoriesPage() {
  const { id } = useParams({ strict: false }) as { id: string };
  const cats = useProviderCategoriesList(id);
  const actions = useProviderModuleActions(id);
  const [edits, setEdits] = useState<Record<string, string>>({});

  const save = async (rowId: string) => {
    try { await providerCatalogApi.setCategoryMapping(rowId, edits[rowId] ?? null); toast.success("Saved"); cats.refetch(); }
    catch (e) { toast.error((e as Error).message); }
  };

  return (
    <div>
      <Button variant="ghost" size="sm" asChild className="mb-3">
        <Link to={"/gourav-ankit-adi/providers/$id" as any} params={{ id } as any}><ArrowLeft className="h-4 w-4 mr-1" />Provider</Link>
      </Button>
      <PageHeader title="External categories" description="Map external categories to your internal taxonomy." actions={
        <Button size="sm" onClick={() => actions.syncCategories.mutate()} disabled={actions.syncCategories.isPending}>
          <RefreshCw className="h-4 w-4 mr-1" />{actions.syncCategories.isPending ? "Syncing…" : "Sync now"}
        </Button>
      } />
      <ProviderSubNav id={id} />
      <Card className="shadow-soft"><CardContent className="p-4">
        {cats.isLoading ? <Skeleton className="h-64" /> : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader><TableRow>
                <TableHead>External name</TableHead>
                <TableHead>External ID</TableHead>
                <TableHead>Internal category</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow></TableHeader>
              <TableBody>
                {(cats.data ?? []).map((c) => (
                  <TableRow key={c.id}>
                    <TableCell className="font-medium">{c.external_name}</TableCell>
                    <TableCell className="font-mono text-xs">{c.external_id}</TableCell>
                    <TableCell>
                      <Input defaultValue={c.internal_category ?? ""} placeholder="e.g. otp"
                        onChange={(e) => setEdits((s) => ({ ...s, [c.id]: e.target.value }))} className="h-8" />
                    </TableCell>
                    <TableCell><Badge variant={c.active ? "default" : "outline"}>{c.active ? "active" : "inactive"}</Badge></TableCell>
                    <TableCell className="text-right"><Button size="sm" variant="outline" onClick={() => save(c.id)}>Save</Button></TableCell>
                  </TableRow>
                ))}
                {(cats.data ?? []).length === 0 && (
                  <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-10">No categories yet — click Sync.</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent></Card>
    </div>
  );
}

export default ProviderCategoriesPage;
