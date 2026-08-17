import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { PageHeader } from "@/components/common/PageHeader";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { dateTime } from "@/utils/format";
import { toast } from "sonner";
import { RotateCcw } from "lucide-react";
import type { ChannelLog } from "@/types";

// No backend table for delivery-channel logs — mirrors the monolith's own
// empty stub (src/api/events.ts channelsApi always returned []).
const channelsApi = {
  async list(_channel?: ChannelLog["channel"]): Promise<ChannelLog[]> { return []; },
  async retry(_id: string) { return { ok: true as const }; },
};

export default function AdminChannels() {
  const [tab, setTab] = useState<ChannelLog["channel"]>("email");
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ["channel-logs", tab], queryFn: () => channelsApi.list(tab) });
  const retry = async (id: string) => { try { await channelsApi.retry(id); toast.success("Retry queued"); qc.invalidateQueries({ queryKey: ["channel-logs", tab] }); } catch (e) { toast.error((e as Error).message); } };

  return (
    <div>
      <PageHeader title="Channels" description="Delivery logs across Email, SMS, Push and Webhook (placeholders)." />
      <Card className="shadow-soft">
        <CardContent className="p-4">
          <Tabs value={tab} onValueChange={(v) => setTab(v as ChannelLog["channel"])}>
            <TabsList className="mb-4 flex-wrap">
              {(["email","sms","push","webhook"] as const).map((c) => <TabsTrigger key={c} value={c} className="capitalize">{c}</TabsTrigger>)}
            </TabsList>
            <TabsContent value={tab}>
              {q.isLoading ? <Skeleton className="h-40" /> : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader><TableRow>
                      <TableHead>When</TableHead><TableHead>To</TableHead>
                      <TableHead>Body</TableHead><TableHead>Status</TableHead>
                      <TableHead className="text-right">Retries</TableHead><TableHead></TableHead>
                    </TableRow></TableHeader>
                    <TableBody>
                      {(q.data ?? []).map((l) => (
                        <TableRow key={l.id}>
                          <TableCell className="text-xs text-muted-foreground">{dateTime(l.at)}</TableCell>
                          <TableCell className="text-xs">{l.to}</TableCell>
                          <TableCell className="text-xs text-muted-foreground truncate max-w-[240px]">{l.subject ?? l.body}</TableCell>
                          <TableCell><Badge variant={l.status === "failed" ? "destructive" : l.status === "delivered" ? "default" : "secondary"}>{l.status}</Badge></TableCell>
                          <TableCell className="text-right text-xs">{l.retries}</TableCell>
                          <TableCell className="text-right">
                            {l.status === "failed" && <Button size="sm" variant="ghost" onClick={() => retry(l.id)}><RotateCcw className="h-4 w-4" /></Button>}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}
