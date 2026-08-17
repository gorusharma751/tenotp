// Replaces `createServerFn`/`useServerFn` calls from the old monolith — every
// former server function is now a REST endpoint on the separate backend.
// The session token (issued by POST /api/auth/signup|signin) is stored here
// and sent as `Authorization: Bearer <token>` on every request.

const BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:8787";
const TOKEN_KEY = "tenotp_token";

export function getToken(): string | null {
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

export function setToken(token: string | null) {
  try {
    if (token) localStorage.setItem(TOKEN_KEY, token);
    else localStorage.removeItem(TOKEN_KEY);
  } catch {
    /* localStorage unavailable (private mode, etc.) — session just won't persist across reloads */
  }
}

export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

type RequestOptions = { method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE"; data?: unknown };

/** Core request helper — every apiClient.* below is a thin wrapper over this. */
export async function apiRequest<T = unknown>(path: string, opts: RequestOptions = {}): Promise<T> {
  const token = getToken();
  const headers: Record<string, string> = { "content-type": "application/json" };
  if (token) headers.authorization = `Bearer ${token}`;

  const res = await fetch(`${BASE_URL}${path}`, {
    method: opts.method ?? (opts.data !== undefined ? "POST" : "GET"),
    headers,
    body: opts.data !== undefined ? JSON.stringify(opts.data) : undefined,
  });

  const text = await res.text();
  let body: unknown = null;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = text;
  }

  if (!res.ok) {
    const message = (body as { error?: string } | null)?.error || `Request failed (${res.status})`;
    throw new ApiError(message, res.status);
  }
  return body as T;
}

/** Convenience wrappers matching the old `createServerFn({data})` call shape,
 * so component code that did `await someFn({ data: input })` only needs the
 * import + endpoint swapped, not its call site restructured. */
export const api = {
  get: <T = unknown>(path: string) => apiRequest<T>(path, { method: "GET" }),
  post: <T = unknown>(path: string, data?: unknown) => apiRequest<T>(path, { method: "POST", data: data ?? {} }),
  put: <T = unknown>(path: string, data?: unknown) => apiRequest<T>(path, { method: "PUT", data: data ?? {} }),
  patch: <T = unknown>(path: string, data?: unknown) => apiRequest<T>(path, { method: "PATCH", data: data ?? {} }),
  del: <T = unknown>(path: string) => apiRequest<T>(path, { method: "DELETE" }),
};

export { BASE_URL as API_BASE_URL };
