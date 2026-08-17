// Single place that turns any thrown value into a safe, user-facing message.
// Full details stay in the console / server logs; users never see stack traces,
// file paths, SQL text or provider payloads.

const SAFE_AUTH_MESSAGES: Array<[RegExp, string]> = [
  [/invalid login credentials/i, "Email or password is incorrect"],
  [/email not confirmed/i, "Please verify your email first"],
  [/user already registered|already been registered/i, "An account with this email already exists"],
  [/password should be at least/i, "Password must be at least 8 characters"],
  [/rate limit|too many requests/i, "Too many attempts — please wait a moment and try again"],
  [/network|fetch failed|failed to fetch/i, "Network problem — check your connection and try again"],
  [/unauthorized|forbidden|not allowed/i, "You don't have permission to do that"],
  [/jwt|session (expired|missing)/i, "Your session expired — please sign in again"],
];

/** Anything that smells like internal detail must never reach the UI. */
function looksInternal(message: string): boolean {
  return (
    message.length > 160 ||
    /(\/|\\)(src|node_modules|home|var|usr)\b/.test(message) ||
    /\b(select|insert|update|delete|from|where)\b.*\b(from|into|table)\b/i.test(message) ||
    /(postgres|pgrst|relation ".*" does not exist|violates .* constraint|duplicate key|column .* does not exist)/i.test(message) ||
    /\bat\s+\w+\s+\(/.test(message)
  );
}

export function toUserMessage(error: unknown, fallback = "Something went wrong. Please try again."): string {
  // Always keep the real error for debugging.
  if (typeof console !== "undefined") console.error("[handled]", error);

  const raw =
    error instanceof Error
      ? error.message
      : typeof error === "string"
        ? error
        : ((error as { message?: unknown } | null)?.message ?? "");
  const message = String(raw ?? "").trim();
  if (!message) return fallback;

  for (const [pattern, safe] of SAFE_AUTH_MESSAGES) if (pattern.test(message)) return safe;
  if (looksInternal(message)) return fallback;
  return message;
}

/** Throwable variant so callers can rethrow without leaking internals. */
export function safeError(error: unknown, fallback?: string): Error {
  return new Error(toUserMessage(error, fallback));
}
