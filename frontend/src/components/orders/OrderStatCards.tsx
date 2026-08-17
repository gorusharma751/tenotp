import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { motion } from "framer-motion";
import { Package, Clock, Loader2, CheckCircle2, XCircle, AlertTriangle } from "lucide-react";
import { money } from "@/utils/format";

type Summary = {
  total: number; draft: number; pending: number; processing: number;
  completed: number; cancelled: number; failed: number; revenue: number;
};

export function OrderStatCards({ data, loading }: { data?: Summary; loading?: boolean }) {
  const items = [
    { label: "Total", value: data?.total, Icon: Package, color: "text-foreground" },
    { label: "Pending", value: data?.pending, Icon: Clock, color: "text-amber-500" },
    { label: "Processing", value: data?.processing, Icon: Loader2, color: "text-blue-500" },
    { label: "Completed", value: data?.completed, Icon: CheckCircle2, color: "text-emerald-500" },
    { label: "Cancelled", value: data?.cancelled, Icon: XCircle, color: "text-zinc-500" },
    { label: "Failed", value: data?.failed, Icon: AlertTriangle, color: "text-red-500" },
  ];
  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 mb-6">
      {items.map((it, i) => (
        <motion.div key={it.label} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.03 }}>
          <Card className="shadow-soft">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">{it.label}</span>
                <it.Icon className={`h-4 w-4 ${it.color}`} />
              </div>
              {loading ? <Skeleton className="h-6 w-12 mt-2" /> : <div className="text-2xl font-bold mt-1">{it.value ?? 0}</div>}
            </CardContent>
          </Card>
        </motion.div>
      ))}
      {data && (
        <Card className="shadow-soft col-span-2 md:col-span-3 lg:col-span-6">
          <CardContent className="p-4 flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Completed revenue</span>
            <span className="text-lg font-semibold">{money(data.revenue)}</span>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
