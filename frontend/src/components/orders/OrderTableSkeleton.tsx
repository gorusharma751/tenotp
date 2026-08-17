import { Skeleton } from "@/components/ui/skeleton";

export function OrderTableSkeleton({ rows = 8 }: { rows?: number }) {
  return (
    <div className="space-y-2">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="grid grid-cols-6 gap-3 p-3 rounded-lg border border-border/60">
          <Skeleton className="h-4 col-span-1" />
          <Skeleton className="h-4 col-span-2" />
          <Skeleton className="h-4 col-span-1" />
          <Skeleton className="h-4 col-span-1" />
          <Skeleton className="h-4 col-span-1" />
        </div>
      ))}
    </div>
  );
}
