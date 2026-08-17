import { PageHeader } from "@/components/common/PageHeader";
import { EmptyState } from "@/components/common/EmptyState";

export default function Page() {
  return (
    <div>
      <PageHeader title="Developer Tools" description="Playground, webhooks, and inspectors" />
      <EmptyState title="Developer Tools module ready" description="Backend integration will populate this page. UI, hooks, and mock data layer are already wired." />
    </div>
  );
}
