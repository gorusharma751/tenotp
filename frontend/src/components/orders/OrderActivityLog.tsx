import { Badge } from "@/components/ui/badge";
import type { OrderActivityLog as LogT } from "@/types";
import { dateTime } from "@/utils/format";
import { cn } from "@/lib/utils";

const LEVEL: Record<LogT["level"], string> = {
  info: "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/30",
  success: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30",
  warning: "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30",
  error: "bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/30",
};

export function OrderActivityLogList({ logs }: { logs: LogT[] }) {
  if (!logs.length) return <p className="text-sm text-muted-foreground">No activity yet.</p>;
  return (
    <ul className="divide-y divide-border/60">
      {logs.map((l) => (
        <li key={l.id} className="py-3 flex flex-wrap items-start gap-3">
          <Badge variant="outline" className={cn("shrink-0", LEVEL[l.level])}>{l.action}</Badge>
          <div className="min-w-0 flex-1">
            {l.detail && <p className="text-sm">{l.detail}</p>}
            <div className="text-xs text-muted-foreground mt-0.5">{dateTime(l.at)} · {l.by}</div>
          </div>
        </li>
      ))}
    </ul>
  );
}
