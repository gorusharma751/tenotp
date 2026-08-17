import { PageHeader } from "@/components/common/PageHeader";
import { EmptyState } from "@/components/common/EmptyState";

export default function Page() {
  return (
    <div>
      <PageHeader title="Refund History" description="Approved and pending refunds" />
      <EmptyState title="Refund History module ready" description="Backend integration will populate this page. UI, hooks, and mock data layer are already wired." />
    </div>
  );
}
