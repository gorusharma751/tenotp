import { create } from "zustand";
import type { ManagedOrderStatus, ManagedOrderPaymentStatus } from "@/types";

export type OrderChannelFilter = "web" | "api" | "mobile" | "all";
export type OrderSort = "newest" | "oldest" | "amount-desc" | "amount-asc";

interface OrderManagementState {
  q: string;
  status: ManagedOrderStatus | "all";
  paymentStatus: ManagedOrderPaymentStatus | "all";
  channel: OrderChannelFilter;
  sort: OrderSort;
  page: number;
  pageSize: number;
  selected: string[];
  setQ: (q: string) => void;
  setStatus: (s: OrderManagementState["status"]) => void;
  setPaymentStatus: (s: OrderManagementState["paymentStatus"]) => void;
  setChannel: (c: OrderChannelFilter) => void;
  setSort: (s: OrderSort) => void;
  setPage: (p: number) => void;
  setPageSize: (n: number) => void;
  toggleSelect: (id: string) => void;
  clearSelection: () => void;
  reset: () => void;
}

const initial = {
  q: "",
  status: "all" as const,
  paymentStatus: "all" as const,
  channel: "all" as const,
  sort: "newest" as const,
  page: 1,
  pageSize: 10,
  selected: [] as string[],
};

export const useOrderManagementStore = create<OrderManagementState>((set) => ({
  ...initial,
  setQ: (q) => set({ q, page: 1 }),
  setStatus: (status) => set({ status, page: 1 }),
  setPaymentStatus: (paymentStatus) => set({ paymentStatus, page: 1 }),
  setChannel: (channel) => set({ channel, page: 1 }),
  setSort: (sort) => set({ sort }),
  setPage: (page) => set({ page }),
  setPageSize: (pageSize) => set({ pageSize, page: 1 }),
  toggleSelect: (id) =>
    set((s) => ({ selected: s.selected.includes(id) ? s.selected.filter((x) => x !== id) : [...s.selected, id] })),
  clearSelection: () => set({ selected: [] }),
  reset: () => set(initial),
}));
