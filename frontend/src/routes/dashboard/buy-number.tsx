import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { PageHeader } from "@/components/common/PageHeader";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { api } from "@/lib/apiClient";
import { useNotificationStore } from "@/store/notificationStore";
import { Search, Loader2, ShoppingCart, Copy, Check, Radio, Minus, Plus, Inbox, Server, Timer, X } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { timeAgo, useMoney } from "@/utils/format";
import { Flag, ServiceIcon } from "@/lib/icons";

interface PurchasedNumber {
  id: string;
  number: string;
  service: string;
  country: string;
  otp?: string | null;
  createdAt: string;
  expiresAt: string;
  providerName: string;
  providerServer: string;
  price: number;
  notified?: boolean;
}

interface Country { code: string; name: string; flag: string; priceFrom: number }

interface AvailableOtpService {
  id: string;
  externalId: string;
  name: string;
  icon: string;
  category: string;
  price: number;
  stock: number;
  providerId: string;
  providerName: string;
  serverLabel: string;
  countryCode: string;
  avgSpeedSec?: number | null;
  supportsMulti?: boolean;
}

type OtpMode = "single" | "multi";

const RESERVE_MS = 20 * 60 * 1000; // 20 minutes
const MIN_CANCEL_MS = 2 * 60 * 1000; // matches server-side guard

export default function BuyNumber() {
  const money = useMoney();
  const [qCountry, setQCountry] = useState("");
  const [qService, setQService] = useState("");
  const [country, setCountry] = useState<Country | null>(null);
  const [service, setService] = useState<AvailableOtpService | null>(null);
  const [quantity, setQuantity] = useState(1);
  const [otpMode, setOtpMode] = useState<OtpMode>("single");
  const [busy, setBusy] = useState(false);
  const [purchased, setPurchased] = useState<PurchasedNumber[]>([]);
  const [now, setNow] = useState(() => Date.now());
  const addNotification = useNotificationStore((s) => s.add);
  const queryClient = useQueryClient();
  const refundNotified = useState(() => new Set<string>())[0];

  const countries = useQuery({ queryKey: ["catalog", "countries"], queryFn: () => api.get<Country[]>("/api/catalog/countries") });

  // Dedupe countries by name (Grizzly/Tiger/SmsBower each create a prefixed row).
  const uniqueCountries = useMemo(() => {
    const map = new Map<string, Country>();
    for (const c of countries.data ?? []) {
      const key = c.name.trim().toLowerCase();
      const cur = map.get(key);
      if (!cur || (c.priceFrom && c.priceFrom < cur.priceFrom)) {
        map.set(key, { code: c.code, name: c.name, flag: c.flag, priceFrom: c.priceFrom ?? 0 });
      }
    }
    return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name));
  }, [countries.data]);

  const liveServices = useQuery({
    queryKey: ["buy-otp-services", country?.name, qService.trim()],
    queryFn: () => api.post<AvailableOtpService[]>("/api/otp/services", { countryName: country!.name, q: qService }),
    enabled: !!country && qService.trim().length >= 2,
    refetchInterval: 15000,
    refetchIntervalInBackground: true,
    refetchOnWindowFocus: true,
    staleTime: 0,
  });

  const fCountries = uniqueCountries.filter((c) => c.name.toLowerCase().includes(qCountry.trim().toLowerCase()));
  const baseName = (name: string) => name.replace(/\s*·\s*Server\s+\d+[A-Z]?$/i, "").trim();

  const serverOffers = useMemo(() => {
    const speed = (s: AvailableOtpService) => (typeof s.avgSpeedSec === "number" && s.avgSpeedSec > 0 ? s.avgSpeedSec : Number.POSITIVE_INFINITY);
    const filtered = (liveServices.data ?? []).filter((s) => (otpMode === "multi" ? s.supportsMulti : true));
    return [...filtered].sort((a, b) => speed(a) - speed(b) || a.price - b.price);
  }, [liveServices.data, otpMode]);

  // Whichever server has a real, measured fastest delivery time (recorded
  // automatically from actual past OTP deliveries — see backend
  // lib/providers/stats.ts) gets highlighted, so the fastest option
  // literally rises to the top and stands out without the buyer having to
  // compare timestamps themselves.
  const fastestKey = useMemo(() => {
    const withSpeed = serverOffers.filter((s) => typeof s.avgSpeedSec === "number" && s.avgSpeedSec > 0);
    if (withSpeed.length < 2) return null; // nothing to compare against
    return `${withSpeed[0].providerId}:${withSpeed[0].id}`;
  }, [serverOffers]);

  const unitPrice = useMemo(() => (service ? Number(service.price.toFixed(2)) : 0), [service]);
  const total = Number((unitPrice * quantity).toFixed(2));

  useEffect(() => {
    setService(null);
  }, [country?.name, qService]);

  useEffect(() => {
    if (!service || !liveServices.data?.length) return;
    const fresh = liveServices.data.find((s) => s.providerId === service.providerId && s.id === service.id);
    if (fresh && (fresh.price !== service.price || fresh.stock !== service.stock)) setService(fresh);
  }, [liveServices.data, service]);

  const buy = async () => {
    if (!service || !country) {
      toast.error("Pick country and service");
      return;
    }
    setBusy(true);
    try {
      const latest = await liveServices.refetch();
      const fresh = latest.data?.find((s) => s.providerId === service.providerId && s.id === service.id) ?? service;
      setService(fresh);
      type BuyResult = { id: string; number: string; service: string; country: string; createdAt: string; expiresAt: string; providerName: string; providerServer: string; price: number };
      // allSettled, not all — each call is its own independent wallet debit
      // + order on the backend. With Promise.all, one failure partway
      // through a multi-buy discarded every already-succeeded (already
      // charged!) result and showed only a single error toast, making
      // real charges invisible on this screen (only found by navigating to
      // Orders separately).
      const results = await Promise.allSettled(
        Array.from({ length: quantity }, () =>
          api.post<BuyResult>("/api/otp/buy", { providerId: fresh.providerId, countryCode: fresh.countryCode, serviceId: fresh.id }),
        ),
      );
      const succeeded = results
        .filter((r): r is PromiseFulfilledResult<BuyResult> => r.status === "fulfilled")
        .map((r) => r.value);
      const failed = results.filter((r): r is PromiseRejectedResult => r.status === "rejected");

      if (succeeded.length > 0) {
        const rows: PurchasedNumber[] = succeeded.map((r) => ({
          id: r.id,
          number: r.number,
          service: r.service,
          country: r.country,
          createdAt: r.createdAt,
          expiresAt: r.expiresAt ?? new Date(Date.now() + RESERVE_MS).toISOString(),
          providerName: r.providerName,
          providerServer: r.providerServer,
          price: r.price,
          otp: null,
        }));
        setPurchased((p) => [...rows, ...p]);
        if (rows[0]?.number) {
          navigator.clipboard.writeText(rows[0].number).catch(() => {});
        }
        queryClient.invalidateQueries({ queryKey: ["wallet"] });
      }

      if (failed.length === 0) {
        toast.success(`${quantity} number${quantity > 1 ? "s" : ""} reserved`);
      } else if (succeeded.length > 0) {
        const reason = failed[0].reason instanceof Error ? failed[0].reason.message : "unknown error";
        toast.warning(`${succeeded.length}/${quantity} reserved — ${failed.length} failed (${reason}). Charged numbers are listed below.`);
      } else {
        const reason = failed[0].reason instanceof Error ? failed[0].reason.message : "Purchase failed";
        toast.error(reason);
      }
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => {
    if (purchased.length === 0) return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [purchased.length]);

  useEffect(() => {
    const waiting = purchased.filter((p) => !p.otp);
    if (waiting.length === 0) return;
    const poll = async () => {
      const statuses = await Promise.allSettled(
        waiting.map((p) => api.post<{ status: string; otp: string | null }>("/api/otp/status", { orderId: p.id })),
      );
      const byId = new Map<string, string>();
      statuses.forEach((result, i) => {
        if (result.status === "fulfilled" && result.value.otp) byId.set(waiting[i].id, result.value.otp);
      });
      if (byId.size === 0) return;
      setPurchased((prev) =>
        prev.map((p) => {
          const otp = byId.get(p.id);
          if (!otp || p.otp) return p;
          addNotification({ title: `OTP received · ${p.service}`, body: `Code ${otp} for ${p.number}`, type: "success" });
          toast.success(`OTP ${otp} received · ${p.service}`);
          return { ...p, otp, notified: true };
        }),
      );
    };
    poll();
    const t = setInterval(poll, 2000);
    return () => clearInterval(t);
  }, [purchased, addNotification]);

  useEffect(() => {
    const expired = purchased.filter((p) => !p.otp && new Date(p.expiresAt).getTime() <= now);
    if (expired.length === 0) return;
    for (const row of expired) {
      if (refundNotified.has(row.id)) continue;
      refundNotified.add(row.id);
      cancelAndRefund(row.id, true).then((refunded) => {
        if (refunded) {
          toast.message(`${row.service} expired · ₹${row.price.toFixed(2)} refunded`);
        } else {
          // The cancel didn't actually succeed (most likely the OTP arrived
          // right at the expiry boundary and the order is now fulfilled,
          // not refundable) — never claim money moved when it didn't.
          toast.error(`${row.service} expired — couldn't confirm a refund. Check your Orders page.`);
        }
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [now]);

  const copy = (v: string, label = "Copied") => {
    navigator.clipboard.writeText(v);
    toast.success(label);
  };
  /** Returns whether a refund actually happened — callers must not claim
   * success without checking this. Previously `silent` mode swallowed every
   * error with no way for the caller to tell, so the auto-expiry effect
   * below showed "refunded" unconditionally even when the cancel request
   * failed (e.g. the OTP arrived at the exact moment of expiry, so the
   * backend correctly refuses to cancel an already-fulfilled order — no
   * refund happens, but the UI said one did). */
  const cancelAndRefund = async (id: string, silent = false): Promise<boolean> => {
    const row = purchased.find((p) => p.id === id);
    if (!row) return false;
    if (row.otp) {
      setPurchased((p) => p.filter((x) => x.id !== id));
      return false;
    }
    try {
      const res = await api.post<{ refunded: boolean }>("/api/otp/cancel", { orderId: id });
      setPurchased((p) => p.filter((x) => x.id !== id));
      queryClient.invalidateQueries({ queryKey: ["wallet"] });
      if (res.refunded && !silent) toast.success(`Number cancelled · ₹${row.price.toFixed(2)} refunded`);
      return Boolean(res.refunded);
    } catch (e) {
      if (!silent) toast.error((e as Error).message);
      return false;
    }
  };
  const fmtRemaining = (iso: string) => {
    const ms = Math.max(0, new Date(iso).getTime() - now);
    const m = Math.floor(ms / 60000);
    const s = Math.floor((ms % 60000) / 1000);
    return `${m}:${s.toString().padStart(2, "0")}`;
  };

  return (
    <div>
      <PageHeader title="Buy a number" description="Pick country, service and quantity — everything in one screen." />
      {/* SMM Panel button hidden — not ready yet ("abhi kaam nahi hai
          usme"). See dashboard/index.tsx for the other spot it appeared. */}
      <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
        <div className="space-y-6">
          <Card className="shadow-soft"><CardContent className="p-5">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold text-sm">1. Country</h3>
              {country && <Badge variant="secondary" className="gap-1.5"><Flag name={country.name} className="h-3.5 w-5" />{country.name}</Badge>}
            </div>
            <div className="relative mb-3">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Search countries…" value={qCountry} onChange={(e) => setQCountry(e.target.value)} className="pl-9 h-9" />
            </div>
            <div className="grid gap-2 grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 max-h-[240px] overflow-auto pr-1">
              {fCountries.map((c) => (
                <button key={c.code} type="button" onClick={() => { setCountry(c); setService(null); }}
                  className={cn("flex items-center gap-2 rounded-xl border p-2.5 text-left hover:border-primary/60 transition", country?.code === c.code && "border-primary bg-primary/5")}>
                  <Flag name={c.name} className="h-5 w-7 shrink-0" />
                  <p className="text-xs font-medium truncate">{c.name}</p>
                </button>
              ))}
            </div>
          </CardContent></Card>

          <Card className="shadow-soft"><CardContent className="p-5">
            <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
              <h3 className="font-semibold text-sm">2. Service</h3>
              {service && <Badge variant="secondary" className="gap-1.5"><ServiceIcon name={service.name} className="h-3.5 w-3.5" />{baseName(service.name)} · {service.serverLabel} · {money(service.price)}</Badge>}
            </div>
            <div className="mb-3 inline-flex rounded-lg border p-0.5 bg-muted/40">
              {(["single", "multi"] as OtpMode[]).map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => { setOtpMode(m); setService(null); }}
                  className={cn(
                    "px-3 py-1.5 text-xs font-medium rounded-md transition",
                    otpMode === m ? "bg-background shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  {m === "single" ? "Single OTP" : "Multi OTP"}
                </button>
              ))}
              <span className="px-2 py-1.5 text-[10px] text-muted-foreground self-center hidden sm:inline">
                {otpMode === "multi" ? "Numbers that can receive multiple OTPs" : "Standard one-time OTP"}
              </span>
            </div>
            {!country && <p className="text-xs text-muted-foreground mb-2">Pick a country first.</p>}
            <div className="relative mb-3">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input disabled={!country} placeholder="Search service (e.g. WhatsApp, Telegram)…" value={qService} onChange={(e) => setQService(e.target.value)} className="pl-9 h-9" />
            </div>
            <div className="max-h-[340px] overflow-auto rounded-lg border">
              {country && qService.trim().length < 2 && (
                <p className="text-xs text-muted-foreground py-8 text-center px-4">Type at least 2 letters to search across all servers.</p>
              )}
              {country && qService.trim().length >= 2 && serverOffers.length === 0 && (
                <p className="text-xs text-muted-foreground py-8 text-center px-4">
                  {liveServices.isFetching
                    ? "Loading live services…"
                    : otpMode === "multi"
                      ? `No multi-OTP capable server matches "${qService}". Try Single OTP tab.`
                      : `No service matches "${qService}".`}
                </p>
              )}
              {serverOffers.slice(0, 500).map((s) => {
                const key = `${s.providerId}:${s.id}`;
                const isFastest = key === fastestKey;
                return (
                  <button key={key} type="button" onClick={() => setService(s)}
                    className={cn("flex w-full items-center gap-3 border-b p-3 text-left last:border-b-0 hover:bg-accent/50 transition", service?.id === s.id && "bg-primary/5", isFastest && "bg-success/5")}>
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-muted">
                      <ServiceIcon name={s.name} className="h-6 w-6" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-medium truncate flex items-center gap-1.5" title={s.name}>
                        {baseName(s.name)}
                        {s.supportsMulti && <Badge variant="outline" className="h-4 px-1 text-[9px] font-normal border-primary/40 text-primary">MULTI</Badge>}
                        {isFastest && <Badge className="h-4 px-1 text-[9px] font-normal bg-success/15 text-success border-success/30" variant="outline">FASTEST</Badge>}
                      </span>
                      <span className="block text-[11px] text-muted-foreground truncate flex items-center gap-1">
                        <Server className="h-2.5 w-2.5" />{s.serverLabel} · {s.stock.toLocaleString("en-IN")} in stock
                        {typeof s.avgSpeedSec === "number" && s.avgSpeedSec > 0 && (
                          <span className={cn("ml-1 inline-flex items-center gap-0.5", isFastest ? "text-success font-medium" : "text-success")}>· ⚡ {Math.round(s.avgSpeedSec)}s avg</span>
                        )}
                      </span>
                    </span>
                    <span className="shrink-0 text-sm font-semibold tabular-nums">{money(s.price)}</span>
                  </button>
                );
              })}
            </div>
          </CardContent></Card>

          {purchased.length > 0 && (
            <Card className="shadow-soft border-primary/20"><CardContent className="p-5">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <h3 className="font-semibold text-sm">Your active numbers</h3>
                  <p className="text-xs text-muted-foreground">OTPs appear here in real time.</p>
                </div>
                <Badge variant="secondary" className="gap-1"><Radio className="h-3 w-3 text-success animate-pulse" />Live</Badge>
              </div>
              <div className="space-y-2">
                {purchased.map((p) => (
                  <div key={p.id} className="flex flex-wrap items-center gap-3 rounded-lg border bg-background p-3">
                    <div className="min-w-0 flex-1">
                      <button
                        type="button"
                        onClick={() => copy(p.number, "Number copied")}
                        className="font-mono text-sm font-semibold truncate hover:text-primary transition-colors text-left inline-flex items-center gap-1.5"
                        title="Tap to copy"
                      >
                        {p.number}
                        <Copy className="h-3 w-3 opacity-60" />
                      </button>
                      <p className="text-xs text-muted-foreground truncate">{p.service} · {p.country} · {timeAgo(p.createdAt)}</p>
                      <div className="mt-1 flex flex-wrap items-center gap-1.5">
                        <Badge variant="outline" className="gap-1 text-[10px] font-normal">
                          <Server className="h-3 w-3" />{p.providerName} <span className="text-muted-foreground">· {p.providerServer}</span>
                        </Badge>
                        <Badge variant="outline" className="gap-1 text-[10px] font-normal">
                          <Timer className="h-3 w-3" />{p.otp ? "delivered" : `expires in ${fmtRemaining(p.expiresAt)}`}
                        </Badge>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {p.otp ? (
                        <button
                          type="button"
                          onClick={() => copy(p.otp!, "OTP copied")}
                          className="font-mono font-bold text-primary text-lg tabular-nums hover:opacity-80 transition inline-flex items-center gap-1.5"
                          title="Tap to copy OTP"
                        >
                          {p.otp}
                          <Copy className="h-4 w-4" />
                        </button>
                      ) : <span className="text-xs text-muted-foreground italic">waiting for OTP…</span>}
                      {(() => {
                        const ageMs = now - new Date(p.createdAt).getTime();
                        const canCancel = !!p.otp || ageMs >= MIN_CANCEL_MS;
                        const wait = Math.max(0, Math.ceil((MIN_CANCEL_MS - ageMs) / 1000));
                        return (
                          <Button
                            size="sm"
                            variant="ghost"
                            disabled={!canCancel}
                            onClick={() => {
                              if (!p.otp && !confirm(`Cancel this number and refund ₹${p.price.toFixed(2)}?`)) return;
                              cancelAndRefund(p.id);
                            }}
                            title={p.otp ? "Remove" : canCancel ? "Cancel & refund" : `Cancel available in ${wait}s`}
                          >
                            {canCancel ? <X className="h-3.5 w-3.5" /> : <span className="text-[11px] tabular-nums">{wait}s</span>}
                          </Button>
                        );
                      })()}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent></Card>
          )}
        </div>

        <Card className="shadow-glow border-primary/10 h-fit lg:sticky lg:top-24">
          <CardContent className="p-5">
            <h3 className="font-semibold mb-4">Order summary</h3>
            <div className="space-y-3 text-sm">
              <Row k="Country" v={country ? (<span className="inline-flex items-center gap-1.5"><Flag name={country.name} className="h-3.5 w-5" />{country.name}</span>) : "—"} />
              <Row k="Service" v={service ? (<span className="inline-flex items-center gap-1.5"><ServiceIcon name={service.name} className="h-4 w-4" />{service.name}</span>) : "—"} />
              <Row k="Server" v={service ? service.serverLabel : "—"} />
              <Row k="Type" v={<Badge variant="outline">Virtual · OTP</Badge>} />

              <div>
                <Label className="text-xs">Quantity</Label>
                <div className="mt-1.5 flex items-center gap-2">
                  <Button size="icon" variant="outline" className="h-8 w-8" onClick={() => setQuantity((q) => Math.max(1, q - 1))}><Minus className="h-3.5 w-3.5" /></Button>
                  <Input type="number" min={1} max={50} value={quantity}
                    onChange={(e) => setQuantity(Math.max(1, Math.min(50, Number(e.target.value) || 1)))}
                    className="h-8 w-16 text-center font-semibold" />
                  <Button size="icon" variant="outline" className="h-8 w-8" onClick={() => setQuantity((q) => Math.min(50, q + 1))}><Plus className="h-3.5 w-3.5" /></Button>
                  <span className="text-xs text-muted-foreground">numbers</span>
                </div>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {[1, 5, 10, 25].map((n) => (
                    <Button key={n} size="sm" variant={quantity === n ? "default" : "outline"} className="h-6 px-2 text-xs" onClick={() => setQuantity(n)}>{n}×</Button>
                  ))}
                </div>
              </div>

              <div className="border-t pt-3 space-y-1.5">
                <Row k="Unit price" v={money(unitPrice)} />
                <Row k="Quantity" v={`× ${quantity}`} />
                <div className="flex items-center justify-between pt-1 text-base font-semibold">
                  <span>Total</span><span>{money(total)}</span>
                </div>
              </div>
            </div>
            <Button className="mt-5 w-full gradient-brand" size="lg" disabled={busy || !country || !service} onClick={buy}>
              {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <ShoppingCart className="mr-2 h-4 w-4" />}
              Buy {quantity} number{quantity > 1 ? "s" : ""}
            </Button>
            <div className="mt-3 rounded-lg bg-muted/40 p-3 text-[11px] text-muted-foreground flex gap-2">
              <Check className="h-3.5 w-3.5 mt-0.5 shrink-0 text-success" />
              <span>Numbers reserved for 20 min.</span>
            </div>
            <div className="mt-2 rounded-lg bg-muted/40 p-3 text-[11px] text-muted-foreground flex gap-2">
              <Inbox className="h-3.5 w-3.5 mt-0.5 shrink-0" />
              <span>OTPs also appear in your <a href="/dashboard/otp-inbox" className="text-primary underline">OTP Inbox</a>.</span>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function Row({ k, v }: { k: string; v: React.ReactNode }) {
  return <div className="flex items-center justify-between"><span className="text-muted-foreground">{k}</span><span className="font-medium">{v}</span></div>;
}
