import { PageHeader } from "@/components/common/PageHeader";
import { EmptyState } from "@/components/common/EmptyState";
import { Clock } from "lucide-react";

// TODO(backend): no /api/rentals endpoint is ported yet.
export default function Rentals() {
  return (
    <div>
      <PageHeader title="Rental numbers" description="Long-term numbers you keep for days or months." />
      <EmptyState icon={<Clock className="h-6 w-6" />} title="No rentals yet" description="Rent a number to receive messages for days or months." />
    </div>
  );
}
