import { create } from "zustand";
import { persist } from "zustand/middleware";

interface Settings {
  language: string;
  emailNotifications: boolean;
  pushNotifications: boolean;
  smsAlerts: boolean;
  autoRenewRentals: boolean;
  compactTables: boolean;
  set: <K extends keyof Omit<Settings, "set">>(k: K, v: Settings[K]) => void;
}

export const useSettingsStore = create<Settings>()(
  persist(
    (set) => ({
      language: "en",
      emailNotifications: true,
      pushNotifications: true,
      smsAlerts: false,
      autoRenewRentals: false,
      compactTables: false,
      set: (k, v) => set({ [k]: v } as any),
    }),
    { name: "getotp-settings" },
  ),
);
