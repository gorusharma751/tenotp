import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { ManagedOrderStatus, ManagedOrderPaymentStatus } from "@/types";
import {
  FileEdit, Clock, Loader2, CheckCircle2, XCircle, AlertTriangle,
  CircleDollarSign, Undo2, WalletCards,
} from "lucide-react";

const STATUS_META: Record<ManagedOrderStatus, { label: string; className: string; Icon: typeof FileEdit }> = {
  draft:      { label: "Draft",      className: "bg-muted text-muted-foreground border-transparent", Icon: FileEdit },
  pending:    { label: "Pending",    className: "bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/30", Icon: Clock },
  processing: { label: "Processing", className: "bg-blue-500/15 text-blue-600 dark:text-blue-400 border-blue-500/30", Icon: Loader2 },
  completed:  { label: "Completed",  className: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30", Icon: CheckCircle2 },
  cancelled:  { label: "Cancelled",  className: "bg-zinc-500/15 text-zinc-600 dark:text-zinc-300 border-zinc-500/30", Icon: XCircle },
  failed:     { label: "Failed",     className: "bg-red-500/15 text-red-600 dark:text-red-400 border-red-500/30", Icon: AlertTriangle },
};

export function OrderStatusBadge({ status, className }: { status: ManagedOrderStatus; className?: string }) {
  const meta = STATUS_META[status];
  const Icon = meta.Icon;
  return (
    <Badge variant="outline" className={cn("gap-1 font-medium", meta.className, className)}>
      <Icon className={cn("h-3 w-3", status === "processing" && "animate-spin")} />
      {meta.label}
    </Badge>
  );
}

const PAY_META: Record<ManagedOrderPaymentStatus, { label: string; className: string; Icon: typeof FileEdit }> = {
  unpaid:   { label: "Unpaid",   className: "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30", Icon: WalletCards },
  paid:     { label: "Paid",     className: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30", Icon: CircleDollarSign },
  refunded: { label: "Refunded", className: "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/30", Icon: Undo2 },
  failed:   { label: "Failed",   className: "bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/30", Icon: AlertTriangle },
};

export function OrderPaymentBadge({ status, className }: { status: ManagedOrderPaymentStatus; className?: string }) {
  const meta = PAY_META[status];
  const Icon = meta.Icon;
  return (
    <Badge variant="outline" className={cn("gap-1 font-medium", meta.className, className)}>
      <Icon className="h-3 w-3" />
      {meta.label}
    </Badge>
  );
}
