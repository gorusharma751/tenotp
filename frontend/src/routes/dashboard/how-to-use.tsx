import { Link } from "@tanstack/react-router";
import { PageHeader } from "@/components/common/PageHeader";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { UserPlus, CreditCard, ShoppingCart, Inbox, History, ShieldCheck, Zap, HelpCircle } from "lucide-react";
import step1 from "@/assets/howto-1-signup.jpg";
import step2 from "@/assets/howto-2-buy.jpg";
import step3 from "@/assets/howto-3-otp.jpg";
import step4 from "@/assets/howto-4-history.jpg";

const STEPS = [
  {
    n: 1,
    icon: UserPlus,
    title: "Sign up & log in",
    body: "Register with your email and password. You will land on your dashboard right after.",
    img: step1,
    cta: { label: "Go to Overview", to: "/dashboard" },
  },
  {
    n: 2,
    icon: CreditCard,
    title: "Deposit funds",
    body: "Open Deposit → pay via Razorpay, UPI QR, or Paytm/BharatPe. Wallet is credited automatically once payment is verified.",
    img: step1,
    cta: { label: "Open Deposit", to: "/dashboard/deposit" },
  },
  {
    n: 3,
    icon: ShoppingCart,
    title: "Buy a number",
    body: "Open Buy Number → pick a Country → pick a Service (WhatsApp, Telegram, etc.) → pick a Server → click Buy. Cost is deducted from your wallet only when a number is issued.",
    img: step2,
    cta: { label: "Buy a number", to: "/dashboard/buy-number" },
  },
  {
    n: 4,
    icon: Inbox,
    title: "Receive your OTP",
    body: "Use the number on the target app. As soon as the SMS arrives, the OTP appears in the number card and in your Notifications bell. Copy with one tap. If not received, cancel to get an automatic refund.",
    img: step3,
    cta: { label: "Open OTP Inbox", to: "/dashboard/otp-inbox" },
  },
  {
    n: 5,
    icon: History,
    title: "Track & re-order",
    body: "Every order is saved in Orders with status, timestamp and OTP. Re-order the same service in one click from Buy Number.",
    img: step4,
    cta: { label: "View Orders", to: "/dashboard/orders" },
  },
] as const;

export default function HowToUse() {
  return (
    <div>
      <PageHeader title="How to use TenOTP" description="A complete guide with screenshots — 5 steps to receive your first OTP." />

      <div className="grid gap-4 md:grid-cols-3 mb-8">
        <Highlight icon={Zap} title="Fast" body="OTP average 5–30 sec after number issue." />
        <Highlight icon={ShieldCheck} title="Safe" body="Auto-refund if number fails. Wallet only." />
        <Highlight icon={HelpCircle} title="Stuck?" body={<>Contact support anytime from <Link className="underline" to="/dashboard/support">Support</Link>.</>} />
      </div>

      <div className="space-y-6">
        {STEPS.map((s) => (
          <Card key={s.n} className="shadow-soft overflow-hidden">
            <CardContent className="p-0">
              <div className="grid gap-0 md:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
                <div className="p-6 md:p-8">
                  <div className="flex items-center gap-3">
                    <div className="grid h-10 w-10 place-items-center rounded-full gradient-brand text-white font-bold shadow-glow">{s.n}</div>
                    <Badge variant="secondary" className="gap-1"><s.icon className="h-3.5 w-3.5" />Step {s.n}</Badge>
                  </div>
                  <h3 className="mt-3 text-xl font-semibold">{s.title}</h3>
                  <p className="mt-2 text-sm text-muted-foreground leading-relaxed">{s.body}</p>
                  <Button asChild className="mt-4 gradient-brand"><Link to={s.cta.to as any}>{s.cta.label}</Link></Button>
                </div>
                <div className="bg-muted/40 border-t md:border-t-0 md:border-l">
                  <img src={s.img} alt={s.title} loading="lazy" width={1024} height={1024} className="w-full h-full object-cover max-h-[320px]" />
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card className="mt-8 shadow-glow border-primary/10">
        <CardContent className="p-6 text-sm">
          <h3 className="font-semibold">Tips</h3>
          <ul className="mt-2 space-y-1.5 text-muted-foreground list-disc pl-5">
            <li>OTP arrival is also reflected in the Notifications bell instantly.</li>
            <li>Numbers expire automatically after 20 minutes if unused — you get refunded.</li>
            <li>For bulk / API use, generate a key in <Link className="underline" to="/dashboard/api-keys">API Keys</Link>.</li>
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}

function Highlight({ icon: Icon, title, body }: { icon: any; title: string; body: React.ReactNode }) {
  return (
    <Card className="shadow-soft"><CardContent className="p-4 flex gap-3">
      <div className="grid h-9 w-9 place-items-center rounded-lg bg-primary/10 text-primary shrink-0"><Icon className="h-4 w-4" /></div>
      <div><p className="font-semibold text-sm">{title}</p><p className="text-xs text-muted-foreground mt-0.5">{body}</p></div>
    </CardContent></Card>
  );
}
