import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Star, ShoppingBag, Store, AlertTriangle, ThumbsUp, CheckCircle2, Timer } from "lucide-react";
import { api } from "@/lib/apiClient";
import { dateTime } from "@/utils/format";
import { cn } from "@/lib/utils";

// Public profile — "seller bhi dekh sakta hai buyer ka, buyer bhi seller
// ka" — reachable by username only, never exposes email/phone/real name.
// Same shape for anyone: their buy-side stats, and (only if they're a
// provider) their sell-side stats + reviews.
interface Profile {
  username: string; memberSince: string;
  asBuyer: { numbersTaken: number; scamsFlagged: number };
  asSeller: { companyName: string; numbersSold: number; failedRequests: number; scamsFlagged: number; avgRating: number | null; ratingCount: number; successRate: number | null; avgResponseSec: number | null } | null;
  reviews: Array<{ rating: number; comment: string | null; createdAt: string; buyerUsername: string }>;
}

export function UserProfileDialog({ username, trigger, className }: { username: string; trigger: React.ReactNode; className?: string }) {
  const [open, setOpen] = useState(false);
  const q = useQuery({
    queryKey: ["mp", "profile", username],
    queryFn: () => api.get<Profile>(`/api/manual-providers/profile/${encodeURIComponent(username)}`),
    enabled: open && !!username,
  });

  if (!username) return <>{trigger}</>;

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className={cn("hover:underline text-left", className)}>{trigger}</button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>@{username}</DialogTitle></DialogHeader>
          {q.isLoading && <p className="text-sm text-muted-foreground py-6 text-center">Loading…</p>}
          {q.data && (
            <div className="space-y-4">
              <p className="text-xs text-muted-foreground">Member since {dateTime(q.data.memberSince)}</p>

              <div className="grid grid-cols-2 gap-2">
                <div className="rounded-lg border p-3">
                  <p className="text-xs text-muted-foreground flex items-center gap-1"><ShoppingBag className="h-3.5 w-3.5" />As buyer</p>
                  <p className="text-lg font-semibold mt-1">{q.data.asBuyer.numbersTaken} <span className="text-xs font-normal text-muted-foreground">numbers taken</span></p>
                  {q.data.asBuyer.scamsFlagged > 0 && (
                    <p className="text-xs text-destructive flex items-center gap-1 mt-1"><AlertTriangle className="h-3 w-3" />{q.data.asBuyer.scamsFlagged} confirmed scam{q.data.asBuyer.scamsFlagged > 1 ? "s" : ""}</p>
                  )}
                </div>
                {q.data.asSeller ? (
                  <div className="rounded-lg border p-3">
                    <p className="text-xs text-muted-foreground flex items-center gap-1"><Store className="h-3.5 w-3.5" />As seller</p>
                    <p className="text-lg font-semibold mt-1">{q.data.asSeller.numbersSold} <span className="text-xs font-normal text-muted-foreground">sold</span></p>
                    <div className="flex items-center gap-2 mt-1 flex-wrap">
                      {q.data.asSeller.ratingCount > 0 && (
                        <span className="text-xs flex items-center gap-0.5"><Star className="h-3 w-3 fill-warning text-warning" />{q.data.asSeller.avgRating} ({q.data.asSeller.ratingCount})</span>
                      )}
                      {q.data.asSeller.successRate !== null && (
                        <span className="text-xs flex items-center gap-0.5"><CheckCircle2 className="h-3 w-3 text-success" />{q.data.asSeller.successRate}%</span>
                      )}
                      {q.data.asSeller.avgResponseSec !== null && (
                        <span className="text-xs flex items-center gap-0.5" title="Average time to deliver the OTP"><Timer className="h-3 w-3" />{Math.round(q.data.asSeller.avgResponseSec)}s</span>
                      )}
                      {q.data.asSeller.scamsFlagged > 0 && (
                        <span className="text-xs text-destructive flex items-center gap-1"><AlertTriangle className="h-3 w-3" />{q.data.asSeller.scamsFlagged} scam{q.data.asSeller.scamsFlagged > 1 ? "s" : ""}</span>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="rounded-lg border border-dashed p-3 flex items-center justify-center">
                    <p className="text-xs text-muted-foreground">Not a seller</p>
                  </div>
                )}
              </div>

              {q.data.asSeller && (
                <div>
                  <p className="text-xs font-medium mb-1.5 flex items-center gap-1"><ThumbsUp className="h-3.5 w-3.5" />Reviews</p>
                  <div className="space-y-1.5 max-h-52 overflow-auto">
                    {q.data.reviews.map((r, i) => (
                      <div key={i} className="rounded-lg border p-2.5">
                        <div className="flex items-center justify-between">
                          <span className="flex items-center gap-0.5">
                            {[1, 2, 3, 4, 5].map((n) => <Star key={n} className={cn("h-3 w-3", n <= r.rating ? "fill-warning text-warning" : "text-muted-foreground")} />)}
                          </span>
                          <span className="text-[10px] text-muted-foreground">@{r.buyerUsername} · {dateTime(r.createdAt)}</span>
                        </div>
                        {r.comment && <p className="text-xs mt-1 text-muted-foreground">{r.comment}</p>}
                      </div>
                    ))}
                    {q.data.reviews.length === 0 && <p className="text-xs text-muted-foreground text-center py-3">No reviews yet.</p>}
                  </div>
                </div>
              )}
            </div>
          )}
          {q.isError && <p className="text-sm text-destructive py-6 text-center">Could not load this profile.</p>}
        </DialogContent>
      </Dialog>
    </>
  );
}
