import { useQuery, useQueryClient } from "@tanstack/react-query";
import { PageHeader } from "@/components/common/PageHeader";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { dateTime } from "@/utils/format";
import { toast } from "sonner";
import { CheckCircle2, X, AlertTriangle } from "lucide-react";
import type { AlertItem } from "@/types";

// No backend table for a system alert center yet — mirrors the monolith's
// own empty stub (src/api/events.ts alertsApi always returned []).
const alertsApi = {
  async list(): Promise<AlertItem[]> { return []; },
  async acknowledge(_id: string) { return { ok: true as const }; },
  async dismiss(_id: string) { return { ok: true as const }; },
};

export default function AdminAlerts() {
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ["alerts"], queryFn: () => alertsApi.list(), refetchInterval: 30_000 });
  const inv = () => qc.invalidateQueries({ queryKey: ["alerts"] });
  return (
    <div>
      <PageHeader title="Alert center" description="Active alerts from monitors, jobs and providers." />
      {q.isLoading ? <Skeleton className="h-40" /> : (
        <div className="grid gap-3">
          {(q.data ?? []).map((a) => (
            <Card key={a.id} className="shadow-soft">
              <CardContent className="p-4 flex items-start justify-between gap-3 flex-wrap">
                <div className="flex items-start gap-3 min-w-0">
                  <AlertTriangle className={`h-5 w-5 shrink-0 ${a.severity === "critical" ? "text-red-500" : a.severity === "warning" ? "text-amber-500" : "text-blue-500"}`} />
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium">{a.title}</span>
                      <Badge variant="outline">{a.severity}</Badge>
                      {a.acknowledged && <Badge variant="secondary">acknowledged</Badge>}
                    </div>
                    <p className="text-sm text-muted-foreground">{a.detail}</p>
                    <div className="text-xs text-muted-foreground mt-1">{dateTime(a.raisedAt)}</div>
                  </div>
                </div>
                <div className="flex gap-2 shrink-0">
                  {!a.acknowledged && <Button size="sm" variant="outline" onClick={async () => { try { await alertsApi.acknowledge(a.id); toast.success("Acknowledged"); inv(); } catch (e) { toast.error((e as Error).message); } }}><CheckCircle2 className="h-4 w-4 mr-1" />Ack</Button>}
                  <Button size="sm" variant="ghost" onClick={async () => { try { await alertsApi.dismiss(a.id); inv(); } catch (e) { toast.error((e as Error).message); } }}><X className="h-4 w-4" /></Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
