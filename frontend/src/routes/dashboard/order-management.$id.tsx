import { useParams } from "@tanstack/react-router";
import { PageHeader } from "@/components/common/PageHeader";
import { EmptyState } from "@/components/common/EmptyState";

// TODO(backend): see order-management.tsx — no lifecycle-order API ported.
export default function OrderManagementDetails() {
  const { id } = useParams({ strict: false }) as { id: string };
  return (
    <div>
      <PageHeader title={`Order ${id}`} description="Full order lifecycle, invoices, and activity." />
      <EmptyState title="Order not found" description="This order's lifecycle details will appear here once available." />
    </div>
  );
}
