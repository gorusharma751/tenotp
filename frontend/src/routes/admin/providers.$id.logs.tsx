import { useParams, Link } from "@tanstack/react-router";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Trash2 } from "lucide-react";
import { PageHeader } from "@/components/common/PageHeader";
import { useProviderRequestLogs, useProviderModuleActions } from "@/hooks/useProviderModule";
import { dateTime } from "@/utils/format";
import { ProviderSubNav } from "@/components/providers/ProviderSubNav";

function ProviderLogsPage() {
  const { id } = useParams({ strict: false }) as { id: string };
  const logs = useProviderRequestLogs(id);
  const actions = useProviderModuleActions(id);
  return (
    <div>
      <Button variant="ghost" size="sm" asChild className="mb-3">
        <Link to={"/gourav-ankit-adi/providers/$id" as any} params={{ id } as any}><ArrowLeft className="h-4 w-4 mr-1" />Provider</Link>
      </Button>
      <PageHeader title="API request logs" description="Every request and response to this provider." actions={
        <Button size="sm" variant="outline" onClick={() => actions.clearLogs.mutate()} disabled={actions.clearLogs.isPending}>
          <Trash2 className="h-4 w-4 mr-1" />Clear
        </Button>
      } />
      <ProviderSubNav id={id} />
      <Card className="shadow-soft"><CardContent className="p-4">
        {logs.isLoading ? <Skeleton className="h-64" /> : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader><TableRow>
                <TableHead>When</TableHead><TableHead>Direction</TableHead><TableHead>Method</TableHead>
                <TableHead>Path</TableHead><TableHead>Status</TableHead><TableHead className="text-right">Latency</TableHead>
              </TableRow></TableHeader>
              <TableBody>
                {(logs.data ?? []).map((l) => (
                  <TableRow key={l.id}>
                    <TableCell className="text-xs text-muted-foreground">{dateTime(l.at)}</TableCell>
                    <TableCell><Badge variant="outline">{l.direction}</Badge></TableCell>
                    <TableCell className="font-mono text-xs">{l.method}</TableCell>
                    <TableCell className="font-mono text-xs">{l.path}</TableCell>
                    <TableCell><Badge variant={l.status >= 500 ? "destructive" : l.status >= 400 ? "secondary" : "default"}>{l.status}</Badge></TableCell>
                    <TableCell className="text-right text-xs">{l.latency_ms}ms</TableCell>
                  </TableRow>
                ))}
                {(logs.data ?? []).length === 0 && (
                  <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-10">No API logs yet.</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent></Card>
    </div>
  );
}

export default ProviderLogsPage;
