import { Link } from "@tanstack/react-router";
import { ChevronRight } from "lucide-react";
import { useBreadcrumbs } from "@/hooks/useBreadcrumbs";

export function AutoBreadcrumb() {
  const items = useBreadcrumbs();
  if (items.length === 0) return null;
  return (
    <nav aria-label="Breadcrumb" className="flex items-center gap-1 text-sm text-muted-foreground overflow-x-auto">
      <Link to="/" className="hover:text-foreground">Home</Link>
      {items.map((it) => (
        <span key={it.href} className="flex items-center gap-1 whitespace-nowrap">
          <ChevronRight className="h-3.5 w-3.5" />
          {it.last ? (
            <span className="text-foreground font-medium">{it.label}</span>
          ) : (
            <Link to={it.href as any} className="hover:text-foreground">{it.label}</Link>
          )}
        </span>
      ))}
    </nav>
  );
}
