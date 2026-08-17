import { Link } from "@tanstack/react-router";
import { cn } from "@/lib/utils";

const TABS: Array<{ to: string; label: string; exact?: boolean }> = [
  { to: "/gourav-ankit-adi/providers/$id", label: "Overview", exact: true },
  { to: "/gourav-ankit-adi/providers/$id/services", label: "Services" },
  { to: "/gourav-ankit-adi/providers/$id/categories", label: "Categories" },
  { to: "/gourav-ankit-adi/providers/$id/pricing", label: "Pricing" },
  { to: "/gourav-ankit-adi/providers/$id/logs", label: "Logs" },
  { to: "/gourav-ankit-adi/providers/$id/settings", label: "Settings" },
];

export function ProviderSubNav({ id }: { id: string }) {
  return (
    <div className="mb-4 flex flex-wrap gap-1 border-b">
      {TABS.map((t) => (
        <Link key={t.to} to={t.to as any} params={{ id } as any}
          activeOptions={{ exact: !!t.exact }}
          activeProps={{ className: "text-primary border-primary" }}
          inactiveProps={{ className: "text-muted-foreground border-transparent" }}
          className={cn("px-3 py-2 text-sm border-b-2 -mb-px hover:text-foreground transition-colors")}>
          {t.label}
        </Link>
      ))}
    </div>
  );
}
