import { useCurrencyStore, INR_PER_USDT } from "@/store/currencyStore";

// Input `n` is always in INR (base unit). Output formatting follows the
// user's selected currency preference (INR or USDT).
export const formatMoney = (n: number, code: "INR" | "USDT") => {
  if (code === "USDT") {
    const usd = n / INR_PER_USDT;
    const digits = usd >= 1 ? 2 : 4;
    return `$${usd.toLocaleString("en-US", { minimumFractionDigits: digits, maximumFractionDigits: digits })} USDT`;
  }
  return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 2 }).format(n);
};

// Non-reactive (snapshot) — safe for one-off logs / notifications.
export const money = (n: number) => formatMoney(n, useCurrencyStore.getState().code);

// Reactive hook — components re-render on currency toggle.
export const useMoney = () => {
  const code = useCurrencyStore((s) => s.code);
  return (n: number) => formatMoney(n, code);
};
export const dateShort = (s: string) => new Date(s).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
export const dateTime = (s: string) => new Date(s).toLocaleString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
export const timeAgo = (s: string) => {
  const diff = Date.now() - new Date(s).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
};
