import { PageHeader } from "@/components/common/PageHeader";
import { EmptyState } from "@/components/common/EmptyState";
import { ClipboardList } from "lucide-react";

// TODO(backend): the monolith's Order Management lifecycle (drafts, invoices,
// full audit trail) was backed by mock/local server functions, not a real
// Mongo-backed API — no equivalent was ported to the backend, so this stays
// an empty-state stub rather than inventing endpoints. Day-to-day order
// tracking lives on /dashboard/orders (backed by the real /api/otp/* routes).
export default function OrderManagement() {
  return (
    <div>
      <PageHeader title="Order Management" description="Complete lifecycle, invoicing, and audit for every order." />
      <EmptyState
        icon={<ClipboardList className="h-6 w-6" />}
        title="Order Management module ready"
        description="Full order lifecycle tooling will populate this page once its backend API is ported. For real-time order tracking, see Orders."
      />
    </div>
  );
}
