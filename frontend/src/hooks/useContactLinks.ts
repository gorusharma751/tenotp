import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/apiClient";

export interface ContactLinks {
  telegramGroup: string;
  telegramSupport: string;
  whatsapp: string;
  announcementTitle: string;
  announcementText: string;
  announcementVersion: string;
}

// Public (no-auth) read of the app_settings-backed contact links, added at
// GET /api/public/contact-links (backend/src/routes/public.ts) alongside the
// existing admin-only GET/POST /api/admin/contact-links pair.
export function useContactLinks() {
  return useQuery<ContactLinks>({
    queryKey: ["contact-links"],
    staleTime: 5 * 60 * 1000,
    queryFn: () => api.get<ContactLinks>("/api/public/contact-links"),
    retry: false,
  });
}
