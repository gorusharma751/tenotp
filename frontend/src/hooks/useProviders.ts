import { useQuery, useQueryClient } from "@tanstack/react-query";
import { providersApi } from "@/lib/providersApi";
import { toast } from "sonner";

export function useProvidersList(query: { q?: string; category?: string; status?: string; env?: string }) {
  return useQuery({ queryKey: ["providers", query], queryFn: () => providersApi.list(query), retry: 1 });
}
export function useProvider(id: string) {
  return useQuery({ queryKey: ["provider", id], queryFn: () => providersApi.get(id) });
}
export function useProviderLogs(id: string) {
  return useQuery({ queryKey: ["provider-logs", id], queryFn: () => providersApi.logs(id) });
}
export function useProviderActions(id: string) {
  const qc = useQueryClient();
  const invalidate = () => { qc.invalidateQueries({ queryKey: ["provider", id] }); qc.invalidateQueries({ queryKey: ["providers"] }); qc.invalidateQueries({ queryKey: ["provider-logs", id] }); };
  return {
    async healthCheck() {
      try { const r = await providersApi.healthCheck(id); toast[r.ok ? "success" : "error"](r.ok ? `Healthy · ${r.latencyMs}ms` : `Down · ${r.message}`); invalidate(); }
      catch (e) { toast.error((e as Error).message); }
    },
    async test(payload: Record<string, unknown> = { message: "hello" }) {
      try { const r = await providersApi.test(id, payload); toast[r.ok ? "success" : "error"](r.message); invalidate(); }
      catch (e) { toast.error((e as Error).message); }
    },
    async save(patch: Parameters<typeof providersApi.update>[1]) {
      try { await providersApi.update(id, patch); toast.success("Provider updated"); invalidate(); }
      catch (e) { toast.error((e as Error).message); }
    },
    async toggleEnv(env: "sandbox" | "production", enabled: boolean) {
      try { await providersApi.toggle(id, env, enabled); toast.success(`${env} ${enabled ? "enabled" : "disabled"}`); invalidate(); }
      catch (e) { toast.error((e as Error).message); }
    },
  };
}
