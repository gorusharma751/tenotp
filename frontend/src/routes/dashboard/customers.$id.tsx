import { useParams } from "@tanstack/react-router";
import { PageHeader } from "@/components/common/PageHeader";
import { EmptyState } from "@/components/common/EmptyState";

// TODO(backend): no order-management "customers" endpoint is ported yet.
export default function CustomerDetails() {
  const { id } = useParams({ strict: false }) as { id: string };
  return (
    <div>
      <PageHeader title={`Customer ${id}`} description="Customer profile and orders." />
      <EmptyState title="Customer not found" description="Customer profile details will appear here once available." />
    </div>
  );
}
