import { useEffect, type ReactNode } from "react";
import { Toaster } from "@/components/ui/sonner";
import { useThemeSync } from "@/hooks/useThemeSync";
import { ensureSessionSynced } from "@/lib/auth";
import { useCurrencyStore } from "@/store/currencyStore";

// TODO(notifications agent): the monolith's <RealtimeOtpPopup /> (real-time
// OTP toast, src/components/notifications/RealtimeOtpPopup.tsx) was not part
// of this foundation pass — it depends on realtime/data-fetching pieces that
// belong to another slice of the port. Re-add it here once ported.

export function AppProviders({ children }: { children: ReactNode }) {
  useThemeSync();
  const currency = useCurrencyStore((s) => s.code);
  useEffect(() => {
    // Session lives in a bearer token now (see lib/apiClient.ts) — resolve it
    // once on mount. signIn/signUp/signOut in lib/auth.ts already update the
    // store directly on every auth action within this tab. Route guards
    // (dashboardLayoutRoute/adminLayoutRoute) await this same singleton
    // check themselves before reading the store, so this call and theirs
    // share one in-flight request either way.
    ensureSessionSynced();
  }, []);
  return (
    <>
      <div key={currency} className="contents">
        {children}
      </div>
      <Toaster position="top-right" richColors closeButton />
    </>
  );
}
