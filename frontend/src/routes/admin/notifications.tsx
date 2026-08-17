import { useQuery } from "@tanstack/react-query";
import { PageHeader } from "@/components/common/PageHeader";
import { AdminTable, StatusPill } from "@/components/admin/AdminTable";
import { api } from "@/lib/apiClient";
import { dateTime } from "@/utils/format";
import type { AdminNotification } from "@/types";

// Backend only exposes GET /api/admin/notifications (backend/src/routes/admin.ts) —
// there is no create/broadcast POST endpoint yet, so this page is read-only for now.
export default function Page() {
  const q = useQuery({ queryKey: ["admin", "notifications"], queryFn: () => api.get<AdminNotification[]>("/api/admin/notifications") });

  return (
    <div>
      <PageHeader title="Notifications" description="Broadcast notifications to users." />
      <AdminTable rows={q.data ?? []} columns={[
        { key: "t", header: "Title", cell: (n) => <div><p className="font-medium">{n.title}</p><p className="text-xs text-muted-foreground">{n.body}</p></div> },
        { key: "c", header: "Channel", cell: (n) => <span className="capitalize text-xs">{n.channel}</span> },
        { key: "a", header: "Audience", cell: (n) => n.audience || "—" },
        { key: "st", header: "Status", cell: (n) => <StatusPill status={n.status} /> },
        { key: "s", header: "Sent", cell: (n) => <span className="text-xs">{n.sentAt ? dateTime(n.sentAt) : "—"}</span> },
      ]} empty="No notifications yet" />
    </div>
  );
}
