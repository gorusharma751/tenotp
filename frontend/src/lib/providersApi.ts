// Thin typed wrapper over apiClient for /api/providers/* endpoints
// (backend/src/routes/providers.ts) — used by hooks/useProviders.ts and
// hooks/useProviderModule.ts.
import { api } from "@/lib/apiClient";
import type { ProviderConfig } from "@/types";

function qs(query: Record<string, string | number | boolean | undefined>) {
  const params = new URLSearchParams();
  for (const [k, v] of Object.entries(query)) {
    if (v !== undefined && v !== "" && v !== "all") params.set(k, String(v));
  }
  const s = params.toString();
  return s ? `?${s}` : "";
}

export const providersApi = {
  list: (query: { q?: string; category?: string; status?: string; env?: string } = {}) =>
    api.get<ProviderConfig[]>(`/api/providers${qs(query)}`),
  get: (id: string) => api.get<ProviderConfig | null>(`/api/providers/${id}`),
  summary: () =>
    api.get<{
      total: number; connected: number; disconnected: number; healthy: number; degraded: number;
      avgLatency: number; avgSuccess: number;
      byCategory: Record<string, number>;
    }>("/api/providers/summary"),
  logs: (id: string) => api.get<unknown[]>(`/api/providers/${id}/logs`),
  create: (input: Record<string, unknown>) => api.post<ProviderConfig>("/api/providers", input),
  update: (id: string, patch: Record<string, unknown>) => api.patch<ProviderConfig>(`/api/providers/${id}`, patch),
  remove: (id: string) => api.del<{ ok: boolean }>(`/api/providers/${id}`),
  toggle: (id: string, env: "sandbox" | "production", enabled: boolean) =>
    api.post<ProviderConfig>(`/api/providers/${id}/toggle`, { env, enabled }),
  healthCheck: (id: string) => api.post<{ ok: boolean; latencyMs: number; message: string }>(`/api/providers/${id}/health-check`),
  test: (id: string, payload: Record<string, unknown> = { message: "hello" }) =>
    api.post<{ ok: boolean; id: string; message: string }>(`/api/providers/${id}/test`, payload),
  pingAll: () =>
    api.post<Array<{ id: string; name: string; kind: string; ok: boolean; latencyMs: number; status: string; balance: number | null; message: string; checkedAt: string }>>(
      "/api/providers/health/ping-all",
    ),
};

export interface PriceRuleRow {
  id: string; provider_id: string | null; scope: "global" | "provider" | "category" | "service"; scope_ref: string | null;
  markup_type: "percent" | "fixed"; markup_value: number; min_price: number | null; max_price: number | null;
  currency: string; region: string | null; priority: number; active: boolean; created_at: string; updated_at: string;
}

export const priceRulesApi = {
  list: (providerId?: string) => api.get<PriceRuleRow[]>(`/api/providers/price-rules${qs({ providerId })}`),
  create: (row: Partial<PriceRuleRow>) => api.post<PriceRuleRow>("/api/providers/price-rules", row),
  update: (id: string, patch: Partial<PriceRuleRow>) => api.patch<PriceRuleRow>(`/api/providers/price-rules/${id}`, patch),
  remove: (id: string) => api.del<{ ok: boolean }>(`/api/providers/price-rules/${id}`),
};

export interface ServiceMappingRow {
  id: string; internal_service_id: string; provider_id: string; provider_service_id: string;
  priority: number; enabled: boolean; created_at: string; updated_at: string;
}

export const serviceMappingsApi = {
  listByProvider: (providerId: string) => api.get<ServiceMappingRow[]>(`/api/providers/${providerId}/mappings`),
  upsert: (row: { internal_service_id: string; provider_id: string; provider_service_id: string; priority?: number; enabled?: boolean }) =>
    api.post<ServiceMappingRow>("/api/providers/mappings", row),
  bulk: (providerId: string, pairs: Array<{ internal_service_id: string; provider_service_id: string }>) =>
    api.post<{ ok: boolean; count: number }>(`/api/providers/${providerId}/mappings/bulk`, { pairs }),
  remove: (id: string) => api.del<{ ok: boolean }>(`/api/providers/mappings/${id}`),
};

export interface ProviderServiceRow {
  id: string; provider_id: string; external_id: string; external_name: string; external_category: string | null;
  base_cost: number; currency: string; region: string | null; active: boolean; last_seen_at: string;
  meta: Record<string, unknown>; created_at: string; updated_at: string;
}
export interface ProviderCategoryRow {
  id: string; provider_id: string; external_id: string; external_name: string; internal_category: string | null;
  active: boolean; created_at: string; updated_at: string;
}

export const providerCatalogApi = {
  listServices: (
    providerId: string,
    query: { q?: string; category?: string; active?: boolean; sort?: string; page?: number; pageSize?: number } = {},
  ) => api.get<{ items: ProviderServiceRow[]; total: number }>(`/api/providers/${providerId}/catalog/services${qs(query as any)}`),
  listCategories: (providerId: string) => api.get<ProviderCategoryRow[]>(`/api/providers/${providerId}/catalog/categories`),
  setCategoryMapping: (catId: string, internalCategory: string | null) =>
    api.post<{ ok: boolean }>(`/api/providers/catalog/categories/${catId}/mapping`, { internalCategory }),
  setServiceActive: (svcId: string, active: boolean) =>
    api.post<{ ok: boolean }>(`/api/providers/catalog/services/${svcId}/active`, { active }),
};

export interface SyncLogRow {
  id: string; provider_id: string; job_type: "services" | "categories" | "prices" | "health";
  status: "pending" | "running" | "success" | "failed"; started_at: string; finished_at: string | null;
  items_in: number; items_out: number; error: string | null; summary: Record<string, unknown>;
}

export const syncJobsApi = {
  history: (providerId: string, limit?: number) => api.get<SyncLogRow[]>(`/api/providers/${providerId}/sync/history${qs({ limit })}`),
  runServicesSync: (providerId: string) => api.post<SyncLogRow>(`/api/providers/${providerId}/sync/services`),
  runCategoriesSync: (providerId: string) => api.post<SyncLogRow>(`/api/providers/${providerId}/sync/categories`),
  healthCheck: (providerId: string) => api.post<{ ok: boolean; latencyMs: number; message: string }>(`/api/providers/${providerId}/sync/health`),
};

export interface ProviderLogRow {
  id: string; provider_id: string; direction: "in" | "out"; method: string; path: string;
  status: number; latency_ms: number; request: Record<string, unknown>; response: Record<string, unknown>; at: string;
}

export const providerLogsApi = {
  list: (providerId: string, limit?: number) => api.get<ProviderLogRow[]>(`/api/providers/${providerId}/log-entries${qs({ limit })}`),
  clear: (providerId: string) => api.del<{ ok: boolean }>(`/api/providers/${providerId}/log-entries`),
};
