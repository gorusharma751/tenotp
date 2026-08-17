import { useEffect, useRef, useState } from "react";
import { useUserStore } from "@/store/userStore";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Copy, CheckCircle2 } from "lucide-react";
import { getToken, API_BASE_URL } from "@/lib/apiClient";

interface OtpEvent {
  orderId: string;
  service: string;
  number: string;
  otp: string;
}

// Live "OTP received" popup — backed by the backend's SSE relay at
// GET /api/realtime/otp?token=<jwt> (see backend/src/routes/realtime.ts),
// fed by MongoDB change streams. EventSource can't send an Authorization
// header, so the session token goes in the query string instead.
export function RealtimeOtpPopup() {
  const user = useUserStore((s) => s.user);
  const [current, setCurrent] = useState<OtpEvent | null>(null);
  const [copied, setCopied] = useState(false);
  const seen = useRef(new Set<string>());

  useEffect(() => {
    if (!user?.id) return;
    const token = getToken();
    if (!token) return;
    const source = new EventSource(`${API_BASE_URL}/api/realtime/otp?token=${encodeURIComponent(token)}`);

    source.addEventListener("otp", (e) => {
      try {
        const n = JSON.parse((e as MessageEvent).data) as OtpEvent;
        if (!n?.otp || seen.current.has(n.orderId + n.otp)) return;
        seen.current.add(n.orderId + n.otp);
        setCopied(false);
        setCurrent(n);
        try {
          new Audio(
            "data:audio/wav;base64,UklGRl9vT19XQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQAAAAA=",
          )
            .play()
            .catch(() => {});
        } catch {
          /* ignore */
        }
      } catch {
        /* malformed event */
      }
    });

    source.addEventListener("order_status", (e) => {
      try {
        const n = JSON.parse((e as MessageEvent).data) as { orderId: string; status: string };
        toast.info(`Order ${String(n.orderId).slice(0, 8)} → ${n.status}`);
      } catch {
        /* malformed event */
      }
    });

    source.addEventListener("notification", (e) => {
      try {
        const n = JSON.parse((e as MessageEvent).data) as { title?: string; body?: string };
        toast(n.title || "Notification", { description: n.body || undefined });
      } catch {
        /* malformed event */
      }
    });

    source.onerror = () => {
      // Connection dropped (network blip) — the browser retries EventSource
      // automatically; nothing to do here.
    };

    return () => source.close();
  }, [user?.id]);

  const copy = async () => {
    if (!current) return;
    try {
      await navigator.clipboard.writeText(current.otp);
      setCopied(true);
      toast.success("OTP copied");
    } catch {
      toast.error("Copy failed");
    }
  };

  return (
    <Dialog open={!!current} onOpenChange={(o) => !o && setCurrent(null)}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>OTP received · {current?.service}</DialogTitle>
        </DialogHeader>
        {current && (
          <div className="space-y-4">
            <div className="rounded-xl border bg-muted/30 p-4 text-center">
              <p className="text-xs text-muted-foreground mb-1">Your code</p>
              <p className="font-mono text-4xl font-bold tracking-widest">{current.otp}</p>
              <p className="text-xs text-muted-foreground mt-2">For {current.number}</p>
            </div>
            <div className="flex gap-2">
              <Button className="flex-1" onClick={copy}>
                {copied ? (
                  <>
                    <CheckCircle2 className="h-4 w-4 mr-1" />
                    Copied
                  </>
                ) : (
                  <>
                    <Copy className="h-4 w-4 mr-1" />
                    Copy OTP
                  </>
                )}
              </Button>
              <Button variant="outline" onClick={() => setCurrent(null)}>
                Close
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
