import { useQuery } from "@tanstack/react-query";
import { PageHeader } from "@/components/common/PageHeader";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { dateTime } from "@/utils/format";
import type { EventItem } from "@/types";

// No global event-bus table on the backend — the monolith's own stub
// (src/api/events.ts eventsApi.list()) always returned []. Kept local
// rather than inventing an endpoint.
const eventsApi = {
  async list(_limit = 50): Promise<EventItem[]> { return []; },
};

const SEVERITY_TONE: Record<EventItem["severity"], string> = {
  info: "secondary",
  success: "default",
  warning: "secondary",
  error: "destructive",
};

function EventTimeline({ events }: { events: EventItem[] }) {
  if (events.length === 0) {
    return <div className="py-10 text-center text-sm text-muted-foreground">No events yet.</div>;
  }
  return (
    <div className="space-y-3">
      {events.map((e) => (
        <div key={e.id} className="flex items-start gap-3 border-b pb-3 last:border-b-0 last:pb-0">
          <Badge variant={SEVERITY_TONE[e.severity] as never}>{e.severity}</Badge>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-medium text-sm">{e.type}</span>
              <span className="text-xs text-muted-foreground">by {e.actor}</span>
              {e.target && <span className="text-xs text-muted-foreground">→ {e.target}</span>}
            </div>
            <div className="text-xs text-muted-foreground mt-0.5">{dateTime(e.at)}</div>
          </div>
        </div>
      ))}
    </div>
  );
}

export default function AdminEvents() {
  const q = useQuery({ queryKey: ["events-admin"], queryFn: () => eventsApi.list(80), refetchInterval: 15_000 });
  return (
    <div>
      <PageHeader title="Event Bus" description="Every event flowing through the platform (mock)." />
      <Card className="shadow-soft"><CardContent className="p-6">
        {q.isLoading ? <Skeleton className="h-64" /> : <EventTimeline events={q.data ?? []} />}
      </CardContent></Card>
    </div>
  );
}
