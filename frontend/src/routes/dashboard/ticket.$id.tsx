import { Link, useParams } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/common/PageHeader";
import { ArrowLeft } from "lucide-react";

// TODO(backend): no /api/support/tickets/:id endpoint is ported yet.
export default function TicketPage() {
  const { id } = useParams({ strict: false }) as { id: string };
  return (
    <div>
      <Button asChild variant="ghost" size="sm" className="mb-4"><Link to="/dashboard/tickets"><ArrowLeft className="mr-1 h-4 w-4" />Back</Link></Button>
      <PageHeader title={`Ticket #${id}`} description="Support conversation." />
      <p className="text-sm text-muted-foreground">Ticket not found.</p>
    </div>
  );
}
