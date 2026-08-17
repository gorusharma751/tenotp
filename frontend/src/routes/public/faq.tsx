import { PageHeader } from "@/components/common/PageHeader";
import { EmptyState } from "@/components/common/EmptyState";

export default function Faq() {
  return (
    <div>
      <PageHeader title="FAQ" description="Frequently asked questions" />
      <EmptyState title="FAQ module ready" description="Backend integration will populate this page. UI, hooks, and mock data layer are already wired." />
    </div>
  );
}
