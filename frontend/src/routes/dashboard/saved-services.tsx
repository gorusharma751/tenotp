import { PageHeader } from "@/components/common/PageHeader";
import { EmptyState } from "@/components/common/EmptyState";

export default function Page() {
  return (
    <div>
      <PageHeader title="Saved Services" description="Services you have bookmarked" />
      <EmptyState title="Saved Services module ready" description="Backend integration will populate this page. UI, hooks, and mock data layer are already wired." />
    </div>
  );
}
