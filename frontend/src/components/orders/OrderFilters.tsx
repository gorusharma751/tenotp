import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Search, X } from "lucide-react";
import { useOrderManagementStore } from "@/store/orderManagementStore";

export function OrderFilters() {
  const s = useOrderManagementStore();
  return (
    <div className="grid gap-3 md:grid-cols-6">
      <div className="relative md:col-span-2">
        <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input placeholder="Search reference, customer, service…" value={s.q} onChange={(e) => s.setQ(e.target.value)} className="pl-9" />
      </div>
      <Select value={s.status} onValueChange={(v) => s.setStatus(v as never)}>
        <SelectTrigger><SelectValue placeholder="Status" /></SelectTrigger>
        <SelectContent>
          {["all","draft","pending","processing","completed","cancelled","failed"].map((x) => (
            <SelectItem key={x} value={x}>{x[0].toUpperCase()+x.slice(1)}</SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Select value={s.paymentStatus} onValueChange={(v) => s.setPaymentStatus(v as never)}>
        <SelectTrigger><SelectValue placeholder="Payment" /></SelectTrigger>
        <SelectContent>
          {["all","unpaid","paid","refunded","failed"].map((x) => (
            <SelectItem key={x} value={x}>{x[0].toUpperCase()+x.slice(1)}</SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Select value={s.channel} onValueChange={(v) => s.setChannel(v as never)}>
        <SelectTrigger><SelectValue placeholder="Channel" /></SelectTrigger>
        <SelectContent>
          {["all","web","api","mobile"].map((x) => (
            <SelectItem key={x} value={x}>{x[0].toUpperCase()+x.slice(1)}</SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Select value={s.sort} onValueChange={(v) => s.setSort(v as never)}>
        <SelectTrigger><SelectValue placeholder="Sort" /></SelectTrigger>
        <SelectContent>
          <SelectItem value="newest">Newest</SelectItem>
          <SelectItem value="oldest">Oldest</SelectItem>
          <SelectItem value="amount-desc">Amount ↓</SelectItem>
          <SelectItem value="amount-asc">Amount ↑</SelectItem>
        </SelectContent>
      </Select>
      {(s.q || s.status !== "all" || s.paymentStatus !== "all" || s.channel !== "all") && (
        <Button variant="ghost" size="sm" onClick={() => s.reset()} className="md:col-span-6 justify-self-start">
          <X className="h-4 w-4 mr-1" /> Reset filters
        </Button>
      )}
    </div>
  );
}
