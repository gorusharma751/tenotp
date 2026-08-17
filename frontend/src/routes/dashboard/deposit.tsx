import { useEffect, useState } from "react";
import { PageHeader } from "@/components/common/PageHeader";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { toast } from "sonner";
import { Loader2, Copy, Clock, CheckCircle2, XCircle, Smartphone, ExternalLink } from "lucide-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useContactLinks } from "@/hooks/useContactLinks";
import { Send } from "lucide-react";
import { useUserStore } from "@/store/userStore";
import { api } from "@/lib/apiClient";

declare global {
  interface Window {
    Razorpay?: any;
  }
}

function loadRazorpay(): Promise<boolean> {
  return new Promise((resolve) => {
    if (typeof window === "undefined") return resolve(false);
    if (window.Razorpay) return resolve(true);
    const s = document.createElement("script");
    s.src = "https://checkout.razorpay.com/v1/checkout.js";
    s.onload = () => resolve(true);
    s.onerror = () => resolve(false);
    document.body.appendChild(s);
  });
}

const INR_PRESETS = [100, 250, 500, 1000, 2500, 5000];

interface PaytmStatus {
  enabled: boolean;
  ttlMinutes: number;
  bharatpeEnabled: boolean;
  bharatpeTtlMinutes: number;
  bharatpeShowUpiApps: boolean;
}

// Ported from src/routes/dashboard.deposit.tsx. The monolith's manual UPI /
// USDT / BharatPe-QR-image tabs and local deposit history read from admin
// "payment settings" + a client-only deposits store — neither has a ported
// backend endpoint, so this keeps only the flows backed by real endpoints:
// Razorpay and the Paytm/BharatPe auto-credit QR flow
// (backend/src/routes/payments.ts). The generic multi-provider "Merchants"
// UPI card was removed — it duplicated this same BharatPe QR flow with a
// separate, disconnected admin config (see the Settings page's BharatPe tab
// for the one real config surface).
export default function Deposit() {
  const user = useUserStore((s) => s.user);
  const email = user?.email ?? "guest@getotp.pro";
  const contact = useContactLinks().data;
  const tg = contact?.telegramGroup || contact?.telegramSupport || "";
  const paytmStatus = useQuery({ queryKey: ["paytm-status"], queryFn: () => api.get<PaytmStatus>("/api/payments/paytm/status") });
  const paytmEnabled = paytmStatus.data?.enabled ?? false;
  const bpeAutoEnabled = paytmStatus.data?.bharatpeEnabled ?? false;
  const [rzpBusy, setRzpBusy] = useState(false);
  const qc = useQueryClient();

  const [amount, setAmount] = useState(250);

  const payWithRazorpay = async () => {
    if (amount < 10) return toast.error("Minimum ₹10");
    setRzpBusy(true);
    try {
      const ok = await loadRazorpay();
      if (!ok) return toast.error("Failed to load Razorpay");
      const order = await api.post<{ key_id: string; amount: number; currency: string; order_id: string }>("/api/payments/razorpay/create-order", { amount });
      const rzp = new window.Razorpay({
        key: order.key_id,
        amount: order.amount,
        currency: order.currency,
        order_id: order.order_id,
        name: "TenOTP Wallet",
        description: `Add ₹${amount} to wallet`,
        prefill: { email },
        theme: { color: "#6d28d9" },
        handler: async (response: any) => {
          setRzpBusy(true);
          toast.success("Payment received — adding wallet balance…");
          try {
            const result = await api.post<{ balance: number; credited: boolean; amount: number }>("/api/payments/razorpay/verify", {
              razorpay_order_id: response.razorpay_order_id,
              razorpay_payment_id: response.razorpay_payment_id,
              razorpay_signature: response.razorpay_signature,
            });
            const bal = Number(result.balance ?? 0);
            useUserStore.setState((s) => (s.user ? { user: { ...s.user, wallet: bal } } : s));
            qc.invalidateQueries({ queryKey: ["wallet"] });
            toast.success(result.credited ? `₹${result.amount?.toLocaleString()} added — balance ₹${bal.toLocaleString()}` : `Payment already credited — balance ₹${bal.toLocaleString()}`);
          } catch (e) {
            toast.error(e instanceof Error ? e.message : "Payment verified, but wallet credit failed. Contact admin with payment ID.");
          } finally {
            setRzpBusy(false);
          }
        },
        modal: { ondismiss: () => setRzpBusy(false) },
      });
      rzp.on("payment.failed", (r: any) => toast.error(r?.error?.description || "Payment failed"));
      rzp.open();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not start payment");
    } finally {
      setRzpBusy(false);
    }
  };

  return (
    <div>
      {tg && (
        <Card className="shadow-soft mb-4 border-[#229ED9]/30 bg-[#229ED9]/5">
          <CardContent className="p-3 flex items-center gap-3">
            <div className="grid h-9 w-9 place-items-center rounded-lg bg-[#229ED9]/15 text-[#229ED9] shrink-0">
              <Send className="h-4 w-4" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold truncate">Join our Telegram for instant deposit alerts</p>
              <p className="text-[11px] text-muted-foreground truncate">Downtime updates, offers & 24×7 support.</p>
            </div>
            <Button asChild size="sm" className="bg-[#229ED9] hover:bg-[#1b8bc0] text-white shrink-0">
              <a href={tg} target="_blank" rel="noopener noreferrer"><Send className="h-3.5 w-3.5 mr-1" />Join</a>
            </Button>
          </CardContent>
        </Card>
      )}
      <PageHeader title="Deposit funds" description="Instant top-up via Razorpay (UPI / Card / Netbanking), UPI QR, Paytm or BharatPe." />

      <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
        <div className="space-y-6">
          <Card className="shadow-soft"><CardContent className="p-6">
            <Tabs defaultValue="INR">
              <TabsList className="mb-4">
                <TabsTrigger value="INR">🇮🇳 INR</TabsTrigger>
              </TabsList>
              <TabsContent value="INR">
                <div className="mb-5 rounded-xl border border-primary/30 bg-primary/5 p-4">
                  <div className="flex items-center justify-between gap-3 flex-wrap">
                    <div>
                      <h3 className="font-semibold flex items-center gap-1.5">⚡ Instant pay via Razorpay</h3>
                      <p className="text-xs text-muted-foreground mt-0.5">Cards, UPI, Netbanking — wallet credits automatically. No screenshot needed.</p>
                    </div>
                    <Button size="lg" className="gradient-brand" onClick={payWithRazorpay} disabled={rzpBusy}>
                      {rzpBusy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                      Pay ₹{amount} now
                    </Button>
                  </div>
                  <div className="mt-3">
                    <AmountBlock amount={amount} setAmount={setAmount} presets={INR_PRESETS} />
                  </div>
                </div>

                {paytmEnabled && (
                  <PaytmQrCard
                    provider="paytm"
                    title="📲 Paytm QR — instant auto-credit"
                    ttlMinutes={paytmStatus.data?.ttlMinutes ?? 5}
                    amount={amount}
                    setAmount={setAmount}
                    presets={INR_PRESETS}
                  />
                )}
                {bpeAutoEnabled && (
                  <PaytmQrCard
                    provider="bharatpe"
                    title="🟦 BharatPe UPI payment"
                    ttlMinutes={paytmStatus.data?.bharatpeTtlMinutes ?? 10}
                    amount={amount}
                    setAmount={setAmount}
                    presets={INR_PRESETS}
                    showUpiApps={paytmStatus.data?.bharatpeShowUpiApps ?? false}
                  />
                )}
              </TabsContent>
            </Tabs>
          </CardContent></Card>
        </div>

        <Card className="shadow-glow border-primary/10 h-fit lg:sticky lg:top-24">
          <CardContent className="p-6 space-y-3 text-sm">
            <h3 className="font-semibold">How deposits work</h3>
            <Step n={1} title="Choose amount" body="Pick a preset or enter any amount ≥ ₹10." />
            <Step n={2} title="Pay via Razorpay, UPI or Paytm/BharatPe QR" body="No screenshot needed for these auto-verified flows." />
            <Step n={3} title="Auto credit" body="Wallet updates automatically within seconds." />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function AmountBlock({ amount, setAmount, presets }: { amount: number; setAmount: (n: number) => void; presets: number[] }) {
  return (
    <div>
      <Label className="text-xs text-muted-foreground">Amount (INR)</Label>
      <Input type="number" min={1} value={amount} onChange={(e) => setAmount(Math.max(1, Number(e.target.value) || 0))} className="mt-1 text-lg font-semibold" />
      <div className="mt-2 flex flex-wrap gap-1.5">
        {presets.map((p) => <Button key={p} size="sm" variant={amount === p ? "default" : "outline"} onClick={() => setAmount(p)}>₹{p}</Button>)}
      </div>
    </div>
  );
}

function Step({ n, title, body }: { n: number; title: string; body: string }) {
  return (
    <div className="flex gap-3 rounded-lg border p-3">
      <div className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-primary/10 text-primary text-xs font-bold">{n}</div>
      <div className="min-w-0">
        <p className="font-medium">{title}</p>
        <p className="text-xs text-muted-foreground">{body}</p>
      </div>
    </div>
  );
}

interface PaytmSession {
  sessionId: string;
  orderId: string;
  amount: number;
  qrData: string;
  qrImage: string;
  expiresAt: string;
  upiId?: string;
  ttlMinutes?: number;
}

function PaytmQrCard({ amount, setAmount, presets, provider, title, ttlMinutes = 5, showUpiApps = true }: {
  amount: number; setAmount: (n: number) => void; presets: number[];
  provider: "paytm" | "bharatpe"; title: string; ttlMinutes?: number; showUpiApps?: boolean;
}) {
  const qc = useQueryClient();
  const [session, setSession] = useState<PaytmSession | null>(null);
  const [state, setState] = useState<"idle" | "waiting" | "paid" | "expired" | "failed">("idle");
  const [verifyMessage, setVerifyMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [left, setLeft] = useState(0);
  const [utrValue, setUtrValue] = useState("");
  const [utrBusy, setUtrBusy] = useState(false);
  const [utrSent, setUtrSent] = useState(false);

  const openUpiApp = (packageName?: string) => {
    if (!session?.qrData) return;
    const isAndroid = /Android/i.test(navigator.userAgent);
    if (packageName && isAndroid && session.qrData.startsWith("upi://pay?")) {
      const query = session.qrData.slice("upi://pay?".length);
      window.location.href = `intent://pay?${query}#Intent;scheme=upi;package=${packageName};end`;
      return;
    }
    window.location.href = session.qrData;
  };

  useEffect(() => {
    if (!session || state !== "waiting") return;
    const tick = () => {
      const ms = new Date(session.expiresAt).getTime() - Date.now();
      setLeft(Math.max(0, Math.floor(ms / 1000)));
      if (ms <= 0 && !utrSent) setState("expired");
    };
    tick();
    const t = setInterval(tick, 1000);
    return () => clearInterval(t);
  }, [session, state, utrSent]);

  useEffect(() => {
    if (!session || state !== "waiting") return;
    let stop = false;
    const poll = async () => {
      try {
        const r = await api.post<{ status: string; balance?: number | null; message?: string }>("/api/payments/paytm/check-qr", { sessionId: session.sessionId });
        if (stop) return;
        if (r.status === "paid") {
          setState("paid");
          if (r.balance != null) useUserStore.setState((s) => (s.user ? { user: { ...s.user, wallet: Number(r.balance) } } : s));
          qc.invalidateQueries({ queryKey: ["wallet"] });
          toast.success(`Payment received — wallet credited ₹${session.amount.toFixed(2)}`);
        } else if (r.status === "failed") {
          setState("failed");
          toast.error(r.message || "Payment failed");
        } else if (r.status === "expired") {
          setState("expired");
        } else if (r.status === "token_expired") {
          setVerifyMessage(r.message ?? "");
        }
      } catch {
        /* keep polling */
      }
    };
    const t = setInterval(poll, 5000);
    poll();
    return () => {
      stop = true;
      clearInterval(t);
    };
  }, [session, state, qc]);

  const start = async () => {
    if (amount < 10) return toast.error("Minimum ₹10");
    setBusy(true);
    try {
      const r = await api.post<PaytmSession>("/api/payments/paytm/create-qr", { amount, provider });
      setSession(r);
      setUtrValue("");
      setUtrSent(false);
      setVerifyMessage("");
      setState("waiting");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not create QR");
    } finally {
      setBusy(false);
    }
  };

  const confirmUtr = async () => {
    if (!session) return;
    setUtrBusy(true);
    try {
      const r = await api.post<{ credited: boolean; balance?: number | null }>("/api/payments/paytm/submit-utr", { sessionId: session.sessionId, utr: utrValue.trim() });
      if (r.credited) {
        setState("paid");
        if (r.balance != null) useUserStore.setState((s) => (s.user ? { user: { ...s.user, wallet: Number(r.balance) } } : s));
        qc.invalidateQueries({ queryKey: ["wallet"] });
        toast.success("Payment confirmed — wallet credited");
      } else {
        setUtrSent(true);
        toast.success("UTR submitted — verifying payment");
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not submit UTR");
    } finally {
      setUtrBusy(false);
    }
  };

  const qrSrc = session
    ? session.qrImage
      ? session.qrImage.startsWith("data:") || session.qrImage.startsWith("http")
        ? session.qrImage
        : `data:image/png;base64,${session.qrImage}`
      : `https://api.qrserver.com/v1/create-qr-code/?size=260x260&data=${encodeURIComponent(session.qrData)}`
    : "";

  const mmss = `${Math.floor(left / 60)}:${String(left % 60).padStart(2, "0")}`;

  return (
    <div className="mb-5 rounded-xl border border-primary/25 bg-primary/5 p-4">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h3 className="font-semibold">{title}</h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            Scan the QR or open your UPI app directly. Each payment request is valid for{" "}
            <span className="font-medium">{session?.ttlMinutes ?? ttlMinutes} minutes</span>.
          </p>
        </div>
        {state !== "waiting" && (
          <Button size="lg" className="gradient-brand" onClick={start} disabled={busy}>
            {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            {state === "idle" ? `Generate QR for ₹${amount}` : "Generate new QR"}
          </Button>
        )}
      </div>

      {state !== "waiting" && (
        <div className="mt-3">
          <AmountBlock amount={amount} setAmount={setAmount} presets={presets} />
        </div>
      )}

      {session && state === "waiting" && (
        <div className="mt-4 grid gap-4 md:grid-cols-[240px_1fr] items-start">
          <div className="rounded-xl border bg-white p-3 grid place-items-center">
            <img src={qrSrc} alt={`QR for ₹${session.amount}`} width={220} height={220} className="rounded-md object-contain" />
          </div>
          <div className="space-y-3">
            <p className="text-sm font-semibold">Pay exactly ₹{session.amount.toFixed(2)}</p>
            <p className="text-[11px] text-muted-foreground">Pay the exact amount shown — this is how your payment gets auto-matched.</p>
            <Badge variant="outline" className="gap-1 border-warning/40 text-warning"><Clock className="h-3 w-3" />Expires in {mmss}</Badge>
            {showUpiApps && (
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                <Button size="sm" className="min-w-0" onClick={() => openUpiApp("com.google.android.apps.nbu.paisa.user")}>
                  <Smartphone className="mr-1.5 h-4 w-4" />Google Pay
                </Button>
                <Button size="sm" variant="outline" className="min-w-0" onClick={() => openUpiApp("net.one97.paytm")}>
                  <Smartphone className="mr-1.5 h-4 w-4" />Paytm
                </Button>
                <Button size="sm" variant="outline" className="col-span-2 min-w-0 sm:col-span-1" onClick={() => openUpiApp()}>
                  <ExternalLink className="mr-1.5 h-4 w-4" />Other UPI
                </Button>
              </div>
            )}
            {session.upiId && (
              <div className="flex items-center gap-2">
                <code className="min-w-0 flex-1 break-all rounded-md border bg-muted/40 px-2 py-1.5 text-xs">{session.upiId}</code>
                <Button size="icon" variant="outline" onClick={() => { navigator.clipboard.writeText(session.upiId || ""); toast.success("UPI ID copied"); }}><Copy className="h-4 w-4" /></Button>
              </div>
            )}
            <p className="text-xs text-muted-foreground flex items-center gap-1.5">
              <Loader2 className="h-3 w-3 animate-spin" /> {utrSent ? "UTR received — verifying payment…" : "Waiting for payment confirmation…"}
            </p>
            {verifyMessage && (
              <p className="rounded-md border border-warning/40 bg-warning/10 p-2 text-xs text-warning">{verifyMessage}</p>
            )}
            <div className="rounded-lg border p-3 space-y-2 bg-background/60">
              <Label className="text-xs">Paid but not confirmed? Submit the UTR</Label>
              <div className="flex gap-2">
                <Input value={utrValue} onChange={(e) => setUtrValue(e.target.value)} placeholder="12-digit UTR / reference" className="font-mono text-xs" />
                <Button variant="outline" onClick={confirmUtr} disabled={utrBusy || utrValue.trim().length < 6}>
                  {utrBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : "Confirm"}
                </Button>
              </div>
            </div>
            <Button variant="ghost" size="sm" onClick={() => { setSession(null); setState("idle"); }}>Cancel</Button>
          </div>
        </div>
      )}

      {state === "paid" && (
        <div className="mt-4 rounded-lg border border-success/40 bg-success/10 p-3 text-sm flex items-center gap-2">
          <CheckCircle2 className="h-4 w-4 text-success" /> Payment successful — wallet credited.
        </div>
      )}
      {state === "expired" && (
        <div className="mt-4 rounded-lg border border-warning/40 bg-warning/10 p-3 text-sm flex items-center gap-2">
          <Clock className="h-4 w-4 text-warning" /> QR expired. Generate a new QR to pay.
        </div>
      )}
      {state === "failed" && (
        <div className="mt-4 rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-sm flex items-center gap-2">
          <XCircle className="h-4 w-4 text-destructive" /> Payment failed. Try again with a new QR.
        </div>
      )}
    </div>
  );
}
