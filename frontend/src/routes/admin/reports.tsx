import { PageHeader } from "@/components/common/PageHeader";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { DollarSign, Globe2, Users, Package, Wallet, Inbox, FileDown, FileSpreadsheet } from "lucide-react";

const REPORTS = [
  { name: "Revenue report", desc: "Revenue by day, country, and service.", icon: DollarSign },
  { name: "Country report", desc: "Sales volume and success rate by country.", icon: Globe2 },
  { name: "User report", desc: "New sign-ups, retention, and cohort analysis.", icon: Users },
  { name: "Order report", desc: "Order lifecycle and status distribution.", icon: Package },
  { name: "Wallet report", desc: "Deposits, refunds, and balances.", icon: Wallet },
  { name: "OTP report", desc: "Delivery latency and success ratio.", icon: Inbox },
];

export default function AdminReports() {
  return (
    <div>
      <PageHeader title="Reports" description="Download scheduled and ad-hoc reports." />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {REPORTS.map((r) => (
          <Card key={r.name} className="shadow-soft">
            <CardContent className="p-5">
              <div className="flex items-start gap-3">
                <div className="grid h-10 w-10 place-items-center rounded-xl bg-primary/10 text-primary"><r.icon className="h-5 w-5" /></div>
                <div className="min-w-0"><p className="font-semibold">{r.name}</p><p className="text-xs text-muted-foreground mt-0.5">{r.desc}</p></div>
              </div>
              <div className="mt-4 flex gap-2">
                <Button size="sm" variant="outline" className="flex-1" onClick={() => toast.success(`${r.name} — PDF (placeholder)`)}><FileDown className="mr-1 h-3 w-3" />PDF</Button>
                <Button size="sm" variant="outline" className="flex-1" onClick={() => toast.success(`${r.name} — Excel (placeholder)`)}><FileSpreadsheet className="mr-1 h-3 w-3" />Excel</Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
