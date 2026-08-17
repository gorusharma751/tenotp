import { PageHeader } from "@/components/common/PageHeader";
import { StatCard } from "@/components/common/StatCard";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Cpu, Database, Server, HardDrive } from "lucide-react";

export default function AdminSystem() {
  const services = [
    { name: "API Gateway", state: "operational", uptime: "99.98%" },
    { name: "OTP Delivery", state: "operational", uptime: "99.94%" },
    { name: "Wallet Service", state: "operational", uptime: "99.99%" },
    { name: "Payments", state: "degraded", uptime: "99.62%" },
    { name: "Reports", state: "operational", uptime: "99.90%" },
    { name: "Cron Scheduler", state: "operational", uptime: "100%" },
  ];
  return (
    <div>
      <PageHeader title="System" description="Infrastructure health, service uptime, and resource utilization." />
      <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
        <StatCard label="CPU" value="42%" icon={Cpu} tone="info" />
        <StatCard label="Memory" value="61%" icon={Server} tone="warning" />
        <StatCard label="Disk" value="38%" icon={HardDrive} tone="success" />
        <StatCard label="DB queries/s" value="1,204" icon={Database} tone="brand" />
      </div>
      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <Card className="shadow-soft"><CardHeader><CardTitle>Services</CardTitle></CardHeader><CardContent className="space-y-3 text-sm">
          {services.map((s) => (
            <div key={s.name}>
              <div className="flex items-center justify-between mb-1"><span>{s.name}</span><span className={`text-xs ${s.state === "operational" ? "text-success" : "text-warning"}`}>● {s.state} · {s.uptime}</span></div>
              <Progress value={parseFloat(s.uptime)} />
            </div>
          ))}
        </CardContent></Card>
        <Card className="shadow-soft"><CardHeader><CardTitle>Region distribution</CardTitle></CardHeader><CardContent className="space-y-3 text-sm">
          {["us-east-1","eu-west-1","ap-south-1","sa-east-1"].map((r, i) => (
            <div key={r}><div className="flex items-center justify-between mb-1"><span>{r}</span><span className="text-muted-foreground">{[38,29,22,11][i]}%</span></div><Progress value={[38,29,22,11][i]} /></div>
          ))}
        </CardContent></Card>
      </div>
    </div>
  );
}
