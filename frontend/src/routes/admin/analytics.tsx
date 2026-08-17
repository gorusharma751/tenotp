import { useEffect } from "react";
import { useNavigate } from "@tanstack/react-router";

// Analytics has been merged into the Admin Dashboard. Keep the route so any
// deep links (or old bookmarks) still land on the unified page.
export default function AdminAnalyticsRedirect() {
  const navigate = useNavigate();
  useEffect(() => {
    navigate({ to: "/gourav-ankit-adi/dashboard" as any, replace: true });
  }, [navigate]);
  return null;
}
