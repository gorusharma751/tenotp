import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Bell, CheckCheck, Trash2 } from "lucide-react";
import { useNotificationStore } from "@/store/notificationStore";
import { dateTime } from "@/utils/format";

// TODO(backend): no REST notifications API exists yet (only the realtime SSE
// "notification" event does, see RealtimeOtpPopup) — this reuses the local
// notificationStore (same one DashboardShell's header bell reads) instead of
// inventing a /api/notifications endpoint.
export function NotificationBell() {
  const items = useNotificationStore((s) => s.items);
  const markAllRead = useNotificationStore((s) => s.markAllRead);
  const markRead = useNotificationStore((s) => s.markRead);
  const unread = items.filter((n) => !n.read).length;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="relative">
          <Bell className="h-5 w-5" />
          {unread > 0 && <Badge className="absolute -top-1 -right-1 h-4 min-w-4 px-1 text-[10px] rounded-full">{unread}</Badge>}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80">
        <DropdownMenuLabel className="flex items-center justify-between">
          <span>Notifications</span>
          <Button variant="ghost" size="sm" onClick={markAllRead}><CheckCheck className="h-3.5 w-3.5 mr-1" />Mark all</Button>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <div className="max-h-80 overflow-y-auto">
          {items.length === 0 && <div className="p-4 text-xs text-muted-foreground">You're all caught up.</div>}
          {items.slice(0, 10).map((n) => (
            <DropdownMenuItem key={n.id} onClick={() => markRead(n.id)} className="flex flex-col items-start gap-1 py-2">
              <div className="flex w-full items-start gap-2">
                {!n.read && <span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-primary shrink-0" />}
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium truncate">{n.title}</div>
                  <div className="text-xs text-muted-foreground line-clamp-2">{n.body}</div>
                  <div className="text-[10px] text-muted-foreground mt-1">{dateTime(n.createdAt)} · {n.type}</div>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6"
                  onClick={(e) => {
                    e.stopPropagation();
                  }}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            </DropdownMenuItem>
          ))}
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
