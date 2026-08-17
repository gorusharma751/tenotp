import { Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { PageHeader } from "@/components/common/PageHeader";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Search, Plus } from "lucide-react";

interface Ticket { id: string; subject: string; status: string; priority: string; category: string; updatedAt: string }

const NO_TICKETS: Ticket[] = [];

// TODO(backend): no /api/support/tickets endpoints are ported yet — list is
// empty until that API exists (mirrors monolith UI/shape exactly).
export default function Tickets() {
  const data = NO_TICKETS;
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("all");
  const [priority, setPriority] = useState("all");

  const rows = useMemo(() => data.filter((t) =>
    (status === "all" || t.status === status) &&
    (priority === "all" || t.priority === priority) &&
    t.subject.toLowerCase().includes(q.toLowerCase())
  ), [data, q, status, priority]);

  return (
    <div>
      <PageHeader title="Tickets" description="Track all your support requests." actions={
        <Button asChild className="gradient-brand"><Link to="/dashboard/support"><Plus className="h-4 w-4 mr-1" />New ticket</Link></Button>
      } />
      <Card className="shadow-soft"><CardContent className="p-4">
        <div className="flex flex-wrap gap-3 mb-4">
          <div className="relative flex-1 min-w-[220px]"><Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" /><Input placeholder="Search…" className="pl-9" value={q} onChange={(e) => setQ(e.target.value)} /></div>
          <Select value={status} onValueChange={setStatus}><SelectTrigger className="w-[140px]"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">All status</SelectItem><SelectItem value="open">Open</SelectItem><SelectItem value="pending">Pending</SelectItem><SelectItem value="resolved">Resolved</SelectItem><SelectItem value="closed">Closed</SelectItem></SelectContent></Select>
          <Select value={priority} onValueChange={setPriority}><SelectTrigger className="w-[140px]"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">All priority</SelectItem><SelectItem value="low">Low</SelectItem><SelectItem value="medium">Medium</SelectItem><SelectItem value="high">High</SelectItem></SelectContent></Select>
        </div>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader><TableRow><TableHead>ID</TableHead><TableHead>Subject</TableHead><TableHead>Category</TableHead><TableHead>Priority</TableHead><TableHead>Status</TableHead><TableHead>Updated</TableHead></TableRow></TableHeader>
            <TableBody>
              {rows.map((t) => (
                <TableRow key={t.id}>
                  <TableCell><Link to="/dashboard/ticket/$id" params={{ id: t.id }} className="text-primary hover:underline font-mono text-xs">{t.id}</Link></TableCell>
                  <TableCell className="font-medium">{t.subject}</TableCell>
                  <TableCell><Badge variant="secondary">{t.category}</Badge></TableCell>
                  <TableCell><Badge variant="outline">{t.priority}</Badge></TableCell>
                  <TableCell><Badge variant={t.status === "resolved" ? "default" : t.status === "open" ? "secondary" : "outline"}>{t.status}</Badge></TableCell>
                  <TableCell className="text-xs text-muted-foreground">{t.updatedAt}</TableCell>
                </TableRow>
              ))}
              {rows.length === 0 && <TableRow><TableCell colSpan={6} className="text-center text-sm text-muted-foreground py-8">No tickets yet.</TableCell></TableRow>}
            </TableBody>
          </Table>
        </div>
      </CardContent></Card>
    </div>
  );
}
