import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { PageHeader } from "@/components/common/PageHeader";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Star, Copy, X, AlertTriangle, Check, RefreshCw, Layers, CheckCircle2, Timer } from "lucide-react";
import { api } from "@/lib/apiClient";
import { useMoney, timeAgo } from "@/utils/format";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { UserProfileDialog } from "@/components/mp/UserProfileDialog";

// Deliberately simple, single flow — no marketplace to browse/filter/sort
// through: "isme 1 hi chij rakhni hai, jisse user ko service lene me issue
// na ho". Pick country → pick (or type) a service → single/multi OTP →
// optional price → post. Every matching online seller gets notified and
// bids; the buyer picks whichever offer they like.
const COUNTRY_KEY = "tenotp_mp_last_country";

const copy = (v: string, label: string) => { navigator.clipboard.writeText(v); toast.success(label); };

interface MpRequest {
  id: string; code: string; providerId: string; serviceName: string; country: string; price: number | null;
  status: string; number: string | null; otpCode: string | null; resultNote: string | null; createdAt: string;
  assignExpiresAt: string | null; otpMode: "single" | "multi"; otpCount: number; otpAutoConfirmAt: string | null;
  quantity: number; numberType: "any" | "old" | "new";
}

const NUMBER_TYPE_LABEL: Record<string, string> = { any: "Any", old: "Old (used)", new: "New (fresh)" };

export default function ManualProvider() {
  const money = useMoney();
  const qc = useQueryClient();
  // "India ek baar hi select karega user" — remembered across visits.
  const [country, setCountry] = useState(() => { try { return localStorage.getItem(COUNTRY_KEY) || ""; } catch { return ""; } });
  useEffect(() => { try { if (country) localStorage.setItem(COUNTRY_KEY, country); } catch { /* ignore */ } }, [country]);

  const filters = useQuery({ queryKey: ["mp", "filters"], queryFn: () => api.get<{ countries: string[]; services: string[] }>("/api/manual-providers/services/filters") });
  // Full real catalog (thousands of services) — searched, never rendered
  // as one giant dropdown (that's what made this page slow before).
  const catalog = useQuery({ queryKey: ["mp", "catalog-services"], queryFn: () => api.get<{ services: string[] }>("/api/manual-providers/catalog-services") });

  const [service, setService] = useState("");
  const [servicePickerOpen, setServicePickerOpen] = useState(false);
  const serviceMatches = useMemo(() => {
    if (!catalog.data || service.trim().length < 2) return [];
    const q = service.trim().toLowerCase();
    return catalog.data.services.filter((s) => s.toLowerCase().includes(q)).slice(0, 20);
  }, [catalog.data, service]);
  const [otpMode, setOtpMode] = useState<"single" | "multi">("single");
  const [bidPrice, setBidPrice] = useState("");
  const [quantity, setQuantity] = useState("1");
  const [numberType, setNumberType] = useState<"any" | "old" | "new">("any");

  const openRequestM = useMutation({
    mutationFn: () => api.post<{ requestId: string; code: string }>("/api/manual-providers/requests/open", {
      country, service, otpMode, buyerBidPrice: bidPrice.trim() ? Number(bidPrice) : undefined,
      quantity: Number(quantity) || 1, numberType,
    }),
    onSuccess: (r) => {
      toast.success(`${r.code} posted — sellers who offer this are being notified`);
      setService(""); setBidPrice(""); setQuantity("1"); setNumberType("any");
      qc.invalidateQueries({ queryKey: ["mp", "requests", "mine"] });
    },
    onError: (e: any) => toast.error(e?.message || "Could not post request"),
  });

  const myRequests = useQuery({
    queryKey: ["mp", "requests", "mine"],
    queryFn: () => api.get<MpRequest[]>("/api/manual-providers/requests/mine"),
    refetchInterval: 5000,
  });

  const cancelM = useMutation({
    mutationFn: (id: string) => api.post(`/api/manual-providers/requests/${id}/cancel`),
    onSuccess: () => { toast.success("Cancelled — refunded"); qc.invalidateQueries({ queryKey: ["mp", "requests", "mine"] }); qc.invalidateQueries({ queryKey: ["wallet"] }); },
    onError: (e: any) => toast.error(e?.message || "Could not cancel"),
  });
  const declineQuoteM = useMutation({
    mutationFn: (id: string) => api.post(`/api/manual-providers/requests/${id}/decline-quote`),
    onSuccess: () => { toast.success("Declined"); qc.invalidateQueries({ queryKey: ["mp", "requests", "mine"] }); },
    onError: (e: any) => toast.error(e?.message || "Could not decline"),
  });
  const confirmOtpM = useMutation({
    mutationFn: (id: string) => api.post(`/api/manual-providers/requests/${id}/confirm-otp`),
    onSuccess: () => { toast.success("Confirmed — marked done"); qc.invalidateQueries({ queryKey: ["mp", "requests", "mine"] }); },
    onError: (e: any) => toast.error(e?.message || "Could not confirm"),
  });
  const resendOtpM = useMutation({
    mutationFn: (v: { id: string; reason: "wrong" | "need_another" }) => api.post(`/api/manual-providers/requests/${v.id}/resend-otp`, { reason: v.reason }),
    onSuccess: () => { toast.success("Asked the seller to send it again"); qc.invalidateQueries({ queryKey: ["mp", "requests", "mine"] }); },
    onError: (e: any) => toast.error(e?.message || "Could not ask for a resend"),
  });

  const activeRequests = (myRequests.data ?? []).filter((r) => !["cancelled", "refunded"].includes(r.status));
  const pastRequests = (myRequests.data ?? []).filter((r) => ["cancelled", "refunded", "completed", "failed"].includes(r.status)).slice(0, 10);

  return (
    <div>
      <PageHeader title="Manual Provider" description="Post what you need — every seller who offers it gets notified and bids, you pick whichever offer you like." />

      <Card className="shadow-soft mb-6 border-primary/20">
        <CardContent className="p-4 space-y-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="grid gap-1.5">
              <Label>Country</Label>
              <Select value={country} onValueChange={setCountry}>
                <SelectTrigger><SelectValue placeholder="Pick a country" /></SelectTrigger>
                <SelectContent>{(filters.data?.countries ?? []).map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="grid gap-1.5 relative">
              <Label>Service</Label>
              <Input
                placeholder="Search or type the service name…" value={service}
                onChange={(e) => { setService(e.target.value); setServicePickerOpen(true); }}
                onFocus={() => setServicePickerOpen(true)}
              />
              {servicePickerOpen && service.trim().length >= 2 && serviceMatches.length > 0 && (
                <div className="absolute z-10 top-full mt-1 w-full rounded-lg border bg-popover shadow-lg max-h-56 overflow-auto">
                  {serviceMatches.map((s) => (
                    <button key={s} type="button" className="block w-full text-left px-3 py-1.5 text-sm hover:bg-accent" onClick={() => { setService(s); setServicePickerOpen(false); }}>{s}</button>
                  ))}
                </div>
              )}
              <p className="text-[11px] text-muted-foreground">Not in the list? Just type its name — an exact match isn't required.</p>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="grid gap-1.5">
              <Label>How many OTPs will you need?</Label>
              <div className="flex gap-2">
                <Button type="button" size="sm" variant={otpMode === "single" ? "default" : "outline"} className={otpMode === "single" ? "gradient-brand flex-1" : "flex-1"} onClick={() => setOtpMode("single")}>Just one</Button>
                <Button type="button" size="sm" variant={otpMode === "multi" ? "default" : "outline"} className={otpMode === "multi" ? "gradient-brand flex-1" : "flex-1"} onClick={() => setOtpMode("multi")}>
                  <Layers className="h-3.5 w-3.5 mr-1" />More than one
                </Button>
              </div>
            </div>
            <div className="grid gap-1.5">
              <Label>Your price (optional)</Label>
              <Input type="number" min={0} step="0.01" placeholder="Leave blank to let sellers decide" value={bidPrice} onChange={(e) => setBidPrice(e.target.value)} />
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="grid gap-1.5">
              <Label>How many numbers do you need?</Label>
              <Input type="number" min={1} step="1" value={quantity} onChange={(e) => setQuantity(e.target.value)} />
            </div>
            <div className="grid gap-1.5">
              <Label>Old or new number?</Label>
              <div className="flex gap-2">
                {(["any", "old", "new"] as const).map((t) => (
                  <Button key={t} type="button" size="sm" variant={numberType === t ? "default" : "outline"} className={numberType === t ? "gradient-brand flex-1" : "flex-1"} onClick={() => setNumberType(t)}>
                    {NUMBER_TYPE_LABEL[t]}
                  </Button>
                ))}
              </div>
            </div>
          </div>

          <Button
            className="gradient-brand w-full sm:w-auto"
            disabled={!country || !service.trim() || openRequestM.isPending}
            onClick={() => openRequestM.mutate()}
          >
            {openRequestM.isPending ? "Posting…" : "Post request"}
          </Button>
        </CardContent>
      </Card>

      {activeRequests.length > 0 && (
        <div className="mb-6 space-y-2">
          <h3 className="text-sm font-semibold">Your requests</h3>
          {activeRequests.map((r) => (
            <RequestRow
              key={r.id} r={r} money={money}
              onCancel={() => cancelM.mutate(r.id)} cancelling={cancelM.isPending}
              onDeclineQuote={() => declineQuoteM.mutate(r.id)} decliningQuote={declineQuoteM.isPending}
              onConfirmOtp={() => confirmOtpM.mutate(r.id)} confirmingOtp={confirmOtpM.isPending}
              onResendOtp={(reason) => resendOtpM.mutate({ id: r.id, reason })} resendingOtp={resendOtpM.isPending}
            />
          ))}
        </div>
      )}

      {pastRequests.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-sm font-semibold text-muted-foreground">Past requests</h3>
          {pastRequests.map((r) => (
            <Card key={r.id} className="shadow-soft">
              <CardContent className="p-3 flex items-center justify-between gap-2 text-sm">
                <span className="truncate">{r.serviceName} · {r.country} · <span className="capitalize text-muted-foreground">{r.status}</span></span>
                <span className="text-muted-foreground shrink-0">{timeAgo(r.createdAt)}</span>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {myRequests.data?.length === 0 && (
        <div className="py-16 text-center text-sm text-muted-foreground">No requests yet — post one above to get started.</div>
      )}
    </div>
  );
}

function RequestRow({ r, money, onCancel, cancelling, onDeclineQuote, decliningQuote, onConfirmOtp, confirmingOtp, onResendOtp, resendingOtp }: {
  r: MpRequest; money: (n: number) => string; onCancel: () => void; cancelling: boolean;
  onDeclineQuote: () => void; decliningQuote: boolean;
  onConfirmOtp: () => void; confirmingOtp: boolean;
  onResendOtp: (reason: "wrong" | "need_another") => void; resendingOtp: boolean;
}) {
  const qc = useQueryClient();
  // Ticks once a second only while there's an active countdown to show —
  // both deadlines are real (backend auto-sweeps past them), not cosmetic.
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!(r.status === "assigned" && r.assignExpiresAt) && !(r.status === "otp_sent" && r.otpAutoConfirmAt)) return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [r.status, r.assignExpiresAt, r.otpAutoConfirmAt]);
  const [disputeOpen, setDisputeOpen] = useState(false);
  const [reviewOpen, setReviewOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [proofFile, setProofFile] = useState<File | null>(null);
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState("");
  // "already used" is a claim against a specific promise (numberType ===
  // "new") — serious enough that it needs a screenshot, not just taken on
  // the buyer's word, right there in the same dialog at the same time.
  const proofRequired = reason === "Number was already used";

  const disputeM = useMutation({
    mutationFn: async () => {
      let proofImage: string | null = null;
      if (proofFile) {
        proofImage = await new Promise<string>((resolve, reject) => {
          const fr = new FileReader();
          fr.onload = () => resolve(String(fr.result));
          fr.onerror = reject;
          fr.readAsDataURL(proofFile);
        });
      }
      return api.post(`/api/manual-providers/requests/${r.id}/dispute`, { reason, proofImage });
    },
    onSuccess: () => { toast.success("Dispute opened — the seller will review it"); setDisputeOpen(false); setReason(""); setProofFile(null); qc.invalidateQueries({ queryKey: ["mp", "requests", "mine"] }); },
    onError: (e: any) => toast.error(e?.message || "Could not open dispute"),
  });

  const reviewM = useMutation({
    mutationFn: () => api.post(`/api/manual-providers/requests/${r.id}/review`, { rating, comment }),
    onSuccess: () => { toast.success("Thanks for the review"); setReviewOpen(false); },
    onError: (e: any) => toast.error(e?.message || "Could not submit review"),
  });

  const countdown = (target: string) => {
    const msLeft = new Date(target).getTime() - now;
    if (msLeft <= 0) return null;
    const m = Math.floor(msLeft / 60000);
    const s = Math.floor((msLeft % 60000) / 1000);
    return `${m}:${s.toString().padStart(2, "0")}`;
  };

  return (
    <Card className="shadow-soft border-primary/20">
      <CardContent className="p-4 flex flex-wrap items-center gap-3">
        <div className="min-w-0 flex-1">
          <p className="font-mono text-xs text-muted-foreground">{r.code}</p>
          <p className="text-sm font-medium">
            {r.serviceName} · {r.country} · {r.price === null ? <span className="text-muted-foreground italic">awaiting price</span> : money(r.price)}
            {r.quantity > 1 && <Badge variant="outline" className="ml-1.5 text-[10px] align-middle">{r.quantity}x</Badge>}
            {r.numberType !== "any" && <Badge variant="outline" className="ml-1.5 text-[10px] align-middle capitalize">{r.numberType}</Badge>}
            {r.otpMode === "multi" && <Badge variant="outline" className="ml-1.5 text-[10px] align-middle">multi-OTP</Badge>}
          </p>
          <p className="text-xs text-muted-foreground">
            {timeAgo(r.createdAt)} · status: <span className="capitalize">{r.status.replace("_", " ")}</span>
            {r.status === "assigned" && r.assignExpiresAt && (() => {
              const c = countdown(r.assignExpiresAt!);
              return c ? <span className="text-warning"> · auto-refund in {c} if not started</span> : <span className="text-warning"> · refunding…</span>;
            })()}
            {r.status === "otp_sent" && r.otpAutoConfirmAt && (() => {
              const c = countdown(r.otpAutoConfirmAt!);
              return c ? <span className="text-warning"> · auto-confirms in {c}</span> : null;
            })()}
          </p>
        </div>

        {r.number && (
          <button type="button" onClick={() => copy(r.number!, "Number copied")} className="font-mono text-sm rounded-lg border px-2.5 py-1.5 hover:border-primary/60 flex items-center gap-1.5">
            {r.number}<Copy className="h-3 w-3 opacity-60" />
          </button>
        )}
        {r.otpCode && (r.status === "otp_sent" || r.status === "completed") ? (
          <button type="button" onClick={() => copy(r.otpCode!, "OTP copied")} className="font-mono font-bold text-primary text-lg rounded-lg border border-primary/40 px-2.5 py-1.5 hover:opacity-80 flex items-center gap-1.5">
            {r.otpCode}<Copy className="h-4 w-4" />
          </button>
        ) : r.status === "in_progress" ? (
          <span className="text-xs text-muted-foreground italic">waiting for OTP…</span>
        ) : null}

        <div className="flex items-center gap-1.5 flex-wrap">
          {r.status === "open" && <BidsPanel requestId={r.id} money={money} onDecline={onDeclineQuote} declining={decliningQuote} />}
          {r.status === "quote_requested" && (
            <>
              <span className="text-xs text-muted-foreground italic">waiting for seller's price…</span>
              <Button size="sm" variant="outline" className="text-destructive" disabled={decliningQuote} onClick={onDeclineQuote}>
                <X className="h-3.5 w-3.5 mr-1" />Cancel
              </Button>
            </>
          )}
          {r.status === "assigned" && (
            <Button size="sm" variant="outline" className="text-destructive" disabled={cancelling} onClick={() => { if (confirm(`Cancel this request and refund ${r.price !== null ? money(r.price) : ""}?`)) onCancel(); }}>
              <X className="h-3.5 w-3.5 mr-1" />Cancel
            </Button>
          )}
          {r.status === "otp_sent" && (
            <>
              <Button size="sm" className="gradient-brand" disabled={confirmingOtp} onClick={onConfirmOtp}>
                <Check className="h-3.5 w-3.5 mr-1" />{confirmingOtp ? "Confirming…" : "Confirm — this is right"}
              </Button>
              <Button size="sm" variant="outline" className="text-destructive" disabled={resendingOtp} onClick={() => onResendOtp("wrong")}>
                <RefreshCw className="h-3.5 w-3.5 mr-1" />Wrong, resend
              </Button>
              {r.otpMode === "multi" && (
                <Button size="sm" variant="outline" disabled={resendingOtp} onClick={() => onResendOtp("need_another")}>
                  <Layers className="h-3.5 w-3.5 mr-1" />I need another
                </Button>
              )}
            </>
          )}
          {(r.status === "completed" || r.status === "in_progress" || r.status === "otp_sent") && (
            <Button size="sm" variant="outline" className="text-warning" onClick={() => setDisputeOpen(true)}>
              <AlertTriangle className="h-3.5 w-3.5 mr-1" />Dispute
            </Button>
          )}
          {r.status === "completed" && (
            <Button size="sm" variant="outline" onClick={() => setReviewOpen(true)}><Star className="h-3.5 w-3.5 mr-1" />Review</Button>
          )}
          {r.status === "disputed" && <Badge variant="outline" className="text-warning">Dispute pending</Badge>}
        </div>
      </CardContent>

      <Dialog open={disputeOpen} onOpenChange={setDisputeOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Open a dispute</DialogTitle></DialogHeader>
          <div className="grid gap-3">
            <div className="grid gap-1.5">
              <Label>What went wrong?</Label>
              <div className="flex flex-wrap gap-1.5">
                {["Number was already used", "OTP didn't work", "Wrong number given", "Seller went silent"].map((preset) => (
                  <Button key={preset} type="button" size="sm" variant={reason === preset ? "default" : "outline"} className={reason === preset ? "gradient-brand h-7 px-2 text-xs" : "h-7 px-2 text-xs"} onClick={() => setReason(preset)}>
                    {preset}
                  </Button>
                ))}
              </div>
              <Input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Or describe it in your own words…" />
            </div>
            <div className="grid gap-1.5">
              <Label>Proof screenshot {proofRequired ? <span className="text-destructive">(required for this)</span> : "(optional)"}</Label>
              <Input type="file" accept="image/*" onChange={(e) => setProofFile(e.target.files?.[0] ?? null)} />
              {proofRequired && !proofFile && <p className="text-xs text-destructive">"Already used" claims need a screenshot as proof before this can be submitted.</p>}
            </div>
            <p className="text-xs text-muted-foreground">The seller reviews this and decides whether to refund you. Disputes are limited — false claims will exhaust your allowance.</p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDisputeOpen(false)}>Cancel</Button>
            <Button className="gradient-brand" disabled={!reason.trim() || (proofRequired && !proofFile) || disputeM.isPending} onClick={() => disputeM.mutate()}>{disputeM.isPending ? "Submitting…" : "Submit dispute"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={reviewOpen} onOpenChange={setReviewOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Rate this provider</DialogTitle></DialogHeader>
          <div className="grid gap-3">
            <div className="flex items-center gap-1">
              {[1, 2, 3, 4, 5].map((n) => (
                <button key={n} type="button" onClick={() => setRating(n)}>
                  <Star className={cn("h-6 w-6", n <= rating ? "fill-warning text-warning" : "text-muted-foreground")} />
                </button>
              ))}
            </div>
            <Input value={comment} onChange={(e) => setComment(e.target.value)} placeholder="Optional comment" />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setReviewOpen(false)}>Cancel</Button>
            <Button className="gradient-brand" disabled={reviewM.isPending} onClick={() => reviewM.mutate()}>{reviewM.isPending ? "Saving…" : "Submit review"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}

interface Bid {
  id: string; providerId: string; providerName: string; providerUsername: string; providerRating: number | null; providerRatingCount: number;
  price: number; stock: number | null; successRate: number | null; avgResponseSec: number | null; createdAt: string;
}

function BidsPanel({ requestId, money, onDecline, declining }: { requestId: string; money: (n: number) => string; onDecline: () => void; declining: boolean }) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const bids = useQuery({
    queryKey: ["mp", "bids", requestId],
    queryFn: () => api.get<Bid[]>(`/api/manual-providers/requests/${requestId}/bids`),
    refetchInterval: open ? 5000 : 15000,
  });
  const acceptM = useMutation({
    mutationFn: (bidId: string) => api.post(`/api/manual-providers/requests/${requestId}/accept-bid`, { bidId }),
    onSuccess: () => { toast.success("Paid — request is now assigned"); setOpen(false); qc.invalidateQueries({ queryKey: ["mp", "requests", "mine"] }); qc.invalidateQueries({ queryKey: ["wallet"] }); },
    onError: (e: any) => toast.error(e?.message || "Could not accept this bid"),
  });

  return (
    <>
      <Dialog open={open} onOpenChange={setOpen}>
        <Button size="sm" variant="outline" onClick={() => setOpen(true)}>
          {(bids.data?.length ?? 0) > 0 ? `${bids.data!.length} bid${bids.data!.length > 1 ? "s" : ""} — view` : "Waiting for bids…"}
        </Button>
        <DialogContent>
          <DialogHeader><DialogTitle>Offers from sellers</DialogTitle></DialogHeader>
          <div className="space-y-2 max-h-96 overflow-auto">
            {(bids.data ?? []).map((b) => (
              <div key={b.id} className="rounded-lg border p-3 space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <UserProfileDialog username={b.providerUsername} trigger={<span className="text-sm font-medium">{b.providerName} <span className="text-xs text-muted-foreground font-normal">@{b.providerUsername}</span></span>} />
                  <span className="font-semibold tabular-nums shrink-0">{money(b.price)}</span>
                </div>
                {/* "seller ka bhi card ho, reviews, success rate, kitne time
                    me otp diya sab show hona chahiye" — every trust signal
                    right on the bid, not hidden behind a click. */}
                <div className="flex items-center gap-3 flex-wrap text-xs text-muted-foreground">
                  {b.providerRatingCount > 0 ? (
                    <span className="flex items-center gap-0.5"><Star className="h-3 w-3 fill-warning text-warning" />{b.providerRating} <span className="text-[10px]">({b.providerRatingCount})</span></span>
                  ) : (
                    <span className="italic">no reviews yet</span>
                  )}
                  {b.successRate !== null && <span className="flex items-center gap-0.5"><CheckCircle2 className="h-3 w-3 text-success" />{b.successRate}% success</span>}
                  {b.avgResponseSec !== null && <span className="flex items-center gap-0.5" title="Average time to deliver the OTP"><Timer className="h-3 w-3" />{Math.round(b.avgResponseSec)}s avg</span>}
                  {b.stock !== null && <span>{b.stock} number{b.stock === 1 ? "" : "s"} available</span>}
                </div>
                <Button size="sm" className="gradient-brand w-full" disabled={acceptM.isPending} onClick={() => acceptM.mutate(b.id)}>Accept & pay {money(b.price)}</Button>
              </div>
            ))}
            {(bids.data ?? []).length === 0 && <p className="text-sm text-muted-foreground text-center py-6">No bids yet — sellers who offer this are being notified.</p>}
          </div>
        </DialogContent>
      </Dialog>
      <Button size="sm" variant="outline" className="text-destructive" disabled={declining} onClick={onDecline}>
        <X className="h-3.5 w-3.5 mr-1" />Withdraw
      </Button>
    </>
  );
}
