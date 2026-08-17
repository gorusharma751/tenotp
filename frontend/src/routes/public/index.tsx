import { Link, useNavigate } from "@tanstack/react-router";
import { motion } from "framer-motion";
import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowRight, ShieldCheck, Globe2, Zap, Code2, Clock, RefreshCcw, Layers,
  Headphones, Search, Star, ChevronRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { api } from "@/lib/apiClient";
import type { Country, Service } from "@/types";
import { money } from "@/utils/format";
import { useUserStore } from "@/store/userStore";

type LivePrice = { price: number; count: number };
type LivePriceMap = Record<string, LivePrice>;

function useCounter(target: number, duration = 1500) {
  const [n, setN] = useState(0);
  useEffect(() => {
    const start = performance.now();
    let raf = 0;
    const tick = (t: number) => {
      const p = Math.min(1, (t - start) / duration);
      setN(Math.floor(target * (1 - Math.pow(1 - p, 3))));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, duration]);
  return n;
}

function Stat({ value, label }: { value: number; label: string }) {
  const n = useCounter(value);
  return (
    <div className="text-center">
      <div className="text-2xl sm:text-4xl font-bold text-gradient-brand">{n.toLocaleString()}</div>
      <div className="mt-1 text-xs sm:text-sm text-muted-foreground uppercase tracking-wide">{label}</div>
    </div>
  );
}

function BigStat({ value, label }: { value: number; label: string }) {
  const n = useCounter(value, 2000);
  return (
    <div>
      <div className="text-2xl sm:text-3xl font-bold">{n.toLocaleString()}</div>
      <div className="mt-1 text-xs sm:text-sm text-white/80 uppercase tracking-wide">{label}</div>
    </div>
  );
}

export default function Landing() {
  const navigate = useNavigate();
  const user = useUserStore((s) => s.user);
  // Once signed in, skip the landing page — it exists only to onboard new visitors.
  useEffect(() => {
    if (user) navigate({ to: "/dashboard" as any, replace: true });
  }, [user, navigate]);
  const [country, setCountry] = useState<string>("any");
  const [service, setService] = useState<string>("any");

  const countriesQ = useQuery({ queryKey: ["catalog", "countries"], queryFn: () => api.get<Country[]>("/api/catalog/countries") });
  const servicesQ = useQuery({ queryKey: ["catalog", "services"], queryFn: () => api.get<Service[]>("/api/catalog/services") });
  const liveQ = useQuery({
    queryKey: ["live-prices"],
    queryFn: () => api.get<LivePriceMap>("/api/providers/live-prices"),
    refetchInterval: 60_000,
    staleTime: 30_000,
  });
  const COUNTRIES = countriesQ.data ?? [];
  const SERVICES = servicesQ.data ?? [];
  const LIVE = liveQ.data ?? {};

  const runSearch = () => {
    navigate({
      to: "/services" as any,
      search: {
        q: "",
        country: country === "any" ? "" : country,
        service: service === "any" ? "" : service,
        mode: "otp",
      } as any,
    });
  };

  return (
    <>
      {/* HERO — Terminal + status */}
      <section className="relative overflow-hidden">
        <div aria-hidden className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
          <div className="absolute -top-[10%] -left-[10%] h-[40%] w-[40%] rounded-full bg-primary/15 blur-[120px]" />
          <div className="absolute top-[20%] -right-[10%] h-[50%] w-[30%] rounded-full bg-accent/10 blur-[120px]" />
        </div>
        <div className="mx-auto max-w-7xl px-4 sm:px-6 pt-10 sm:pt-16 pb-6">
          <div className="grid gap-10 lg:grid-cols-2 lg:gap-16 items-center">
            <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
              <div className="inline-flex items-center gap-2 rounded-full border border-accent/25 bg-accent/10 px-3 py-1 text-[11px] font-bold uppercase tracking-widest text-accent">
                <span className="relative flex h-2 w-2">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-accent/70" />
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-accent" />
                </span>
                Global OTP Network Active
              </div>
              <h1 className="font-display text-4xl sm:text-6xl xl:text-7xl font-extrabold leading-[1.05] tracking-tight text-foreground">
                Virtual Numbers <br className="hidden sm:block" />
                <span className="text-gradient-brand">Without Limits</span>
              </h1>
              <p className="max-w-lg text-base sm:text-lg text-muted-foreground">
                Instantly receive SMS and OTP verifications for any platform. High success rates, global coverage, and total anonymity.
              </p>
              <div className="flex flex-wrap gap-3">
                <Button asChild size="lg" className="gradient-brand shadow-glow">
                  <Link to={"/dashboard/buy-number" as any}>Buy Number <ArrowRight className="ml-2 h-4 w-4" /></Link>
                </Button>
                <Button asChild size="lg" variant="outline" className="border-white/10 bg-card/60">
                  <Link to={"/services" as any}>Browse services</Link>
                </Button>
              </div>
              <div className="flex items-center gap-4 pt-2">
                <div className="flex -space-x-3">
                  <div className="h-9 w-9 rounded-full border-2 border-background bg-primary/60" />
                  <div className="h-9 w-9 rounded-full border-2 border-background bg-accent/60" />
                  <div className="h-9 w-9 rounded-full border-2 border-background bg-primary/40" />
                </div>
                <p className="text-sm text-muted-foreground">Trusted by <span className="font-semibold text-foreground">12,000+</span> users worldwide</p>
              </div>
            </motion.div>

            {/* Terminal shell mockup */}
            <div className="relative">
              <div aria-hidden className="absolute -inset-1 rounded-3xl bg-gradient-to-r from-primary to-accent opacity-20 blur" />
              <div className="relative overflow-hidden rounded-3xl border border-white/10 bg-card shadow-2xl">
                <div className="flex items-center justify-between border-b border-white/5 p-5">
                  <div className="flex gap-1.5">
                    <div className="h-2.5 w-2.5 rounded-full bg-red-500/50" />
                    <div className="h-2.5 w-2.5 rounded-full bg-yellow-500/50" />
                    <div className="h-2.5 w-2.5 rounded-full bg-green-500/50" />
                  </div>
                  <div className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">tenotp · terminal</div>
                </div>
                <div className="space-y-4 p-5">
                  <div className="grid grid-cols-2 gap-3">
                    <div className="rounded-xl border border-white/5 bg-white/[0.03] p-4">
                      <p className="text-[10px] font-bold uppercase text-muted-foreground">Active balance</p>
                      <p className="mt-1 font-display text-xl font-bold text-foreground">₹3,540</p>
                    </div>
                    <div className="rounded-xl border border-white/5 bg-white/[0.03] p-4">
                      <p className="text-[10px] font-bold uppercase text-muted-foreground">OTPs received</p>
                      <p className="mt-1 font-display text-xl font-bold text-accent">1,204</p>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <p className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">Recent OTPs</p>
                    <div className="flex items-center justify-between rounded-lg border border-primary/30 bg-primary/10 p-3">
                      <div className="flex items-center gap-3">
                        <div className="grid h-8 w-8 place-items-center rounded-full bg-background text-xs font-bold">W</div>
                        <div>
                          <p className="text-xs font-bold text-foreground">WhatsApp</p>
                          <p className="text-[10px] text-muted-foreground">Just now</p>
                        </div>
                      </div>
                      <div className="font-display text-lg font-bold tracking-widest text-primary">749-021</div>
                    </div>
                    <div className="flex items-center justify-between rounded-lg border border-white/5 bg-white/[0.03] p-3 opacity-70">
                      <div className="flex items-center gap-3">
                        <div className="grid h-8 w-8 place-items-center rounded-full bg-background text-xs font-bold">G</div>
                        <div>
                          <p className="text-xs font-bold text-foreground">Google</p>
                          <p className="text-[10px] text-muted-foreground">2m ago</p>
                        </div>
                      </div>
                      <div className="font-display text-lg font-bold tracking-widest text-muted-foreground">110-845</div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Live stats */}
          <div className="mt-14 grid grid-cols-2 gap-4 sm:grid-cols-4 sm:gap-6">
            <Stat value={128} label="Countries" />
            <Stat value={1240} label="Services" />
            <Stat value={8425} label="Orders Today" />
            <Stat value={3120} label="Users Online" />
          </div>
        </div>
      </section>

      {/* SEARCH CARD */}
      <section className="mx-auto max-w-6xl px-4 pt-4">
        <Card className="glass shadow-glow border-primary/20">
          <CardContent className="p-6">
            <div className="grid gap-3 md:grid-cols-[1fr_1fr_auto]">
              <Select value={country} onValueChange={setCountry}>
                <SelectTrigger><SelectValue placeholder="Country" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="any">Any country</SelectItem>
                  {COUNTRIES.map((c) => <SelectItem key={c.code} value={c.code}>{c.flag} {c.name}</SelectItem>)}
                </SelectContent>
              </Select>
              <Select value={service} onValueChange={setService}>
                <SelectTrigger><SelectValue placeholder="Service" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="any">Any service</SelectItem>
                  {SERVICES.map((s) => <SelectItem key={s.id} value={s.id}>{s.icon} {s.name}</SelectItem>)}
                </SelectContent>
              </Select>
              <Button size="lg" className="gradient-brand" onClick={runSearch}>
                <Search className="mr-2 h-4 w-4" /> Search
              </Button>
            </div>
            <div className="mt-4 flex flex-wrap items-center gap-4">
              <span className="text-xs text-muted-foreground">Price range {money(10)} – {money(500)} · Availability in stock</span>
            </div>
          </CardContent>
        </Card>
      </section>

      {/* POPULAR SERVICES */}
      <section className="mx-auto max-w-7xl px-4 py-10 sm:py-20">
        <div className="mb-8 flex items-end justify-between gap-4">
          <div>
            <h2 className="text-3xl font-bold">Popular services</h2>
            <p className="mt-1 text-sm text-muted-foreground">OTP delivery for the apps your users care about.</p>
          </div>
          <Button asChild variant="ghost"><Link to={"/services" as any}>All services <ArrowRight className="ml-1 h-4 w-4" /></Link></Button>
        </div>
        <div className="grid gap-3 grid-cols-2 sm:grid-cols-3 lg:grid-cols-4">
          {SERVICES.slice(0, 8).map((s) => (
            (() => { const lp = LIVE[s.id]; const price = lp ? lp.price : s.price; const isLive = !!lp; const count = lp ? lp.count : ((s.id.charCodeAt(0) * 137 + 1000) % 9000 + 1000); return (
            <motion.div key={s.id} whileHover={{ y: -4 }}>
              <Card className="shadow-soft hover:shadow-glow transition-shadow h-full">
                <CardContent className="p-4 sm:p-5">
                  <div className="flex items-center justify-between gap-2">
                    <div className="text-2xl sm:text-3xl shrink-0">{s.icon}</div>
                    <Badge variant="secondary" className="truncate max-w-[60%]">{s.category}</Badge>
                  </div>
                  <p className="mt-3 font-semibold truncate" title={s.name}>{s.name}</p>
                  <div className="mt-1 text-xs text-muted-foreground truncate">
                    {COUNTRIES.length} countries · {count.toLocaleString()} numbers
                  </div>
                  <div className="mt-3 flex items-center justify-between gap-2">
                    <span className="font-semibold text-gradient-brand flex items-center gap-1 truncate">
                      {money(price * 85)}
                      {isLive && <span className="inline-block h-1.5 w-1.5 rounded-full bg-success animate-pulse shrink-0" title="Live price" />}
                    </span>
                    <Button asChild size="sm" variant="outline" className="shrink-0">
                      <Link to={"/dashboard/buy-number" as any}>Buy <ChevronRight className="h-3 w-3 ml-1" /></Link>
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
            ); })()
          ))}
        </div>
        <div className="mt-6 text-center">
          <Button asChild variant="outline"><Link to={"/services" as any}>View all services <ArrowRight className="ml-1 h-4 w-4" /></Link></Button>
        </div>
      </section>

      {/* POPULAR COUNTRIES */}
      <section className="mx-auto max-w-7xl px-4 pb-20">
        <div className="mb-8 flex items-end justify-between gap-4">
          <div>
            <h2 className="text-3xl font-bold">Popular countries</h2>
            <p className="mt-1 text-sm text-muted-foreground">Real carrier numbers everywhere your users are.</p>
          </div>
          <Button asChild variant="ghost"><Link to={"/countries" as any}>All countries <ArrowRight className="ml-1 h-4 w-4" /></Link></Button>
        </div>
        <div className="grid gap-3 grid-cols-2 sm:grid-cols-3 lg:grid-cols-4">
          {COUNTRIES.slice(0, 8).map((c) => (
            <Link key={c.code} to={"/countries/$countryCode" as any} params={{ countryCode: c.code } as any}>
              <Card className="shadow-soft hover:shadow-glow transition-all hover:-translate-y-1 h-full">
                <CardContent className="p-5 flex items-center gap-4">
                  <div className="text-4xl">{c.flag}</div>
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold truncate">{c.name}</p>
                    <p className="text-xs text-muted-foreground">from {money(c.priceFrom * 85)}</p>
                    <p className="text-xs text-muted-foreground">{c.numbersAvailable.toLocaleString()} numbers</p>
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      </section>

      {/* WHY CHOOSE US */}
      <section className="mx-auto max-w-7xl px-4 py-10 sm:py-20">
        <div className="text-center mb-12">
          <h2 className="text-3xl sm:text-4xl font-bold">Why choose TenOTP</h2>
          <p className="mt-2 text-muted-foreground">Built for developers, trusted by businesses.</p>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[
            { icon: Zap, title: "Instant OTP", body: "Sub-5s median delivery." },
            { icon: Clock, title: "Real-time delivery", body: "Live inbox with webhooks." },
            { icon: ShieldCheck, title: "99.9% success", body: "Enterprise reliability." },
            { icon: Headphones, title: "24×7 support", body: "Live chat & tickets." },
            { icon: RefreshCcw, title: "Refund protection", body: "Not received? Instant refund." },
            { icon: Code2, title: "Fast API", body: "REST + webhooks, 50ms p95." },
            { icon: Layers, title: "Bulk orders", body: "Buy 1 or 10,000 with one call." },
          ].map((f, i) => (
            <motion.div key={f.title} initial={{ opacity: 0, y: 12 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.05 }}>
              <Card className="shadow-soft h-full hover:shadow-glow transition-shadow">
                <CardContent className="p-6">
                  <div className="grid h-11 w-11 place-items-center rounded-xl bg-primary/10 text-primary"><f.icon className="h-5 w-5" /></div>
                  <h3 className="mt-4 font-semibold">{f.title}</h3>
                  <p className="mt-1 text-sm text-muted-foreground">{f.body}</p>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>
      </section>

      {/* BIG STATS */}
      <section className="mx-auto max-w-7xl px-4 py-16">
        <Card className="gradient-brand text-white border-0 shadow-glow">
          <CardContent className="p-6 sm:p-10 grid grid-cols-2 md:grid-cols-5 gap-6 text-center">
            {[
              { v: 128, l: "Countries" },
              { v: 1240, l: "Services" },
              { v: 4820000, l: "Completed orders" },
              { v: 96400, l: "Active users" },
              { v: 18420, l: "Today's OTP" },
            ].map((s) => <BigStat key={s.l} value={s.v} label={s.l} />)}
          </CardContent>
        </Card>
      </section>

      {/* REVIEWS */}
      <section className="mx-auto max-w-7xl px-4 py-10 sm:py-20">
        <div className="text-center mb-10">
          <h2 className="text-3xl sm:text-4xl font-bold">Loved by developers</h2>
          <p className="mt-2 text-muted-foreground">Real teams. Real reviews.</p>
        </div>
        <div className="grid gap-4 md:grid-cols-3">
          {[
            { name: "Priya M.", role: "Backend Engineer", body: "OTPs land in 2 seconds. Our signup drop-off cut in half." },
            { name: "Marco T.", role: "CTO, FinLite", body: "Bulk API is stupid-fast. Migrated 5M verifications in a weekend." },
            { name: "Aisha K.", role: "Growth Lead", body: "Global coverage & real support. This is what we wanted for years." },
            { name: "Jonas B.", role: "Founder", body: "Support team is genuinely responsive. Zero downtime for us." },
            { name: "Lin H.", role: "Platform Engineer", body: "Docs are clean, webhooks reliable. 10/10 developer experience." },
            { name: "Diego R.", role: "Ops Manager", body: "Refunds actually work. Support responds in minutes." },
          ].map((r) => (
            <Card key={r.name} className="shadow-soft">
              <CardContent className="p-6">
                <div className="flex text-yellow-500">{[...Array(5)].map((_, i) => <Star key={i} className="h-4 w-4 fill-current" />)}</div>
                <p className="mt-3 text-sm">"{r.body}"</p>
                <div className="mt-4 flex items-center gap-3">
                  <Avatar><AvatarFallback>{r.name[0]}</AvatarFallback></Avatar>
                  <div>
                    <p className="text-sm font-medium">{r.name}</p>
                    <p className="text-xs text-muted-foreground">{r.role}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      {/* FAQ */}
      <section className="mx-auto max-w-3xl px-4 py-10 sm:py-20">
        <div className="text-center mb-8">
          <h2 className="text-3xl sm:text-4xl font-bold">Frequently asked questions</h2>
        </div>
        <Accordion type="single" collapsible className="w-full">
          {[
            { q: "How fast do OTPs arrive?", a: "Median delivery is under 5 seconds worldwide. Most under 2s in Tier 1 markets." },
            { q: "What if I don't receive an OTP?", a: "You get an automatic refund to your wallet. No tickets required." },
            { q: "Is there an API?", a: "A full REST API with webhooks, SDKs and a live playground. See /api." },
            { q: "Which payment methods?", a: "Cards, crypto, and enterprise invoicing available." },
            { q: "Do you support bulk orders?", a: "Yes — volume discounts start at 1,000 orders." },
          ].map((f, i) => (
            <AccordionItem key={i} value={`q${i}`}>
              <AccordionTrigger>{f.q}</AccordionTrigger>
              <AccordionContent>{f.a}</AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </section>

      {/* CTA */}
      <section className="mx-auto max-w-7xl px-4 pb-20">
        <Card className="overflow-hidden gradient-brand text-white shadow-glow border-0">
          <CardContent className="p-6 sm:p-10 grid gap-6 md:grid-cols-2 items-center">
            <div>
              <h2 className="text-3xl sm:text-4xl font-bold">Ready when you are.</h2>
              <p className="mt-2 text-white/80">Sign up in seconds. Free credits included.</p>
            </div>
            <div className="flex flex-wrap justify-start md:justify-end gap-3">
              <Button asChild size="lg" variant="secondary"><Link to="/register">Create account</Link></Button>
              <Button asChild size="lg" variant="outline" className="border-white/40 text-white hover:bg-white/10"><Link to={"/contact-us" as any}>Talk to sales</Link></Button>
            </div>
          </CardContent>
        </Card>
      </section>
    </>
  );
}
