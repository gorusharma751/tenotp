import { useState } from "react";
import { PageHeader } from "@/components/common/PageHeader";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CheckCheck, Trash2, Package, Wallet, Inbox, LifeBuoy, Cog } from "lucide-react";
import { toast } from "sonner";

const ICONS = { system: Cog, orders: Package, wallet: Wallet, otp: Inbox, support: LifeBuoy } as const;
type Cat = keyof typeof ICONS;

const INIT: { id: string; cat: Cat; title: string; body: string; time: string; unread: boolean }[] = [
  { id: "1", cat: "otp", title: "OTP received", body: "WhatsApp code arrived for +91 98••42", time: "just now", unread: true },
  { id: "2", cat: "orders", title: "Order completed", body: "Order marked as received", time: "10m ago", unread: true },
  { id: "3", cat: "wallet", title: "Deposit successful", body: "Credited to your wallet", time: "2h ago", unread: true },
  { id: "4", cat: "support", title: "Ticket reply", body: "Support replied to your ticket", time: "1d ago", unread: false },
  { id: "5", cat: "system", title: "New API key created", body: "Production key generated", time: "2d ago", unread: false },
];

export default function Notifications() {
  const [items, setItems] = useState(INIT);
  const [tab, setTab] = useState<"all" | Cat>("all");
  const visible = items.filter((i) => tab === "all" || i.cat === tab);
  const readAll = () => { setItems((x) => x.map((i) => ({ ...i, unread: false }))); toast.success("Marked all read"); };
  const clear = () => { setItems([]); toast("Notifications cleared"); };

  return (
    <div>
      <PageHeader title="Notifications" description="Everything happening in your account." actions={
        <>
          <Button variant="outline" size="sm" onClick={readAll}><CheckCheck className="h-4 w-4 mr-1" />Read all</Button>
          <Button variant="ghost" size="sm" onClick={clear}><Trash2 className="h-4 w-4 mr-1" />Clear</Button>
        </>
      } />
      <Tabs value={tab} onValueChange={(v) => setTab(v as any)} className="mb-4">
        <TabsList><TabsTrigger value="all">All</TabsTrigger><TabsTrigger value="system">System</TabsTrigger><TabsTrigger value="orders">Orders</TabsTrigger><TabsTrigger value="wallet">Wallet</TabsTrigger><TabsTrigger value="otp">OTP</TabsTrigger><TabsTrigger value="support">Support</TabsTrigger></TabsList>
      </Tabs>
      <Card className="shadow-soft"><CardContent className="p-0">
        {visible.length === 0 ? <p className="p-10 text-center text-muted-foreground">No notifications.</p> : (
          <div className="divide-y">
            {visible.map((n) => {
              const Icon = ICONS[n.cat];
              return (
                <div key={n.id} className={`flex items-start gap-4 p-4 ${n.unread ? "bg-primary/5" : ""}`}>
                  <div className="grid h-10 w-10 place-items-center rounded-xl bg-primary/10 text-primary shrink-0"><Icon className="h-4 w-4" /></div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-medium text-sm">{n.title}</p>
                      {n.unread && <Badge variant="secondary" className="text-[10px]">new</Badge>}
                    </div>
                    <p className="text-xs text-muted-foreground">{n.body}</p>
                    <p className="text-[10px] text-muted-foreground mt-1">{n.time}</p>
                  </div>
                  <Button size="icon" variant="ghost" onClick={() => setItems((x) => x.filter((i) => i.id !== n.id))}><Trash2 className="h-3.5 w-3.5" /></Button>
                </div>
              );
            })}
          </div>
        )}
      </CardContent></Card>
    </div>
  );
}
