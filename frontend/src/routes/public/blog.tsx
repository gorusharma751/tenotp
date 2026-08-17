import { PageHeader } from "@/components/common/PageHeader";
import { EmptyState } from "@/components/common/EmptyState";

export default function Blog() {
  return (
    <div>
      <PageHeader title="Blog" description="Product updates and articles" />
      <EmptyState title="Blog module ready" description="Backend integration will populate this page. UI, hooks, and mock data layer are already wired." />
    </div>
  );
}
