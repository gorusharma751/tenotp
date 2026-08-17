import { PageHeader } from "@/components/common/PageHeader";
import { EmptyState } from "@/components/common/EmptyState";
import { Megaphone } from "lucide-react";

// TODO(backend): no /api/announcements endpoint is ported yet.
export default function Announcements() {
  return (
    <div>
      <PageHeader title="Announcements" description="Product updates, security advisories and roadmap news." />
      <EmptyState icon={<Megaphone className="h-6 w-6" />} title="No announcements yet" description="Product news and updates will appear here." />
    </div>
  );
}
