import { Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import {
  Zap, ShieldCheck, Globe2, Inbox, KeyRound, Wallet, Rocket, Sparkles,
  Check, ArrowRight, Users, Activity, Clock, Star,
} from "lucide-react";

const FEATURES = [
  { icon: Zap, title: "Instant OTP delivery", desc: "Sub-second delivery across 180+ countries with intelligent routing across tier‑1 carriers." },
  { icon: Globe2, title: "Global coverage", desc: "Numbers from every major market — Long‑term rentals, temporary, and dedicated pools." },
  { icon: ShieldCheck, title: "Enterprise‑grade security", desc: "JWT sessions, refresh tokens, 2FA, audit logs, and end‑to‑end encryption on every request." },
  { icon: KeyRound, title: "Developer‑first API", desc: "REST + Webhooks, code samples in Node, Python, PHP & Java. 99.99% uptime SLA." },
  { icon: Wallet, title: "Flexible wallet", desc: "Top up with Razorpay, Stripe, PayPal, UPI, crypto or bank. Auto‑verified deposits." },
  { icon: Inbox, title: "Live OTP inbox", desc: "Realtime WebSocket updates, one‑click copy, and automatic order status tracking." },
];

const STEPS = [
  { n: "01", title: "Create your account", desc: "Sign up in seconds. Verify your email and enable 2FA for premium security." },
  { n: "02", title: "Top up your wallet", desc: "Deposit funds via your preferred gateway. Balance is instantly available." },
  { n: "03", title: "Buy a number", desc: "Pick a service, country and operator. Get your virtual number in <1s." },
  { n: "04", title: "Receive OTP", desc: "OTPs appear live in your inbox and via webhook. Ship faster." },
];

const STATS = [
  { k: "180+", v: "Countries" },
  { k: "12M+", v: "OTPs delivered" },
  { k: "99.99%", v: "Uptime SLA" },
  { k: "24/7", v: "Support" },
];

const PLANS = [
  {
    name: "Starter", price: "$0", period: "/forever", highlight: false,
    features: ["Pay‑as‑you‑go", "Access to 100+ services", "Basic API access", "Community support"],
    cta: "Get Started",
  },
  {
    name: "Growth", price: "$49", period: "/month", highlight: true,
    features: ["Everything in Starter", "10% wallet bonus", "Priority routing", "Webhook delivery", "Email support"],
    cta: "Start Growth",
  },
  {
    name: "Enterprise", price: "Custom", period: "", highlight: false,
    features: ["Dedicated number pools", "Custom SLA & pricing", "Private endpoints", "24/7 dedicated manager"],
    cta: "Contact Sales",
  },
];

const TESTIMONIALS = [
  { name: "Ananya S.", role: "CTO, Kite Labs", quote: "TenOTP replaced three vendors for us. Delivery is instant and the API is a joy to work with." },
  { name: "Marcus R.", role: "Founder, Payloop", quote: "The realtime inbox alone saved us hours of polling code. Rock‑solid infrastructure." },
  { name: "Priya M.", role: "Lead Dev, Bolt", quote: "Cleanest dashboard I've used in this space. The team ships fast and support is excellent." },
];

const FAQ = [
  { q: "How fast is OTP delivery?", a: "Median delivery is under 800ms across tier‑1 carriers. Our routing engine picks the fastest path in realtime." },
  { q: "What payment methods do you support?", a: "Razorpay, Stripe, PayPal, UPI, bank transfer, and manual deposits. All auto‑verified where possible." },
  { q: "Is there a free trial?", a: "The Starter plan is free forever — pay only for numbers you use. No credit card required." },
  { q: "Do you offer refunds?", a: "Yes — unused numbers and failed OTPs are auto‑refunded to your wallet within seconds." },
  { q: "Can I use TenOTP via API?", a: "Absolutely. Full REST API with SDKs for Node, Python, PHP and Java. Webhooks included." },
];

export default function TenOTPLanding() {
  return (
    <div className="relative overflow-hidden bg-gradient-to-b from-background via-background to-background text-foreground">
      {/* Ambient glow */}
      <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[720px] overflow-hidden">
        <div className="absolute left-1/2 top-[-15%] h-[520px] w-[900px] -translate-x-1/2 rounded-full bg-primary/25 blur-[140px]" />
        <div className="absolute left-[10%] top-[30%] h-[320px] w-[520px] rounded-full bg-brand-glow/20 blur-[130px]" />
        <div className="absolute right-[5%] top-[20%] h-[340px] w-[560px] rounded-full bg-info/20 blur-[130px]" />
      </div>

      {/* HERO */}
      <section className="mx-auto max-w-7xl px-4 pt-20 pb-24 text-center sm:pt-28">
        <Badge variant="outline" className="mx-auto mb-6 gap-1.5 rounded-full border-primary/30 bg-primary/5 px-3 py-1 backdrop-blur">
          <Sparkles className="h-3.5 w-3.5 text-primary" />
          <span className="text-xs font-medium">New · Live OTP inbox with WebSockets</span>
        </Badge>
        <h1 className="mx-auto max-w-4xl text-5xl font-bold leading-[1.05] tracking-tight sm:text-6xl md:text-7xl">
          <span className="text-gradient-brand">TenOTP</span>
          <br />
          <span className="text-foreground">Professional OTP &</span>{" "}
          <span className="text-foreground/80">Number Management</span>
        </h1>
        <p className="mx-auto mt-6 max-w-2xl text-lg text-muted-foreground sm:text-xl">
          The premium platform for virtual numbers, instant OTPs, rentals, and a developer‑first API — built for teams that ship fast.
        </p>
        <div className="mt-9 flex flex-wrap items-center justify-center gap-3">
          <Button asChild size="lg" className="gradient-brand h-12 rounded-full px-7 text-base shadow-glow">
            <Link to="/register">Get Started <ArrowRight className="ml-1.5 h-4 w-4" /></Link>
          </Button>
          <Button asChild size="lg" variant="outline" className="h-12 rounded-full border-primary/30 px-7 text-base backdrop-blur">
            <a href="#pricing">View Pricing</a>
          </Button>
        </div>

        {/* Floating preview card */}
        <div className="mx-auto mt-16 max-w-5xl">
          <div className="glass relative rounded-3xl border border-primary/20 p-2 shadow-glow">
            <div className="rounded-[20px] bg-gradient-to-br from-background/80 to-background/40 p-6 sm:p-8">
              <div className="grid gap-4 sm:grid-cols-3">
                {[
                  { icon: Activity, label: "Live orders", value: "1,284" },
                  { icon: Inbox, label: "OTPs today", value: "48,910" },
                  { icon: Clock, label: "Avg delivery", value: "780ms" },
                ].map((s) => (
                  <div key={s.label} className="rounded-2xl border border-border/60 bg-card/50 p-5 text-left backdrop-blur">
                    <div className="flex items-center gap-2 text-xs uppercase tracking-wider text-muted-foreground">
                      <s.icon className="h-3.5 w-3.5" />
                      {s.label}
                    </div>
                    <div className="mt-2 font-display text-3xl font-semibold text-gradient-brand">{s.value}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* FEATURES */}
      <section id="features" className="mx-auto max-w-7xl px-4 py-24">
        <div className="mx-auto max-w-2xl text-center">
          <Badge variant="secondary" className="mb-3">Features</Badge>
          <h2 className="text-4xl font-bold tracking-tight sm:text-5xl">Everything you need. Nothing you don't.</h2>
          <p className="mt-4 text-muted-foreground">A complete OTP stack — from routing to receipts — in one premium dashboard.</p>
        </div>
        <div className="mt-14 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map((f) => (
            <Card key={f.title} className="group relative overflow-hidden rounded-2xl border-border/60 bg-card/50 backdrop-blur transition hover:border-primary/40 hover:-translate-y-0.5 hover:shadow-glow">
              <CardContent className="p-6">
                <div className="mb-4 grid h-11 w-11 place-items-center rounded-xl bg-primary/10 text-primary ring-1 ring-primary/20">
                  <f.icon className="h-5 w-5" />
                </div>
                <h3 className="text-lg font-semibold">{f.title}</h3>
                <p className="mt-1.5 text-sm text-muted-foreground">{f.desc}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      {/* HOW IT WORKS */}
      <section id="how" className="mx-auto max-w-7xl px-4 py-24">
        <div className="mx-auto max-w-2xl text-center">
          <Badge variant="secondary" className="mb-3">How it works</Badge>
          <h2 className="text-4xl font-bold tracking-tight sm:text-5xl">From signup to OTP in 4 steps</h2>
        </div>
        <div className="mt-14 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {STEPS.map((s) => (
            <div key={s.n} className="glass relative rounded-2xl p-6">
              <div className="text-gradient-brand font-display text-4xl font-bold">{s.n}</div>
              <h3 className="mt-3 text-lg font-semibold">{s.title}</h3>
              <p className="mt-1.5 text-sm text-muted-foreground">{s.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* STATS */}
      <section className="mx-auto max-w-7xl px-4 py-16">
        <div className="glass grid gap-6 rounded-3xl p-8 sm:grid-cols-4 sm:p-12">
          {STATS.map((s) => (
            <div key={s.v} className="text-center">
              <div className="text-gradient-brand font-display text-4xl font-bold sm:text-5xl">{s.k}</div>
              <div className="mt-1 text-sm text-muted-foreground">{s.v}</div>
            </div>
          ))}
        </div>
      </section>

      {/* PRICING */}
      <section id="pricing" className="mx-auto max-w-7xl px-4 py-24">
        <div className="mx-auto max-w-2xl text-center">
          <Badge variant="secondary" className="mb-3">Pricing</Badge>
          <h2 className="text-4xl font-bold tracking-tight sm:text-5xl">Simple, transparent pricing</h2>
          <p className="mt-4 text-muted-foreground">Start free. Scale when you're ready. No hidden fees.</p>
        </div>
        <div className="mt-14 grid gap-6 lg:grid-cols-3">
          {PLANS.map((p) => (
            <Card
              key={p.name}
              className={
                "relative overflow-hidden rounded-3xl border-border/60 bg-card/50 backdrop-blur " +
                (p.highlight ? "border-primary/60 shadow-glow ring-1 ring-primary/30" : "")
              }
            >
              {p.highlight && (
                <div className="absolute right-5 top-5">
                  <Badge className="gradient-brand border-0">Most popular</Badge>
                </div>
              )}
              <CardContent className="p-8">
                <h3 className="text-xl font-semibold">{p.name}</h3>
                <div className="mt-4 flex items-baseline gap-1">
                  <span className="font-display text-5xl font-bold">{p.price}</span>
                  <span className="text-sm text-muted-foreground">{p.period}</span>
                </div>
                <ul className="mt-6 space-y-2.5">
                  {p.features.map((f) => (
                    <li key={f} className="flex items-start gap-2 text-sm">
                      <Check className="mt-0.5 h-4 w-4 text-primary shrink-0" />
                      <span>{f}</span>
                    </li>
                  ))}
                </ul>
                <Button asChild className={"mt-8 w-full rounded-full " + (p.highlight ? "gradient-brand" : "")} variant={p.highlight ? "default" : "outline"}>
                  <Link to="/register">{p.cta}</Link>
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      {/* TESTIMONIALS */}
      <section className="mx-auto max-w-7xl px-4 py-24">
        <div className="mx-auto max-w-2xl text-center">
          <Badge variant="secondary" className="mb-3">Loved by teams</Badge>
          <h2 className="text-4xl font-bold tracking-tight sm:text-5xl">What our customers say</h2>
        </div>
        <div className="mt-14 grid gap-5 lg:grid-cols-3">
          {TESTIMONIALS.map((t) => (
            <Card key={t.name} className="rounded-2xl border-border/60 bg-card/50 backdrop-blur">
              <CardContent className="p-6">
                <div className="flex gap-0.5 text-primary">
                  {Array.from({ length: 5 }).map((_, i) => (<Star key={i} className="h-4 w-4 fill-current" />))}
                </div>
                <p className="mt-4 text-sm leading-relaxed">"{t.quote}"</p>
                <div className="mt-5 flex items-center gap-3">
                  <div className="grid h-9 w-9 place-items-center rounded-full bg-primary/10 text-primary text-sm font-semibold">
                    {t.name[0]}
                  </div>
                  <div>
                    <div className="text-sm font-semibold">{t.name}</div>
                    <div className="text-xs text-muted-foreground">{t.role}</div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      {/* FAQ */}
      <section id="faq" className="mx-auto max-w-3xl px-4 py-24">
        <div className="text-center">
          <Badge variant="secondary" className="mb-3">FAQ</Badge>
          <h2 className="text-4xl font-bold tracking-tight sm:text-5xl">Questions, answered</h2>
        </div>
        <Accordion type="single" collapsible className="mt-10">
          {FAQ.map((f, i) => (
            <AccordionItem key={i} value={`i-${i}`} className="border-border/60">
              <AccordionTrigger className="text-left text-base">{f.q}</AccordionTrigger>
              <AccordionContent className="text-muted-foreground">{f.a}</AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </section>

      {/* CTA */}
      <section className="mx-auto max-w-7xl px-4 pb-24">
        <div className="glass relative overflow-hidden rounded-3xl p-10 text-center sm:p-16">
          <div aria-hidden className="pointer-events-none absolute -right-16 -top-16 h-64 w-64 rounded-full bg-primary/25 blur-3xl" />
          <div aria-hidden className="pointer-events-none absolute -bottom-16 -left-16 h-64 w-64 rounded-full bg-info/20 blur-3xl" />
          <Rocket className="mx-auto h-10 w-10 text-primary" />
          <h2 className="mt-4 text-4xl font-bold tracking-tight sm:text-5xl">Ready to ship faster?</h2>
          <p className="mx-auto mt-3 max-w-xl text-muted-foreground">Join thousands of developers using TenOTP to power their auth flows.</p>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <Button asChild size="lg" className="gradient-brand h-12 rounded-full px-7 shadow-glow">
              <Link to="/register">Create free account <ArrowRight className="ml-1.5 h-4 w-4" /></Link>
            </Button>
            <Button asChild size="lg" variant="outline" className="h-12 rounded-full border-primary/30 px-7">
              <Link to={"/contact-us" as any}><Users className="mr-1.5 h-4 w-4" />Talk to sales</Link>
            </Button>
          </div>
        </div>
      </section>
    </div>
  );
}
