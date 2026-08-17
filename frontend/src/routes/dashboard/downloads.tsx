import { PageHeader } from "@/components/common/PageHeader";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Download, FileText } from "lucide-react";
import { toast } from "sonner";

const FILES = [
  { id: "inv_2607", type: "Invoice", label: "Invoice — July 2026", date: "2026-07-01", size: "82 KB" },
  { id: "inv_2606", type: "Invoice", label: "Invoice — June 2026", date: "2026-06-01", size: "76 KB" },
  { id: "rcp_9812", type: "Receipt", label: "Deposit receipt", date: "2026-07-10", size: "24 KB" },
  { id: "rpt_302", type: "Report", label: "Usage report Q2 2026", date: "2026-07-05", size: "412 KB" },
];

// TODO(backend): no /api/downloads endpoint is ported yet — illustrative list.
export default function Downloads() {
  return (
    <div>
      <PageHeader title="Downloads" description="Invoices, receipts and account reports." />
      <Card className="shadow-soft"><CardContent className="p-0"><Table>
        <TableHeader><TableRow><TableHead>Type</TableHead><TableHead>File</TableHead><TableHead>Date</TableHead><TableHead>Size</TableHead><TableHead className="text-right">Action</TableHead></TableRow></TableHeader>
        <TableBody>
          {FILES.map((f) => (
            <TableRow key={f.id}>
              <TableCell><Badge variant="secondary">{f.type}</Badge></TableCell>
              <TableCell className="flex items-center gap-2"><FileText className="h-4 w-4 text-muted-foreground" />{f.label}</TableCell>
              <TableCell className="text-sm text-muted-foreground">{f.date}</TableCell>
              <TableCell className="text-sm text-muted-foreground">{f.size}</TableCell>
              <TableCell className="text-right">
                <Button size="sm" variant="outline" onClick={() => toast.success(`Downloading ${f.id}…`)}><Download className="h-3.5 w-3.5 mr-1" />Download</Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table></CardContent></Card>
    </div>
  );
}
