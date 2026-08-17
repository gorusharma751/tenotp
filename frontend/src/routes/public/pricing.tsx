import { Link } from "@tanstack/react-router";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Check } from "lucide-react";

const plans = [
  { name: "Starter", price: "0", desc: "Try the platform.", features: ["Pay-per-OTP", "50 free credits", "Community support"], cta: "Start free" },
  { name: "Pro", price: "29", desc: "For growing teams.", features: ["Volume discounts", "Priority OTP routes", "API access", "Email support"], cta: "Upgrade to Pro", featured: true },
  { name: "Enterprise", price: "Custom", desc: "For scale.", features: ["Dedicated numbers", "SLA & DPA", "Custom integrations", "24/7 support"], cta: "Contact sales" },
];

export default function Pricing() {
  return (
    <div className="mx-auto max-w-7xl px-4 py-16">
      <div className="text-center mb-12">
        <h1 className="text-4xl sm:text-5xl font-bold">Simple, transparent pricing</h1>
        <p className="mt-3 text-muted-foreground">Pay only for what you use. Volume discounts included.</p>
      </div>
      <div className="grid gap-6 md:grid-cols-3">
        {plans.map((p) => (
          <Card key={p.name} className={p.featured ? "shadow-glow border-primary" : "shadow-soft"}>
            <CardContent className="p-8">
              <h3 className="text-xl font-semibold">{p.name}</h3>
              <p className="text-sm text-muted-foreground">{p.desc}</p>
              <div className="mt-4">
                <span className="text-4xl font-bold">{p.price === "Custom" ? p.price : `$${p.price}`}</span>
                {p.price !== "Custom" && p.price !== "0" && <span className="text-muted-foreground">/mo</span>}
              </div>
              <ul className="mt-6 space-y-2 text-sm">
                {p.features.map((f) => (<li key={f} className="flex gap-2"><Check className="h-4 w-4 text-success mt-0.5" />{f}</li>))}
              </ul>
              <Button asChild className={"mt-6 w-full " + (p.featured ? "gradient-brand" : "")} variant={p.featured ? "default" : "outline"}>
                <Link to={(p.name === "Enterprise" ? "/contact-us" : "/register") as any}>{p.cta}</Link>
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
