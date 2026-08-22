import { useQuery } from "@tanstack/react-query";
import { PageHeader } from "@/components/common/PageHeader";
import { StatCard } from "@/components/common/StatCard";
import { AdminTable } from "@/components/admin/AdminTable";
import { Users, UserPlus, Activity, Package, ShoppingCart, CheckCircle2, IndianRupee, Wallet } from "lucide-react";
import { api } from "@/lib/apiClient";
import { money, dateTime } from "@/utils/format";
import { Skeleton } from "@/components/ui/skeleton";

// "kitne user bot se hai, kitne number le rahe hai" — every figure here is
// computed live from real users/orders (bot accounts are the ones with a
// telegramId), not a counter that could drift.
interface TelegramStats {
  totalUsers: number; newUsersToday: number; activeUsers: number;
  totalOrders: number; ordersToday: number; completedOrders: number;
  revenue: number; walletBalance: number;
  recentUsers: Array<{ id: string; name: string; username: string | null; telegramId: string | null; wallet: number; createdAt: string }>;
}

export default function AdminTelegram() {
  const q = useQuery({
    queryKey: ["admin", "telegram", "stats"],
    queryFn: () => api.get<TelegramStats>("/api/admin/telegram-stats"),
    refetchInterval: 30000,
  });
  const s = q.data;

  return (
    <div>
      <PageHeader title="Telegram Bot" description="Users and orders coming through the Telegram bot & Mini App." />
      {q.isLoading || !s ? (
        <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">{Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-28 rounded-2xl" />)}</div>
      ) : (
        <>
          <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
            <StatCard label="Bot users" value={String(s.totalUsers)} icon={Users} tone="brand" />
            <StatCard label="New today" value={String(s.newUsersToday)} icon={UserPlus} tone="success" />
            <StatCard label="Active (24h)" value={String(s.activeUsers)} icon={Activity} tone="info" />
            <StatCard label="Wallet held" value={money(s.walletBalance)} icon={Wallet} tone="warning" />
          </div>
          <div className="mt-4 grid gap-4 grid-cols-2 lg:grid-cols-4">
            <StatCard label="Total orders" value={String(s.totalOrders)} icon={Package} tone="brand" />
            <StatCard label="Orders today" value={String(s.ordersToday)} icon={ShoppingCart} tone="info" />
            <StatCard label="Completed" value={String(s.completedOrders)} icon={CheckCircle2} tone="success" />
            <StatCard label="Revenue" value={money(s.revenue)} icon={IndianRupee} tone="success" />
          </div>

          <div className="mt-6">
            <h3 className="text-sm font-semibold mb-3">Newest bot users</h3>
            <AdminTable
              rows={s.recentUsers}
              columns={[
                { key: "n", header: "Name", cell: (u) => u.name },
                { key: "u", header: "Username", cell: (u) => u.username ? <span className="text-xs">@{u.username}</span> : "—" },
                { key: "t", header: "Telegram ID", cell: (u) => <span className="font-mono text-xs">{u.telegramId ?? "—"}</span> },
                { key: "w", header: "Wallet", cell: (u) => money(u.wallet) },
                { key: "d", header: "Joined", cell: (u) => <span className="text-xs">{dateTime(u.createdAt)}</span> },
              ]}
              empty="No bot users yet."
            />
          </div>
        </>
      )}
    </div>
  );
}
