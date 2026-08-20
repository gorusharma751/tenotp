import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { PageHeader } from "@/components/common/PageHeader";
import { AdminTable, StatusPill } from "@/components/admin/AdminTable";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Play, Check, X, AlertTriangle, IndianRupee, Gavel } from "lucide-react";
import { api } from "@/lib/apiClient";
import { money, dateTime, timeAgo } from "@/utils/format";
import { toast } from "sonner";
import { UserProfileDialog } from "@/components/mp/UserProfileDialog";

interface BuyerStats { completedCount: number; disputeCount: number }
interface SellerRequest {
  id: string; code: string; serviceName: string; country: string; price: number | null; status: string; createdAt: string; number: string | null; otpCode: string | null;
  buyerStats: BuyerStats; buyerUsername: string; quantity: number; numberType: "any" | "old" | "new";
}
interface SellerDispute { id: string; requestId: string; reason: string; proofImage: string | null; status: string; createdAt: string }
interface OpenBoardRequest {
  id: string; code: string; serviceName: string; country: string; buyerBudgetNet: number | null; createdAt: string;
  myBidStatus: string | null; canBid: boolean; buyerStats: BuyerStats; buyerUsername: string;
  quantity: number; numberType: "any" | "old" | "new";
}

function BuyerStatsBadge({ s, username }: { s: BuyerStats; username: string }) {
  const body = (
    <span className="text-xs text-muted-foreground" title="Buyer's track record on this platform">
      @{username} · {s.completedCount} taken{s.disputeCount > 0 && <span className="text-destructive"> · {s.disputeCount} dispute{s.disputeCount > 1 ? "s" : ""}</span>}
    </span>
  );
  return <UserProfileDialog username={username} trigger={body} />;
}

function ActionsCell({ r, onDone }: { r: SellerRequest; onDone: () => void }) {
  const [quoteOpen, setQuoteOpen] = useState(false);
  const [startOpen, setStartOpen] = useState(false);
  const [completeOpen, setCompleteOpen] = useState(false);
  const [quotePrice, setQuotePrice] = useState("");
  const [number, setNumber] = useState("");
  const [otpCode, setOtpCode] = useState("");

  const quoteM = useMutation({
    mutationFn: () => api.post(`/api/manual-providers/seller/requests/${r.id}/quote`, { price: Number(quotePrice) }),
    onSuccess: () => { toast.success("Quote sent — waiting for the buyer to accept"); setQuoteOpen(false); setQuotePrice(""); onDone(); },
    onError: (e: any) => toast.error(e?.message || "Could not send quote"),
  });
  const startM = useMutation({
    mutationFn: () => api.post(`/api/manual-providers/seller/requests/${r.id}/start`, { number }),
    onSuccess: () => { toast.success("Number sent to buyer"); setStartOpen(false); setNumber(""); onDone(); },
    onError: (e: any) => toast.error(e?.message || "Could not start"),
  });
  const completeM = useMutation({
    mutationFn: () => api.post(`/api/manual-providers/seller/requests/${r.id}/complete`, { otpCode }),
    onSuccess: () => { toast.success("OTP sent — you'll get paid once the buyer confirms it"); setCompleteOpen(false); setOtpCode(""); onDone(); },
    onError: (e: any) => toast.error(e?.message || "Could not send OTP"),
  });
  const failM = useMutation({
    mutationFn: (reason: string) => api.post(`/api/manual-providers/seller/requests/${r.id}/fail`, { reason }),
    onSuccess: () => { toast.success("Marked failed — buyer refunded automatically"); onDone(); },
    onError: (e: any) => toast.error(e?.message || "Could not mark failed"),
  });
  const busy = quoteM.isPending || startM.isPending || completeM.isPending || failM.isPending;

  return (
    <div className="flex gap-1">
      {r.status === "quote_requested" && (
        <Dialog open={quoteOpen} onOpenChange={setQuoteOpen}>
          <Button size="sm" className="gradient-brand" disabled={busy} onClick={() => setQuoteOpen(true)}><IndianRupee className="h-3.5 w-3.5 mr-1" />Quote a price</Button>
          <DialogContent>
            <DialogHeader><DialogTitle>Name your price for {r.serviceName}</DialogTitle></DialogHeader>
            <div className="grid gap-1.5">
              <Label>Your price (the buyer pays this plus the platform's margin)</Label>
              <Input type="number" min={0} step="0.01" value={quotePrice} onChange={(e) => setQuotePrice(e.target.value)} placeholder="₹" />
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setQuoteOpen(false)}>Cancel</Button>
              <Button className="gradient-brand" disabled={!quotePrice.trim() || Number(quotePrice) <= 0 || quoteM.isPending} onClick={() => quoteM.mutate()}>{quoteM.isPending ? "Sending…" : "Send quote"}</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
      {r.status === "quoted" && <span className="text-xs text-muted-foreground italic">waiting for buyer to accept…</span>}
      {r.status === "assigned" && (
        <Dialog open={startOpen} onOpenChange={setStartOpen}>
          <Button size="sm" variant="outline" disabled={busy} onClick={() => setStartOpen(true)}><Play className="h-3.5 w-3.5 mr-1" />Start</Button>
          <DialogContent>
            <DialogHeader><DialogTitle>Give the buyer a number</DialogTitle></DialogHeader>
            {r.numberType === "new" && (
              <p className="text-xs text-warning">Buyer asked for a NEW number — don't reuse one you've given out before, it'll be rejected.</p>
            )}
            <div className="grid gap-1.5">
              <Label>Phone number (yours — you'll read the OTP off this phone)</Label>
              <Input value={number} onChange={(e) => setNumber(e.target.value)} placeholder="+91…" />
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setStartOpen(false)}>Cancel</Button>
              <Button className="gradient-brand" disabled={!number.trim() || startM.isPending} onClick={() => startM.mutate()}>{startM.isPending ? "Sending…" : "Send number"}</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
      {(r.status === "assigned" || r.status === "in_progress") && (
        <>
          <Dialog open={completeOpen} onOpenChange={setCompleteOpen}>
            <Button size="sm" className="gradient-brand" disabled={busy} onClick={() => setCompleteOpen(true)}><Check className="h-3.5 w-3.5 mr-1" />Send OTP</Button>
            <DialogContent>
              <DialogHeader><DialogTitle>Type in the OTP you received</DialogTitle></DialogHeader>
              <div className="grid gap-1.5">
                <Label>OTP code</Label>
                <Input value={otpCode} onChange={(e) => setOtpCode(e.target.value)} placeholder="e.g. 482913" />
              </div>
              <p className="text-xs text-muted-foreground">You'll be paid once the buyer confirms this is correct — or automatically if they don't respond in time.</p>
              <DialogFooter>
                <Button variant="outline" onClick={() => setCompleteOpen(false)}>Cancel</Button>
                <Button className="gradient-brand" disabled={!otpCode.trim() || completeM.isPending} onClick={() => completeM.mutate()}>{completeM.isPending ? "Sending…" : "Send OTP"}</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
          <Button size="sm" variant="outline" className="text-destructive" disabled={busy} onClick={() => {
            const reason = prompt("Why did this request fail? (buyer will be refunded automatically)");
            if (reason !== null) failM.mutate(reason || "Provider could not fulfil this request");
          }}><X className="h-3.5 w-3.5 mr-1" />Fail</Button>
        </>
      )}
      {r.status === "otp_sent" && <span className="text-xs text-muted-foreground italic">waiting for buyer to confirm…</span>}
    </div>
  );
}

function BidCell({ r, onDone }: { r: OpenBoardRequest; onDone: () => void }) {
  const [open, setOpen] = useState(false);
  const [price, setPrice] = useState("");
  const bidM = useMutation({
    mutationFn: () => api.post(`/api/manual-providers/seller/requests/${r.id}/bid`, { price: Number(price) }),
    onSuccess: () => { toast.success("Bid submitted — the buyer will decide"); setOpen(false); setPrice(""); onDone(); },
    onError: (e: any) => toast.error(e?.message || "Could not submit bid"),
  });
  if (r.myBidStatus) return <Badge variant="outline" className="capitalize">{r.myBidStatus}</Badge>;
  if (!r.canBid) {
    return (
      <Link to={"/seller/services" as any} className="text-xs text-primary hover:underline whitespace-nowrap">
        Add this service to bid
      </Link>
    );
  }
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <Button size="sm" className="gradient-brand" onClick={() => setOpen(true)}><Gavel className="h-3.5 w-3.5 mr-1" />Place bid</Button>
      <DialogContent>
        <DialogHeader><DialogTitle>Bid on {r.serviceName} · {r.country}</DialogTitle></DialogHeader>
        <p className="text-xs text-muted-foreground -mt-2">
          Buyer wants <span className="font-medium text-foreground">{r.quantity}</span> number{r.quantity > 1 ? "s" : ""}
          {r.numberType !== "any" && <> · <span className="font-medium text-foreground capitalize">{r.numberType}</span></>}
        </p>
        <div className="grid gap-1.5">
          <Label>Your price {r.buyerBudgetNet !== null && <span className="text-muted-foreground font-normal">(buyer's budget works out to about ₹{r.buyerBudgetNet.toFixed(2)} for you)</span>}</Label>
          <Input type="number" min={0} step="0.01" value={price} onChange={(e) => setPrice(e.target.value)} placeholder="₹" />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
          <Button className="gradient-brand" disabled={!price.trim() || Number(price) <= 0 || bidM.isPending} onClick={() => bidM.mutate()}>{bidM.isPending ? "Sending…" : "Submit bid"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function OpenBoardTab() {
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ["seller", "open-requests"], queryFn: () => api.get<OpenBoardRequest[]>("/api/manual-providers/seller/open-requests"), refetchInterval: 10000 });
  const refresh = () => qc.invalidateQueries({ queryKey: ["seller", "open-requests"] });
  return (
    <>
      <p className="text-xs text-muted-foreground mb-3">Every open request on the platform — bid on the ones you already offer, or add the service on your Services page first to bid on the rest.</p>
      <AdminTable
        rows={q.data ?? []}
        columns={[
          { key: "code", header: "Request", cell: (r: OpenBoardRequest) => <span className="font-mono text-xs">{r.code}</span> },
          { key: "s", header: "Service", cell: (r: OpenBoardRequest) => r.serviceName },
          { key: "c", header: "Country", cell: (r: OpenBoardRequest) => r.country },
          { key: "q", header: "Wants", cell: (r: OpenBoardRequest) => (
            <span className="text-xs">
              {r.quantity}x{r.numberType !== "any" && <span className="text-muted-foreground capitalize"> · {r.numberType}</span>}
            </span>
          ) },
          { key: "b", header: "Buyer", cell: (r: OpenBoardRequest) => <BuyerStatsBadge s={r.buyerStats} username={r.buyerUsername} /> },
          { key: "hint", header: "Their budget (your net)", cell: (r: OpenBoardRequest) => r.buyerBudgetNet !== null ? money(r.buyerBudgetNet) : <span className="text-xs text-muted-foreground italic">no hint</span> },
          { key: "d", header: "Posted", cell: (r: OpenBoardRequest) => <span className="text-xs">{timeAgo(r.createdAt)}</span> },
          { key: "act", header: "", cell: (r: OpenBoardRequest) => <BidCell r={r} onDone={refresh} /> },
        ]}
        empty="No open requests right now."
      />
    </>
  );
}

function DisputesTab() {
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ["seller", "disputes"], queryFn: () => api.get<SellerDispute[]>("/api/manual-providers/seller/disputes") });
  const decideM = useMutation({
    mutationFn: (v: { id: string; decision: "approved" | "rejected" }) => api.post(`/api/manual-providers/seller/disputes/${v.id}/decide`, { decision: v.decision }),
    onSuccess: () => { toast.success("Decision recorded"); qc.invalidateQueries({ queryKey: ["seller", "disputes"] }); qc.invalidateQueries({ queryKey: ["seller", "requests"] }); qc.invalidateQueries({ queryKey: ["seller", "me"] }); },
    onError: (e: any) => toast.error(e?.message || "Could not decide"),
  });
  return (
    <AdminTable
      rows={q.data ?? []}
      columns={[
        { key: "r", header: "Reason", cell: (d: SellerDispute) => <span className="text-xs">{d.reason}</span> },
        { key: "p", header: "Proof", cell: (d: SellerDispute) => d.proofImage ? <a href={d.proofImage} target="_blank" rel="noreferrer" className="text-primary underline text-xs">View</a> : "—" },
        { key: "st", header: "Status", cell: (d: SellerDispute) => <StatusPill status={d.status === "approved" ? "approved" : d.status === "rejected" ? "rejected" : "pending"} /> },
        { key: "d", header: "Opened", cell: (d: SellerDispute) => <span className="text-xs">{dateTime(d.createdAt)}</span> },
        { key: "act", header: "", cell: (d: SellerDispute) => d.status === "pending" && (
          <div className="flex gap-1">
            <Button size="sm" variant="outline" className="text-destructive" onClick={() => { if (confirm("Approve this dispute? The buyer will be refunded and your earnings for this request reversed.")) decideM.mutate({ id: d.id, decision: "approved" }); }}>Approve refund</Button>
            <Button size="sm" variant="outline" onClick={() => decideM.mutate({ id: d.id, decision: "rejected" })}>Reject</Button>
          </div>
        ) },
      ]}
      empty="No disputes filed against you."
    />
  );
}

export default function SellerRequests() {
  const qc = useQueryClient();
  const [tab, setTab] = useState("active");
  const q = useQuery({
    queryKey: ["seller", "requests", tab],
    queryFn: () => api.get<SellerRequest[]>(`/api/manual-providers/seller/requests?status=${tab}`),
    refetchInterval: 10000,
    enabled: !["disputes", "board"].includes(tab),
  });
  const refresh = () => qc.invalidateQueries({ queryKey: ["seller", "requests"] });

  const cols = [
    { key: "code", header: "Request", cell: (r: SellerRequest) => <span className="font-mono text-xs">{r.code}</span> },
    { key: "b", header: "Buyer", cell: (r: SellerRequest) => <BuyerStatsBadge s={r.buyerStats} username={r.buyerUsername} /> },
    { key: "s", header: "Service", cell: (r: SellerRequest) => r.serviceName },
    { key: "c", header: "Country", cell: (r: SellerRequest) => r.country },
    { key: "p", header: "You get", cell: (r: SellerRequest) => r.price === null ? <span className="text-xs text-muted-foreground italic">ask for price</span> : money(r.price) },
    { key: "n", header: "Number", cell: (r: SellerRequest) => r.number ? <span className="font-mono text-xs">{r.number}</span> : "—" },
    { key: "otp", header: "OTP", cell: (r: SellerRequest) => r.otpCode ? <span className="font-mono font-semibold">{r.otpCode}</span> : "—" },
    { key: "st", header: "Status", cell: (r: SellerRequest) => <StatusPill status={r.status === "quote_requested" ? "pending" : r.status === "quoted" ? "reserved" : r.status === "assigned" ? "pending" : r.status === "in_progress" ? "reserved" : r.status === "otp_sent" ? "reserved" : r.status} /> },
    { key: "d", header: "Created", cell: (r: SellerRequest) => <span className="text-xs">{dateTime(r.createdAt)}</span> },
    { key: "act", header: "", cell: (r: SellerRequest) => <ActionsCell r={r} onDone={refresh} /> },
  ];

  return (
    <div>
      <PageHeader title="Requests" description="Active requests need your action; history shows everything past. Give the buyer a number when you start, type in the OTP when it arrives." />
      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="board"><Gavel className="h-3.5 w-3.5 mr-1" />Open Board</TabsTrigger>
          <TabsTrigger value="active">Active</TabsTrigger>
          <TabsTrigger value="completed">Completed</TabsTrigger>
          <TabsTrigger value="failed">Failed</TabsTrigger>
          <TabsTrigger value="cancelled">Cancelled</TabsTrigger>
          <TabsTrigger value="disputes"><AlertTriangle className="h-3.5 w-3.5 mr-1" />Disputes</TabsTrigger>
        </TabsList>
        <TabsContent value={tab} className="mt-4">
          {tab === "disputes" ? <DisputesTab /> : tab === "board" ? <OpenBoardTab /> : <AdminTable rows={q.data ?? []} columns={cols} empty="Nothing here yet." />}
        </TabsContent>
      </Tabs>
    </div>
  );
}
