import { Badge } from "@/components/ui/badge";
import { dateTime } from "@/utils/format";
import { cn } from "@/lib/utils";
import { CheckCircle2, Clock, XCircle, MessageSquare, RefreshCw, Send } from "lucide-react";

export type OtpTimelineEvent = {
  id: string;
  action: string;
  statusCode: number | null;
  activationId: string | null;
  note: string | null;
  createdAt: string;
};

const ACTION_META: Record<string, { label: string; icon: React.ComponentType<{ className?: string }>; tone: string }> = {
  reserved:         { label: "Number reserved",  icon: Clock,        tone: "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/30" },
  otp_received:     { label: "OTP received",     icon: MessageSquare, tone: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30" },
  next_requested:   { label: "Next OTP requested", icon: RefreshCw,  tone: "bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border-indigo-500/30" },
  completed:        { label: "Marked complete",  icon: CheckCircle2, tone: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30" },
  inform_sent:      { label: "Sender informed",  icon: Send,         tone: "bg-slate-500/10 text-slate-600 dark:text-slate-400 border-slate-500/30" },
  cancel_requested: { label: "Cancel requested", icon: XCircle,      tone: "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30" },
  cancelled:        { label: "Cancelled",        icon: XCircle,      tone: "bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/30" },
};

const STATUS_CODE_LABEL: Record<number, string> = {
  1: "code 1 · send SMS",
  3: "code 3 · request next OTP",
  6: "code 6 · complete",
  8: "code 8 · cancel",
};

export function OtpStatusTimeline({ events }: { events: OtpTimelineEvent[] }) {
  if (!events.length) {
    return <p className="text-sm text-muted-foreground">No provider events yet. As soon as the number is reserved or an OTP arrives, it will appear here.</p>;
  }
  return (
    <ol className="relative border-s border-border/60 pl-6 space-y-5">
      {events.map((e) => {
        const meta = ACTION_META[e.action] ?? { label: e.action, icon: Clock, tone: "bg-muted text-muted-foreground border-border" };
        const Icon = meta.icon;
        return (
          <li key={e.id} className="relative">
            <span className={cn("absolute -start-[13px] mt-0.5 flex h-6 w-6 items-center justify-center rounded-full ring-4 ring-background", meta.tone)}>
              <Icon className="h-3.5 w-3.5" />
            </span>
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-sm font-medium">{meta.label}</span>
              {e.statusCode != null && (
                <Badge variant="outline" className={cn("font-mono text-[10px]", meta.tone)}>
                  {STATUS_CODE_LABEL[e.statusCode] ?? `code ${e.statusCode}`}
                </Badge>
              )}
              {e.activationId && (
                <Badge variant="outline" className="font-mono text-[10px]">
                  activation_id: {e.activationId}
                </Badge>
              )}
            </div>
            {e.note && <p className="text-sm text-muted-foreground mt-1">{e.note}</p>}
            <div className="text-xs text-muted-foreground mt-1">{dateTime(e.createdAt)}</div>
          </li>
        );
      })}
    </ol>
  );
}
