import { create } from "zustand";
import type { Notification } from "@/types";

interface NState {
  items: Notification[];
  add: (n: Omit<Notification, "id" | "createdAt" | "read"> & Partial<Pick<Notification, "read">>) => void;
  markAllRead: () => void;
  markRead: (id: string) => void;
}

const seed: Notification[] = [
  { id: "n1", title: "Welcome to TenOTP", body: "Explore your new dashboard.", type: "info", read: false, createdAt: new Date().toISOString() },
  { id: "n2", title: "OTP received", body: "WhatsApp verification code 482910 delivered.", type: "success", read: false, createdAt: new Date(Date.now() - 3600e3).toISOString() },
  { id: "n3", title: "Low balance", body: "Your wallet is below $10.", type: "warning", read: true, createdAt: new Date(Date.now() - 86400e3).toISOString() },
];

export const useNotificationStore = create<NState>((set) => ({
  items: seed,
  add: (n) =>
    set((s) => ({
      items: [
        { id: `n_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`, createdAt: new Date().toISOString(), read: false, ...n },
        ...s.items,
      ],
    })),
  markAllRead: () => set((s) => ({ items: s.items.map((n) => ({ ...n, read: true })) })),
  markRead: (id) => set((s) => ({ items: s.items.map((n) => (n.id === id ? { ...n, read: true } : n)) })),
}));
