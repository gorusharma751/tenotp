import { useQuery } from "@tanstack/react-query";
import { PageHeader } from "@/components/common/PageHeader";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import type { HealthMetric } from "@/types";

// No backend table for platform-wide health metrics — the monolith's own
// src/api/events.ts stub (healthApi.list()) always returned []. Preserved
// as a local no-op stub rather than inventing an endpoint.
const healthApi = {
  async list(): Promise<HealthMetric[]> { return []; },
};

export default function AdminHealth() {
  const q = useQuery({ queryKey: ["health"], queryFn: () => healthApi.list(), refetchInterval: 20_000 });
  return (
    <div>
      <PageHeader title="System health" description="Live metrics across the platform (mock)." />
      {q.isLoading ? <Skeleton className="h-40" /> : (
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          {(q.data ?? []).map((m) => (
            <Card key={m.key} className="shadow-soft">
              <CardContent className="p-5">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs text-muted-foreground">{m.label}</span>
                  <Badge variant={m.status === "ok" ? "default" : m.status === "warn" ? "secondary" : "destructive"}>{m.status}</Badge>
                </div>
                <div className="text-2xl font-bold">{m.value}<span className="text-sm text-muted-foreground ml-1">{m.unit}</span></div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
