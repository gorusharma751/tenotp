import { PageHeader } from "@/components/common/PageHeader";
import { Card, CardContent } from "@/components/ui/card";
import { dateTime } from "@/utils/format";

const LEVELS = ["INFO","WARN","INFO","ERROR","INFO","INFO","WARN","INFO"];
const MSGS = [
  "Worker booted (region us-east-1)",
  "Rate limit approaching for key gop_live_a83f",
  "OTP delivered ord_1042 (312ms)",
  "Payment gateway timeout — retrying",
  "New user usr_1024 registered",
  "Cron: expired 12 orders",
  "High refund volume detected",
  "DB backup completed (2.3 GB)",
];

export default function AdminLogs() {
  return (
    <div>
      <PageHeader title="System Logs" description="Live stream of platform events." />
      <Card className="shadow-soft">
        <CardContent className="p-0">
          <div className="font-mono text-xs">
            {Array.from({ length: 30 }).map((_, i) => {
              const lvl = LEVELS[i % LEVELS.length];
              const color = lvl === "ERROR" ? "text-destructive" : lvl === "WARN" ? "text-warning" : "text-muted-foreground";
              return (
                <div key={i} className="flex items-start gap-3 border-b px-4 py-2 last:border-b-0">
                  <span className="text-muted-foreground w-40 shrink-0">{dateTime(new Date(Date.now() - i * 60000).toISOString())}</span>
                  <span className={`w-14 shrink-0 font-semibold ${color}`}>{lvl}</span>
                  <span>{MSGS[i % MSGS.length]}</span>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
