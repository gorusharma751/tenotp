import { PageHeader } from "@/components/common/PageHeader";
import { EmptyState } from "@/components/common/EmptyState";

export default function Page() {
  return (
    <div>
      <PageHeader title="Integrations" description="Connect third-party apps" />
      <EmptyState title="Integrations module ready" description="Backend integration will populate this page. UI, hooks, and mock data layer are already wired." />
    </div>
  );
}
