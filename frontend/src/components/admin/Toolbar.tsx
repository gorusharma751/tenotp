import { Input } from "@/components/ui/input";
import { Search } from "lucide-react";
import type { ReactNode } from "react";

export function Toolbar({ query, onQuery, placeholder = "Search...", children }: { query: string; onQuery: (v: string) => void; placeholder?: string; children?: ReactNode }) {
  return (
    <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="relative w-full sm:max-w-xs">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input value={query} onChange={(e) => onQuery(e.target.value)} placeholder={placeholder} className="pl-9" />
      </div>
      <div className="flex flex-wrap items-center gap-2">{children}</div>
    </div>
  );
}
