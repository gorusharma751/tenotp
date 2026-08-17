import { Link, useParams, useSearch } from "@tanstack/react-router";
import { motion } from "framer-motion";
import { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Check, Copy, Inbox, LayoutDashboard, Clock } from "lucide-react";
import { toast } from "sonner";

export default function PurchaseSuccess() {
  const { id } = useParams({ strict: false }) as { id: string };
  const search = useSearch({ strict: false }) as { number?: string; service?: string; country?: string };
  const number = search.number ?? "+1 555 000 0000";
  const service = search.service ?? "WhatsApp";
  const country = search.country ?? "United States";
  const [remaining, setRemaining] = useState(20 * 60);

  useEffect(() => {
    const t = setInterval(() => setRemaining((r) => Math.max(0, r - 1)), 1000);
    return () => clearInterval(t);
  }, []);

  const mm = String(Math.floor(remaining / 60)).padStart(2, "0");
  const ss = String(remaining % 60).padStart(2, "0");

  return (
    <div className="mx-auto max-w-2xl px-4 py-12">
      <motion.div initial={{ scale: 0.7, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ type: "spring", damping: 12 }} className="mx-auto grid h-24 w-24 place-items-center rounded-full gradient-brand text-white shadow-glow">
        <Check className="h-12 w-12" />
      </motion.div>
      <h1 className="mt-6 text-center text-3xl font-bold">Purchase successful!</h1>
      <p className="mt-2 text-center text-muted-foreground">Your number is ready to receive OTPs.</p>

      <Card className="mt-8 shadow-glow border-primary/10"><CardContent className="p-6">
        <div className="divide-y">
          {[
            ["Order ID", id],
            ["Number", number],
            ["Service", service],
            ["Country", country],
          ].map(([k, v]) => (
            <div key={k} className="flex items-center justify-between py-3 gap-3">
              <span className="text-sm text-muted-foreground">{k}</span>
              <div className="flex items-center gap-2 min-w-0">
                <span className="font-mono font-medium truncate">{v}</span>
                <Button size="icon" variant="ghost" onClick={() => { navigator.clipboard.writeText(String(v)); toast.success("Copied"); }}>
                  <Copy className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          ))}
          <div className="flex items-center justify-between py-3">
            <span className="text-sm text-muted-foreground flex items-center gap-1"><Clock className="h-3.5 w-3.5" /> Time remaining</span>
            <span className="font-mono font-semibold text-primary">{mm}:{ss}</span>
          </div>
        </div>
      </CardContent></Card>

      <div className="mt-6 flex flex-wrap justify-center gap-3">
        <Button asChild className="gradient-brand"><Link to="/dashboard/otp-inbox"><Inbox className="h-4 w-4 mr-2" />Open OTP inbox</Link></Button>
        <Button asChild variant="outline"><Link to="/dashboard"><LayoutDashboard className="h-4 w-4 mr-2" />Back to dashboard</Link></Button>
      </div>
    </div>
  );
}
