import { Card, CardContent } from "@/components/ui/card";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export function StatCard({ label, value, delta, icon: Icon, tone = "brand" }: { label: string; value: string; delta?: string; icon: LucideIcon; tone?: "brand" | "success" | "warning" | "info" }) {
  const toneMap = {
    brand: "bg-primary/10 text-primary",
    success: "bg-success/10 text-success",
    warning: "bg-warning/15 text-warning",
    info: "bg-info/10 text-info",
  } as const;
  return (
    <Card className="shadow-soft">
      <CardContent className="p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-sm text-muted-foreground">{label}</p>
            <p className="mt-1 truncate text-2xl font-bold tracking-tight">{value}</p>
            {delta ? <p className="mt-1 text-xs text-success">{delta}</p> : null}
          </div>
          <div className={cn("grid h-11 w-11 shrink-0 place-items-center rounded-xl", toneMap[tone])}>
            <Icon className="h-5 w-5" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
