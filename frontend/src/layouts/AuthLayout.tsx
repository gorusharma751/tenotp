import { Outlet, Link } from "@tanstack/react-router";
import { Logo } from "@/components/brand/Logo";
import { ShieldCheck, Globe2, Zap } from "lucide-react";

export function AuthLayout() {
  return (
    <div className="min-h-screen w-full lg:grid lg:grid-cols-2">
      <div className="hidden lg:flex relative flex-col justify-between gradient-brand p-10 text-white overflow-hidden">
        <div className="absolute -top-24 -right-24 h-96 w-96 rounded-full bg-white/10 blur-3xl" />
        <div className="absolute bottom-0 -left-24 h-96 w-96 rounded-full bg-white/10 blur-3xl" />
        <div className="relative">
          <Logo className="text-white [&_span]:text-white [&_.text-gradient-brand]:!text-white [&_.text-gradient-brand]:!bg-none" />
        </div>
        <div className="relative space-y-6">
          <h2 className="text-4xl font-bold leading-tight">Virtual numbers for every workflow.</h2>
          <p className="text-white/80 max-w-md">Instant OTP delivery, long-term rentals, and a REST API trusted by developers in 120+ countries.</p>
          <div className="grid gap-3">
            {[
              { icon: ShieldCheck, t: "Enterprise-grade security" },
              { icon: Globe2, t: "12,000+ numbers across 120 countries" },
              { icon: Zap, t: "OTP delivered under 5 seconds" },
            ].map(({ icon: I, t }) => (
              <div key={t} className="flex items-center gap-3 text-sm">
                <span className="grid h-9 w-9 place-items-center rounded-lg bg-white/15"><I className="h-4 w-4" /></span>
                <span>{t}</span>
              </div>
            ))}
          </div>
        </div>
        <p className="relative text-xs text-white/60">© {new Date().getFullYear()} TenOTP</p>
      </div>
      <div className="flex flex-col min-h-screen">
        <header className="flex items-center justify-between p-4 lg:hidden border-b">
          <Logo />
          <Link to="/" className="text-sm text-muted-foreground">← Home</Link>
        </header>
        <main className="flex-1 grid place-items-center p-4 sm:p-8">
          <div className="w-full max-w-md">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}
