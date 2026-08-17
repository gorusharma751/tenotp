import { useEffect } from "react";
import { useNavigate } from "@tanstack/react-router";

// Monolith's /gourav-ankit-adi/providers/new was a beforeLoad redirect stub
// (no page of its own) — reproduced here as a component that redirects on
// mount, since code-based routing has no beforeLoad hook for this file.
function ProvidersNewRedirect() {
  const navigate = useNavigate();
  useEffect(() => {
    navigate({ to: "/gourav-ankit-adi/providers" as any });
  }, [navigate]);
  return null;
}

export default ProvidersNewRedirect;
