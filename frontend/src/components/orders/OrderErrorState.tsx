import { AlertTriangle, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";

export function OrderErrorState({ error, onRetry }: { error: unknown; onRetry: () => void }) {
  const msg = error instanceof Error ? error.message : "Something went wrong.";
  return (
    <div className="flex flex-col items-center justify-center text-center p-10 rounded-xl border border-destructive/30 bg-destructive/5">
      <AlertTriangle className="h-10 w-10 text-destructive mb-3" />
      <h3 className="font-semibold mb-1">Unable to load orders</h3>
      <p className="text-sm text-muted-foreground mb-4">{msg}</p>
      <Button variant="outline" onClick={onRetry}><RefreshCw className="h-4 w-4 mr-2" />Retry</Button>
    </div>
  );
}
