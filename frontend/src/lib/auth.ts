// Client-side auth — replaces the monolith's `src/lib/auth.ts` (which called
// TanStack Start server functions in `src/lib/auth.functions.ts`). Same
// exported function signatures, but every call goes through the backend's
// REST API via apiClient instead.
import { safeError } from "@/lib/errors";
import { emailSchema, passwordSchema, nameSchema, referralCodeSchema } from "@/lib/validation";
import { useUserStore } from "@/store/userStore";
import { api, setToken } from "@/lib/apiClient";
import type { User } from "@/types";

export interface SignUpInput {
  email: string;
  password: string;
  name?: string;
  referralCode?: string;
}

interface AuthResponse {
  token: string;
  user: User;
}

function applyToStore(u: User | null) {
  useUserStore.setState((s) => ({
    ...s,
    user: !u ? null : u.role === "user" || u.role === "admin" ? u : s.user,
    admin: u?.role === "admin" ? u : s.admin,
  }));
}

export async function signUp(input: SignUpInput) {
  const email = emailSchema.parse(input.email);
  const password = passwordSchema.parse(input.password);
  const name = input.name ? nameSchema.parse(input.name) : undefined;
  const referralCode = input.referralCode
    ? referralCodeSchema.parse(input.referralCode)
    : undefined;
  try {
    const res = await api.post<AuthResponse>("/api/auth/signup", { email, password, name, referralCode });
    setToken(res.token);
    applyToStore(res.user);
    return { user: res.user };
  } catch (error) {
    throw safeError(error);
  }
}

export async function signIn(emailInput: string, passwordInput: string) {
  const email = emailSchema.parse(emailInput);
  const password = passwordSchema.parse(passwordInput);
  try {
    const res = await api.post<AuthResponse>("/api/auth/signin", { email, password });
    setToken(res.token);
    applyToStore(res.user);
    return { user: res.user };
  } catch (error) {
    throw safeError(error);
  }
}

export async function signOut() {
  setToken(null);
  useUserStore.setState({ user: null, admin: null });
}

export async function sendPasswordReset(emailInput: string) {
  const email = emailSchema.parse(emailInput);
  try {
    await api.post("/api/auth/password-reset/request", { email });
  } catch (error) {
    throw safeError(error);
  }
}

export async function updatePassword(newPasswordInput: string, resetToken?: string) {
  const newPassword = passwordSchema.parse(newPasswordInput);
  try {
    await api.post("/api/auth/password-reset/confirm", { newPassword, resetToken });
  } catch (error) {
    throw safeError(error);
  }
}

export async function syncSessionToStore() {
  try {
    const user = await api.get<User>("/api/auth/session");
    applyToStore(user);
  } catch (error) {
    console.error("[auth] session sync failed", error);
    applyToStore(null);
  }
}
