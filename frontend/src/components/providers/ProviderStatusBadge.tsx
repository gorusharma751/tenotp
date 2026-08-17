import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { ProviderStatus, ProviderHealth } from "@/types";
import { CheckCircle2, AlertTriangle, XCircle, HelpCircle } from "lucide-react";

const STATUS: Record<ProviderStatus, { label: string; className: string }> = {
  connected:    { label: "Connected",    className: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30" },
  degraded:     { label: "Degraded",     className: "bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/30" },
  disconnected: { label: "Disconnected", className: "bg-zinc-500/15 text-zinc-600 dark:text-zinc-300 border-zinc-500/30" },
  error:        { label: "Error",        className: "bg-red-500/15 text-red-600 dark:text-red-400 border-red-500/30" },
};

export function ProviderStatusBadge({ status, className }: { status: ProviderStatus; className?: string }) {
  const meta = STATUS[status];
  return <Badge variant="outline" className={cn(meta.className, className)}>{meta.label}</Badge>;
}

const HEALTH: Record<ProviderHealth, { label: string; className: string; Icon: typeof CheckCircle2 }> = {
  healthy:  { label: "Healthy",  className: "text-emerald-500", Icon: CheckCircle2 },
  degraded: { label: "Degraded", className: "text-amber-500",   Icon: AlertTriangle },
  down:     { label: "Down",     className: "text-red-500",     Icon: XCircle },
  unknown:  { label: "Unknown",  className: "text-muted-foreground", Icon: HelpCircle },
};

export function ProviderHealthPill({ health }: { health: ProviderHealth }) {
  const meta = HEALTH[health];
  const Icon = meta.Icon;
  return <span className={cn("inline-flex items-center gap-1 text-xs", meta.className)}><Icon className="h-3.5 w-3.5" />{meta.label}</span>;
}
