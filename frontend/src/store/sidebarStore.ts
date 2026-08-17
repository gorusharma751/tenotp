import { create } from "zustand";
import { persist } from "zustand/middleware";

interface SidebarState {
  collapsed: boolean;
  lastOpenGroup: string | null;
  toggle: () => void;
  setCollapsed: (v: boolean) => void;
  setGroup: (g: string) => void;
}

export const useSidebarStore = create<SidebarState>()(
  persist(
    (set) => ({
      collapsed: false,
      lastOpenGroup: "Main",
      toggle: () => set((s) => ({ collapsed: !s.collapsed })),
      setCollapsed: (v) => set({ collapsed: v }),
      setGroup: (g) => set({ lastOpenGroup: g }),
    }),
    { name: "getotp-sidebar" },
  ),
);
