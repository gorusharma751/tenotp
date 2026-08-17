import { DollarSign } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { useCurrencyStore, type CurrencyCode } from "@/store/currencyStore";

const OPTIONS: { code: CurrencyCode; label: string; symbol: string }[] = [
  { code: "INR", label: "Indian Rupee", symbol: "₹" },
  { code: "USDT", label: "Tether (USDT)", symbol: "$" },
];

export function CurrencyToggle() {
  const code = useCurrencyStore((s) => s.code);
  const setCode = useCurrencyStore((s) => s.setCode);
  const active = OPTIONS.find((o) => o.code === code) ?? OPTIONS[0];
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="sm" className="gap-1.5 px-2" aria-label="Currency">
          <DollarSign className="h-4 w-4" />
          <span className="text-xs font-medium">{active.code}</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-44">
        <DropdownMenuLabel>Currency</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {OPTIONS.map((o) => (
          <DropdownMenuItem key={o.code} onClick={() => setCode(o.code)} className="flex items-center justify-between">
            <span>{o.symbol} {o.label}</span>
            {code === o.code && <span className="text-xs text-primary">✓</span>}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
