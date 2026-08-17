import { useParams } from "@tanstack/react-router";
import { PageHeader } from "@/components/common/PageHeader";
import { EmptyState } from "@/components/common/EmptyState";

// TODO(backend): no order-management "service info" endpoint is ported yet.
export default function ServiceInfo() {
  const { id } = useParams({ strict: false }) as { id: string };
  return (
    <div>
      <PageHeader title={`Service ${id}`} description="Service metadata and routing." />
      <EmptyState title="Service not found" description="This service's details will appear here once available." />
    </div>
  );
}
