import { create } from "zustand";
import type { User } from "@/types";

interface UserState {
  user: User | null;
  admin: User | null;
  /** Manual Provider seller — a normal account with "provider" in roles[],
   * populated alongside `user` (see lib/auth.ts applyToStore). Separate
   * slot so the Seller Panel guard doesn't need to re-derive it everywhere. */
  seller: User | null;
  loginUser: (email: string) => void;   // legacy no-op kept for compat; real auth via lib/auth
  logoutUser: () => void;
  logoutAdmin: () => void;
  logoutSeller: () => void;
  updateWallet: (delta: number) => void;
}

export const useUserStore = create<UserState>()((set) => ({
  user: null,
  admin: null,
  seller: null,
  loginUser: () => {},
  logoutUser: () => set({ user: null }),
  logoutAdmin: () => set({ admin: null }),
  logoutSeller: () => set({ seller: null }),
  updateWallet: (delta) =>
    set((s) => (s.user ? { user: { ...s.user, wallet: Math.max(0, s.user.wallet + delta) } } : s)),
}));
