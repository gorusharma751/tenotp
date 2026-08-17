import { motion } from "framer-motion";
import { OrderStatusBadge } from "./OrderStatusBadge";
import type { OrderTimelineEvent } from "@/types";
import { dateTime } from "@/utils/format";

export function OrderTimeline({ events }: { events: OrderTimelineEvent[] }) {
  if (!events.length) return <p className="text-sm text-muted-foreground">No timeline events.</p>;
  return (
    <ol className="relative border-s border-border/60 pl-6 space-y-6">
      {events.map((e, i) => (
        <motion.li
          key={e.id}
          initial={{ opacity: 0, x: -8 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: i * 0.05 }}
          className="relative"
        >
          <span className="absolute -start-[9px] mt-1.5 h-4 w-4 rounded-full bg-primary/20 ring-4 ring-background flex items-center justify-center">
            <span className="h-2 w-2 rounded-full bg-primary" />
          </span>
          <div className="flex flex-wrap items-center gap-2">
            <OrderStatusBadge status={e.status} />
            <span className="text-sm font-medium">{e.title}</span>
          </div>
          {e.description && <p className="text-sm text-muted-foreground mt-1">{e.description}</p>}
          <div className="text-xs text-muted-foreground mt-1">
            {dateTime(e.at)}{e.actor ? ` · by ${e.actor}` : ""}
          </div>
        </motion.li>
      ))}
    </ol>
  );
}
