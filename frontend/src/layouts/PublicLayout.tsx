import { Outlet, Link, useRouterState } from "@tanstack/react-router";
import { Menu } from "lucide-react";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Logo } from "@/components/brand/Logo";
import { ThemeToggle } from "@/components/common/ThemeToggle";
import { CurrencyToggle } from "@/components/common/CurrencyToggle";
import { ContactButtons } from "@/components/common/ContactButtons";
import { TelegramJoinDialog } from "@/components/dashboard/TelegramJoinDialog";
import { PUBLIC_NAV } from "@/constants/nav";
import { useState } from "react";
import { cn } from "@/lib/utils";
import { useUserStore } from "@/store/userStore";

function NavLinks({ onClick }: { onClick?: () => void }) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  return (
    <>
      {PUBLIC_NAV.map((it) => (
        <Link
          key={it.url}
          to={it.url as any}
          onClick={onClick}
          className={cn(
            "text-sm font-medium transition-colors hover:text-foreground",
            pathname === it.url ? "text-foreground" : "text-muted-foreground",
          )}
        >
          {it.title}
        </Link>
      ))}
    </>
  );
}

export function PublicLayout() {
  const [open, setOpen] = useState(false);
  const user = useUserStore((s) => s.user);
  const isAuthed = !!user;
  return (
    <div className="flex min-h-screen w-full flex-col">
      <header className="sticky top-0 z-40 glass">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-3 px-4">
          <div className="flex items-center gap-6">
            <Logo />
            <nav className="hidden md:flex items-center gap-5">
              <NavLinks />
            </nav>
          </div>
          <div className="flex items-center gap-1">
            <Button asChild size="sm" className="bg-red-600 hover:bg-red-700 text-white border-0 shadow-md shadow-red-600/30 px-2 sm:px-3 h-8 sm:h-9 text-xs sm:text-sm">
              <a href="https://ssmpanal.lovable.app" target="_blank" rel="noopener noreferrer">SMM</a>
            </Button>
            <ContactButtons compact />
            <CurrencyToggle />
            <ThemeToggle />
            {isAuthed ? (
              <Button asChild className="gradient-brand shadow-soft"><Link to={"/dashboard" as any}>Dashboard</Link></Button>
            ) : (
              <>
                <Button asChild variant="ghost" className="hidden sm:inline-flex"><Link to="/login">Sign in</Link></Button>
                <Button asChild className="gradient-brand shadow-soft"><Link to="/register">Get Started</Link></Button>
              </>
            )}
            <Sheet open={open} onOpenChange={setOpen}>
              <SheetTrigger asChild>
                <Button variant="ghost" size="icon" className="md:hidden" aria-label="Menu"><Menu className="h-5 w-5" /></Button>
              </SheetTrigger>
              <SheetContent side="right" className="w-72">
                <div className="mt-8 flex flex-col gap-4">
                  <NavLinks onClick={() => setOpen(false)} />
                  {isAuthed ? (
                    <Link to={"/dashboard" as any} onClick={() => setOpen(false)} className="text-sm font-medium">Dashboard</Link>
                  ) : (
                    <Link to="/login" onClick={() => setOpen(false)} className="text-sm font-medium">Sign in</Link>
                  )}
                </div>
              </SheetContent>
            </Sheet>
          </div>
        </div>
      </header>
      <main className="flex-1"><Outlet /></main>
      <TelegramJoinDialog />
      <footer className="border-t bg-muted/30">
        <div className="mx-auto grid max-w-7xl gap-8 px-4 py-12 sm:grid-cols-2 md:grid-cols-4">
          <div>
            <Logo />
            <p className="mt-3 text-sm text-muted-foreground max-w-xs">Global virtual numbers, OTP delivery, and rentals for developers and businesses.</p>
          </div>
          <div>
            <h4 className="text-sm font-semibold mb-3">Platform</h4>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li><Link to="/" className="hover:text-foreground">Home</Link></li>
              <li><Link to={"/dashboard" as any} className="hover:text-foreground">Dashboard</Link></li>
              <li><Link to={"/dashboard/deposit" as any} className="hover:text-foreground">Deposit</Link></li>
              <li><Link to={"/services" as any} className="hover:text-foreground">Services</Link></li>
            </ul>
          </div>
          <div>
            <h4 className="text-sm font-semibold mb-3">Company</h4>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li><Link to={"/about-us" as any} className="hover:text-foreground">About Us</Link></li>
              <li><Link to={"/contact-us" as any} className="hover:text-foreground">Contact Us</Link></li>
              <li><Link to={"/faq" as any} className="hover:text-foreground">FAQ</Link></li>
              <li><Link to={"/blog" as any} className="hover:text-foreground">Blog</Link></li>
            </ul>
          </div>
          <div>
            <h4 className="text-sm font-semibold mb-3">Legal</h4>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li><Link to={"/privacy-policy" as any} className="hover:text-foreground">Privacy Policy</Link></li>
              <li><Link to={"/terms-and-conditions" as any} className="hover:text-foreground">Terms &amp; Conditions</Link></li>
              <li><Link to={"/refund-policy" as any} className="hover:text-foreground">Refund Policy</Link></li>
            </ul>
          </div>
        </div>
        <div className="border-t">
          <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-2 px-4 py-4 text-xs text-muted-foreground sm:flex-row">
            <p>© {new Date().getFullYear()} TenOTP. All Rights Reserved.</p>
            <p>Powered by <span className="font-medium text-foreground">TenOTP</span></p>
          </div>
        </div>
      </footer>
    </div>
  );
}
