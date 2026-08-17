import { create } from "zustand";

interface ProviderState {
  q: string;
  category: string;
  status: string;
  env: string;
  setQ: (q: string) => void;
  setCategory: (v: string) => void;
  setStatus: (v: string) => void;
  setEnv: (v: string) => void;
  reset: () => void;
}

const initial = { q: "", category: "all", status: "all", env: "all" };

export const useProviderStore = create<ProviderState>((set) => ({
  ...initial,
  setQ: (q) => set({ q }),
  setCategory: (category) => set({ category }),
  setStatus: (status) => set({ status }),
  setEnv: (env) => set({ env }),
  reset: () => set(initial),
}));
