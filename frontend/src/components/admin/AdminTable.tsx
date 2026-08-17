import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Card } from "@/components/ui/card";
import type { ReactNode } from "react";

export interface Column<T> {
  key: string;
  header: string;
  cell: (row: T) => ReactNode;
  className?: string;
}

export function AdminTable<T>({ rows, columns, empty = "No records found" }: { rows: T[]; columns: Column<T>[]; empty?: string }) {
  return (
    <Card className="shadow-soft overflow-hidden">
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              {columns.map((c) => (
                <TableHead key={c.key} className={c.className}>{c.header}</TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length === 0 ? (
              <TableRow><TableCell colSpan={columns.length} className="py-10 text-center text-sm text-muted-foreground">{empty}</TableCell></TableRow>
            ) : rows.map((row, idx) => (
              <TableRow key={((row as any)?.id) ?? idx}>
                {columns.map((c) => (
                  <TableCell key={c.key} className={c.className}>{c.cell(row)}</TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </Card>
  );
}

export function StatusPill({ status }: { status: string }) {
  const map: Record<string, string> = {
    active: "bg-success/15 text-success",
    completed: "bg-success/15 text-success",
    received: "bg-success/15 text-success",
    approved: "bg-success/15 text-success",
    live: "bg-success/15 text-success",
    sent: "bg-success/15 text-success",
    available: "bg-success/15 text-success",
    pending: "bg-warning/15 text-warning",
    scheduled: "bg-info/15 text-info",
    reserved: "bg-info/15 text-info",
    open: "bg-info/15 text-info",
    resolved: "bg-success/15 text-success",
    draft: "bg-muted text-muted-foreground",
    ended: "bg-muted text-muted-foreground",
    closed: "bg-muted text-muted-foreground",
    assigned: "bg-info/15 text-info",
    failed: "bg-destructive/15 text-destructive",
    rejected: "bg-destructive/15 text-destructive",
    suspended: "bg-destructive/15 text-destructive",
    cancelled: "bg-destructive/15 text-destructive",
    expired: "bg-muted text-muted-foreground",
    blocked: "bg-destructive/15 text-destructive",
    critical: "bg-destructive/15 text-destructive",
    warning: "bg-warning/15 text-warning",
    info: "bg-info/15 text-info",
  };
  return <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium capitalize ${map[status] ?? "bg-muted text-muted-foreground"}`}>{status}</span>;
}
