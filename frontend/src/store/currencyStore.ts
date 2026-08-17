import { create } from "zustand";
import { persist } from "zustand/middleware";

// Base amount unit stored in the app is INR. USDT is derived using INR_PER_USDT.
// Fixed rate (USDT is volatile — we lock the display rate at ₹102 / 1 USDT).
export const INR_PER_USDT = 102;

export type CurrencyCode = "INR" | "USDT";

interface CurrencyState {
  code: CurrencyCode;
  setCode: (c: CurrencyCode) => void;
}

export const useCurrencyStore = create<CurrencyState>()(
  persist(
    (set) => ({
      code: "INR",
      setCode: (code) => set({ code }),
    }),
    { name: "tenotp-currency" },
  ),
);
