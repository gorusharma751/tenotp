import type { ReactNode } from "react";
import { Card, CardContent } from "@/components/ui/card";

export function LegalPage({ title, subtitle, intro, children }: { title: string; subtitle?: string; intro?: string; children: ReactNode }) {
  return (
    <div className="mx-auto max-w-4xl px-4 py-12 sm:py-16">
      <header className="border-b pb-6">
        <h1 className="text-3xl sm:text-4xl font-bold tracking-tight">{title}</h1>
        {subtitle && <p className="mt-2 text-sm text-muted-foreground">{subtitle}</p>}
      </header>
      {intro && <p className="mt-6 text-muted-foreground leading-relaxed">{intro}</p>}
      <Card className="mt-8 glass shadow-soft">
        <CardContent className="p-6 sm:p-8">
          <div className="space-y-8">{children}</div>
        </CardContent>
      </Card>
    </div>
  );
}

export function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section>
      <h2 className="text-lg sm:text-xl font-semibold">{title}</h2>
      <div className="mt-3 text-sm sm:text-[0.95rem] text-muted-foreground leading-relaxed space-y-2 [&_ul]:list-disc [&_ul]:pl-5 [&_ul]:space-y-1 [&_a]:text-primary [&_strong]:text-foreground">
        {children}
      </div>
    </section>
  );
}
