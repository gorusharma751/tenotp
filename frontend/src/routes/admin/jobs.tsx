import { useQuery } from "@tanstack/react-query";
import { PageHeader } from "@/components/common/PageHeader";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { dateTime } from "@/utils/format";

type JobRow = {
  id: string;
  provider_id: string;
  job_type: string;
  status: string;
  started_at: string;
  finished_at: string | null;
  items_in: number;
  items_out: number;
  error: string | null;
  providers?: { name: string | null } | null;
};

// No cross-provider "all sync jobs" endpoint exists on the backend — only
// GET /api/providers/:id/sync/history (per single provider). Kept as an
// empty stub, matching the monolith's placeholder intent for this page.
async function fetchJobs(): Promise<JobRow[]> {
  return [];
}

export default function AdminJobs() {
  const q = useQuery({
    queryKey: ["admin-jobs"],
    refetchInterval: 15_000,
    queryFn: () => fetchJobs(),
  });

  return (
    <div>
      <PageHeader
        title="Background jobs"
        description="Real sync-job history across all providers (auto-refresh every 15s)."
      />
      <Card className="shadow-soft">
        <CardContent className="p-4">
          {q.isLoading ? (
            <Skeleton className="h-40" />
          ) : q.isError ? (
            <div className="p-10 text-center text-destructive">
              Failed to load jobs: {(q.error as Error).message}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Started</TableHead>
                    <TableHead>Provider</TableHead>
                    <TableHead>Job</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">In</TableHead>
                    <TableHead className="text-right">Out</TableHead>
                    <TableHead>Finished</TableHead>
                    <TableHead>Error</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(q.data ?? []).map((j) => (
                    <TableRow key={j.id}>
                      <TableCell className="text-xs text-muted-foreground">
                        {dateTime(j.started_at)}
                      </TableCell>
                      <TableCell className="text-xs">
                        {j.providers?.name ?? j.provider_id?.slice(0, 8)}
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary">{j.job_type}</Badge>
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={
                            j.status === "failed"
                              ? "destructive"
                              : j.status === "success"
                                ? "default"
                                : "secondary"
                          }
                        >
                          {j.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right tabular-nums">{j.items_in ?? 0}</TableCell>
                      <TableCell className="text-right tabular-nums">{j.items_out ?? 0}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {j.finished_at ? dateTime(j.finished_at) : "—"}
                      </TableCell>
                      <TableCell className="text-xs text-destructive max-w-xs truncate">
                        {j.error ?? ""}
                      </TableCell>
                    </TableRow>
                  ))}
                  {(q.data ?? []).length === 0 && (
                    <TableRow>
                      <TableCell colSpan={8} className="text-center text-muted-foreground py-10">
                        No sync jobs yet — run a provider sync to populate this list.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
