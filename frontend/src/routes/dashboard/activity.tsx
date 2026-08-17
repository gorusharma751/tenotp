import { useState } from "react";
import { PageHeader } from "@/components/common/PageHeader";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { LogIn, ShoppingCart, Wallet, KeyRound, LifeBuoy } from "lucide-react";

const ICONS: Record<string, any> = { login: LogIn, order: ShoppingCart, wallet: Wallet, api: KeyRound, support: LifeBuoy };

const EVENTS = [
  { id: "1", type: "login", desc: "Signed in from Chrome / Delhi", time: "just now" },
  { id: "2", type: "order", desc: "Purchased WhatsApp number (+91 98••42)", time: "10m ago" },
  { id: "3", type: "wallet", desc: "Deposit received via card ****4242", time: "2h ago" },
  { id: "4", type: "api", desc: "Created API key 'Production'", time: "1d ago" },
  { id: "5", type: "support", desc: "Opened a support ticket", time: "2d ago" },
];

// TODO(backend): no /api/activity endpoint is ported yet — kept as local
// illustrative data, same as the monolith.
export default function Activity() {
  const [tab, setTab] = useState("all");
  const visible = EVENTS.filter((e) => tab === "all" || e.type === tab);
  return (
    <div>
      <PageHeader title="Activity log" description="Every important action on your account." />
      <Tabs value={tab} onValueChange={setTab} className="mb-4">
        <TabsList><TabsTrigger value="all">All</TabsTrigger><TabsTrigger value="login">Login</TabsTrigger><TabsTrigger value="order">Orders</TabsTrigger><TabsTrigger value="wallet">Wallet</TabsTrigger><TabsTrigger value="api">API</TabsTrigger><TabsTrigger value="support">Support</TabsTrigger></TabsList>
      </Tabs>
      <Card className="shadow-soft"><CardContent className="p-6">
        <ol className="relative border-l border-border ml-3 space-y-6">
          {visible.map((e) => {
            const Icon = ICONS[e.type];
            return (
              <li key={e.id} className="ml-6">
                <span className="absolute -left-4 grid h-8 w-8 place-items-center rounded-full bg-primary/10 text-primary border-4 border-background"><Icon className="h-4 w-4" /></span>
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="secondary" className="capitalize text-xs">{e.type}</Badge>
                  <span className="text-xs text-muted-foreground">{e.time}</span>
                </div>
                <p className="mt-1 text-sm">{e.desc}</p>
              </li>
            );
          })}
        </ol>
      </CardContent></Card>
    </div>
  );
}
