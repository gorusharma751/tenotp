import { Link } from "@tanstack/react-router";
import { PageHeader } from "@/components/common/PageHeader";
import { EmptyState } from "@/components/common/EmptyState";
import { Button } from "@/components/ui/button";

// TODO(split): not fully ported yet. Payment gateway configuration lives at
// /gourav-ankit-adi/settings (Razorpay/Paytm/BharatPe/Contact-links tabs) —
// this page is a placeholder pointing there. (The old separate "Merchants"
// admin page and its generic multi-provider config were removed — they
// duplicated the Settings page's BharatPe config with a disconnected admin
// surface and an unused customer-facing UPI card; Settings is the one real
// config surface now.)
export default function AdminPayments() {
  return (
    <div>
      <PageHeader title="Payments" description="Payment gateway configuration and deposit orders." />
      <EmptyState
        title="See Settings → Payments"
        description="BharatPe, Razorpay, Paytm and manual UPI are all configured on the Settings page."
        action={
          <Button asChild><Link to={"/gourav-ankit-adi/settings" as any}>Go to Settings</Link></Button>
        }
      />
    </div>
  );
}
