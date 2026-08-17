import { PageHeader } from "@/components/common/PageHeader";
import { EmptyState } from "@/components/common/EmptyState";
import { Rss } from "lucide-react";

// TODO(backend): no /api/events endpoint is ported yet.
export default function EventTimelinePage() {
  return (
    <div>
      <PageHeader title="Event timeline" description="Every event emitted by the platform, in order." />
      <EmptyState icon={<Rss className="h-6 w-6" />} title="No events yet" description="Platform activity will stream here." />
    </div>
  );
}
