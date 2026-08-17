import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Send } from "lucide-react";
import { useContactLinks } from "@/hooks/useContactLinks";

export function TelegramJoinDialog() {
  const { data } = useContactLinks();
  const [open, setOpen] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  const tg = data?.telegramGroup || data?.telegramSupport || "";
  const title = data?.announcementTitle || "Join our Telegram channel";
  const text = data?.announcementText || "Get instant OTP updates, downtime alerts, offers and support.";
  const hasPopupContent = Boolean(tg || data?.announcementTitle || data?.announcementText);

  const storageKey = `tg-join-popup-seen:${data?.announcementVersion || "v1"}`;
  const DAY_MS = 24 * 60 * 60 * 1000;

  useEffect(() => {
    if (!hasPopupContent || dismissed) return;
    try {
      const last = Number(window.localStorage.getItem(storageKey) || 0);
      if (last && Date.now() - last < DAY_MS) return;
    } catch { /* ignore */ }
    const t = window.setTimeout(() => setOpen(true), 350);
    return () => window.clearTimeout(t);
  }, [hasPopupContent, dismissed, storageKey]);

  const close = () => {
    setDismissed(true);
    setOpen(false);
    try {
      window.localStorage.setItem(storageKey, String(Date.now()));
    } catch { /* ignore */ }
  };

  if (!hasPopupContent) return null;

  return (
    <Dialog open={open} onOpenChange={(v) => (v ? setOpen(true) : close())}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-[#229ED9]/10 text-[#229ED9] mb-2">
            <Send className="h-7 w-7" />
          </div>
          <DialogTitle className="text-center">{title}</DialogTitle>
          <DialogDescription className="text-center whitespace-pre-line">{text}</DialogDescription>
        </DialogHeader>
        <DialogFooter className="flex-col sm:flex-col gap-2">
          {tg && (
          <Button asChild className="w-full bg-[#229ED9] hover:bg-[#1b8bc0] text-white">
            <a href={tg} target="_blank" rel="noopener noreferrer" onClick={close}>
              <Send className="h-4 w-4 mr-2" />Open Telegram & Join
            </a>
          </Button>
          )}
          <Button variant="outline" className="w-full" onClick={close}>
            Later
          </Button>
          <p className="text-[11px] text-center text-muted-foreground">
            This reminder appears once every 24 hours.
          </p>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}