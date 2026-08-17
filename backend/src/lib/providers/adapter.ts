// Generic external provider adapter interface. No provider is hardcoded in core.
// New providers = new adapter file registered in registry.ts.
// Ported verbatim from src/lib/providers/adapter.ts.

export interface RawExternalService {
  externalId: string;
  externalName: string;
  externalCategory?: string;
  baseCost: number;
  currency?: string;
  region?: string;
  meta?: Record<string, unknown>;
}

export interface RawExternalCategory {
  externalId: string;
  externalName: string;
}

export interface AdapterContext {
  providerId: string;
  baseUrl?: string;
  apiKey?: string;
  timeoutMs?: number;
  retries?: number;
  config?: Record<string, unknown>;
}

export interface IProviderAdapter {
  readonly kind: string;
  testConnection(ctx: AdapterContext): Promise<{ ok: boolean; latencyMs: number; message: string }>;
  fetchServices(ctx: AdapterContext): Promise<RawExternalService[]>;
  fetchCategories(ctx: AdapterContext): Promise<RawExternalCategory[]>;
  fetchPrice?(ctx: AdapterContext, externalId: string): Promise<number | null>;
}
