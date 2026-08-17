import { create } from "zustand";
import type { User } from "@/types";

interface UserState {
  user: User | null;
  admin: User | null;
  loginUser: (email: string) => void;   // legacy no-op kept for compat; real auth via lib/auth
  logoutUser: () => void;
  logoutAdmin: () => void;
  updateWallet: (delta: number) => void;
}

export const useUserStore = create<UserState>()((set) => ({
  user: null,
  admin: null,
  loginUser: () => {},
  logoutUser: () => set({ user: null }),
  logoutAdmin: () => set({ admin: null }),
  updateWallet: (delta) =>
    set((s) => (s.user ? { user: { ...s.user, wallet: Math.max(0, s.user.wallet + delta) } } : s)),
}));
