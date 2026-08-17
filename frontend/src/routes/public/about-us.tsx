import { Card, CardContent } from "@/components/ui/card";
import { ShieldCheck, Zap, Lock, LifeBuoy } from "lucide-react";

const features = [
  { icon: ShieldCheck, title: "Secure Platform", desc: "Enterprise-grade infrastructure with encrypted storage and role-based access control." },
  { icon: Zap, title: "Fast Processing", desc: "Instant number provisioning and real-time OTP delivery from tier-1 upstream carriers." },
  { icon: Lock, title: "Protected Payments", desc: "PCI-DSS compliant payments via trusted gateways. Card data is never stored on our servers." },
  { icon: LifeBuoy, title: "Reliable Support", desc: "Dedicated support team over email and Telegram to help you whenever you need us." },
];

export default function AboutUs() {
  return (
    <div className="mx-auto max-w-5xl px-4 py-12 sm:py-16">
      <div className="text-center">
        <h1 className="text-3xl sm:text-4xl font-bold tracking-tight">About TenOTP</h1>
        <p className="mt-4 text-muted-foreground max-w-2xl mx-auto">
          TenOTP is a professional platform providing secure OTP-related services, virtual number rentals, wallet management, payment processing and a full-featured user dashboard — built for developers, businesses and everyday users.
        </p>
      </div>

      <Card className="mt-10 glass shadow-soft">
        <CardContent className="p-6 sm:p-8">
          <h2 className="text-xl font-semibold">Our Mission</h2>
          <p className="mt-3 text-muted-foreground">
            We simplify how people access verification numbers around the world. Our mission is to deliver reliable, affordable and secure OTP infrastructure with a smooth wallet-based experience and complete transparency.
          </p>
        </CardContent>
      </Card>

      <div className="mt-8 grid gap-4 sm:grid-cols-2">
        {features.map((f) => (
          <Card key={f.title} className="glass shadow-soft">
            <CardContent className="p-6">
              <f.icon className="h-6 w-6 text-primary" />
              <h3 className="mt-3 font-semibold">{f.title}</h3>
              <p className="mt-1 text-sm text-muted-foreground">{f.desc}</p>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
