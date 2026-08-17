// Ported verbatim from src/lib/providers/registry.ts. No adapters are
// registered anywhere in the monolith either — sync jobs for the built-in
// SMS providers (Grizzly/Tiger/SmsBower/...) go through lib/grizzly.ts
// directly, not through this generic adapter registry.
import type { IProviderAdapter } from "./adapter.ts";

const REGISTRY = new Map<string, IProviderAdapter>();

export function registerAdapter(a: IProviderAdapter) {
  REGISTRY.set(a.kind, a);
}
export function getAdapterByKind(kind: string | undefined | null): IProviderAdapter | undefined {
  const k = (kind || "").toLowerCase();
  return REGISTRY.get(k);
}
export function listRegisteredKinds(): string[] {
  return Array.from(REGISTRY.keys());
}
