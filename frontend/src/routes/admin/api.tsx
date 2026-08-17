import { PageHeader } from "@/components/common/PageHeader";
import { StatCard } from "@/components/common/StatCard";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AdminTable, StatusPill } from "@/components/admin/AdminTable";
import { Activity, Gauge, Zap, RefreshCw } from "lucide-react";

type Key = { id: string; label: string; prefix: string; rpm: number; status: string; used: string };

export default function AdminApi() {
  const keys: Key[] = [
    { id: "k1", label: "Production", prefix: "gop_live_a83f", rpm: 1200, status: "active", used: "128,420" },
    { id: "k2", label: "Development", prefix: "gop_test_c21e", rpm: 300, status: "active", used: "4,120" },
    { id: "k3", label: "Legacy", prefix: "gop_live_9018", rpm: 100, status: "suspended", used: "42" },
  ];
  return (
    <div>
      <PageHeader title="API Management" description="Keys, webhooks, rate limits, and usage logs." />
      <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
        <StatCard label="Requests (24h)" value="128,420" icon={Activity} tone="brand" />
        <StatCard label="Avg latency" value="184 ms" icon={Zap} tone="info" />
        <StatCard label="Error rate" value="0.32%" icon={Gauge} tone="warning" />
        <StatCard label="Active keys" value="3" icon={RefreshCw} tone="success" />
      </div>
      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <Card className="shadow-soft"><CardHeader><CardTitle>API keys</CardTitle></CardHeader>
          <CardContent className="p-0"><AdminTable rows={keys} columns={[
            { key: "l", header: "Label", cell: (k: Key) => k.label },
            { key: "p", header: "Prefix", cell: (k: Key) => <span className="font-mono text-xs">{k.prefix}...</span> },
            { key: "r", header: "Rate", cell: (k: Key) => `${k.rpm}/min` },
            { key: "u", header: "Used", cell: (k: Key) => k.used },
            { key: "st", header: "Status", cell: (k: Key) => <StatusPill status={k.status} /> },
          ]} /></CardContent>
        </Card>
        <Card className="shadow-soft"><CardHeader><CardTitle>Webhook endpoint</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <Label>Endpoint URL (placeholder)</Label>
            <Input placeholder="https://your-app.com/webhook" />
            <Label>Secret</Label>
            <Input placeholder="whsec_...." />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
