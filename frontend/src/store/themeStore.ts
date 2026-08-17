import { create } from "zustand";
import { persist } from "zustand/middleware";

type Theme = "light" | "dark";
interface ThemeState { theme: Theme; toggle: () => void; set: (t: Theme) => void }

export const useThemeStore = create<ThemeState>()(
  persist(
    (set) => ({
      theme: "light",
      toggle: () => set((s) => ({ theme: s.theme === "light" ? "dark" : "light" })),
      set: (t) => set({ theme: t }),
    }),
    { name: "getotp-theme" },
  ),
);
