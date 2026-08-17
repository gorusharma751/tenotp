import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { providerCatalogApi, serviceMappingsApi, priceRulesApi, syncJobsApi, providerLogsApi, type PriceRuleRow } from "@/lib/providersApi";

export function useProviderServices(providerId: string, query: Parameters<typeof providerCatalogApi.listServices>[1] = {}) {
  return useQuery({ queryKey: ["provider-services", providerId, query], queryFn: () => providerCatalogApi.listServices(providerId, query), enabled: !!providerId });
}
export function useProviderCategoriesList(providerId: string) {
  return useQuery({ queryKey: ["provider-categories-list", providerId], queryFn: () => providerCatalogApi.listCategories(providerId), enabled: !!providerId });
}
export function useServiceMappings(providerId: string) {
  return useQuery({ queryKey: ["service-mappings", providerId], queryFn: () => serviceMappingsApi.listByProvider(providerId), enabled: !!providerId });
}
export function usePriceRules(providerId?: string) {
  return useQuery({ queryKey: ["price-rules", providerId ?? "all"], queryFn: () => priceRulesApi.list(providerId) });
}
export function useSyncHistory(providerId: string) {
  return useQuery({ queryKey: ["sync-history", providerId], queryFn: () => syncJobsApi.history(providerId), enabled: !!providerId });
}
export function useProviderRequestLogs(providerId: string) {
  return useQuery({ queryKey: ["provider-request-logs", providerId], queryFn: () => providerLogsApi.list(providerId), enabled: !!providerId });
}

export function useProviderModuleActions(providerId: string) {
  const qc = useQueryClient();
  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["provider-services", providerId] });
    qc.invalidateQueries({ queryKey: ["provider-categories-list", providerId] });
    qc.invalidateQueries({ queryKey: ["service-mappings", providerId] });
    qc.invalidateQueries({ queryKey: ["sync-history", providerId] });
    qc.invalidateQueries({ queryKey: ["price-rules"] });
    qc.invalidateQueries({ queryKey: ["providers"] });
  };
  return {
    syncServices: useMutation({ mutationFn: () => syncJobsApi.runServicesSync(providerId), onSuccess: (r) => { toast[r.status === "success" ? "success" : "error"](`Services sync ${r.status}`); invalidate(); }, onError: (e: Error) => toast.error(e.message) }),
    syncCategories: useMutation({ mutationFn: () => syncJobsApi.runCategoriesSync(providerId), onSuccess: (r) => { toast[r.status === "success" ? "success" : "error"](`Categories sync ${r.status}`); invalidate(); }, onError: (e: Error) => toast.error(e.message) }),
    healthCheck: useMutation({ mutationFn: () => syncJobsApi.healthCheck(providerId), onSuccess: (r) => { toast[r.ok ? "success" : "error"](r.ok ? `Healthy · ${r.latencyMs}ms` : `Down · ${r.message}`); invalidate(); }, onError: (e: Error) => toast.error(e.message) }),
    createRule: useMutation({ mutationFn: (row: Partial<PriceRuleRow>) => priceRulesApi.create({ ...row, provider_id: providerId }), onSuccess: () => { toast.success("Rule added"); invalidate(); }, onError: (e: Error) => toast.error(e.message) }),
    updateRule: useMutation({ mutationFn: (v: { id: string; patch: Partial<PriceRuleRow> }) => priceRulesApi.update(v.id, v.patch), onSuccess: () => { toast.success("Rule updated"); invalidate(); }, onError: (e: Error) => toast.error(e.message) }),
    deleteRule: useMutation({ mutationFn: (id: string) => priceRulesApi.remove(id), onSuccess: () => { toast.success("Rule removed"); invalidate(); }, onError: (e: Error) => toast.error(e.message) }),
    clearLogs: useMutation({ mutationFn: () => providerLogsApi.clear(providerId), onSuccess: () => { toast.success("Logs cleared"); qc.invalidateQueries({ queryKey: ["provider-request-logs", providerId] }); }, onError: (e: Error) => toast.error(e.message) }),
  };
}
