import { Button } from "@/components/ui/button";
import { MessageCircle, Send } from "lucide-react";
import { useContactLinks } from "@/hooks/useContactLinks";

export function ContactButtons({ compact = false }: { compact?: boolean }) {
  const { data } = useContactLinks();
  const tg = data?.telegramGroup || data?.telegramSupport;
  const wa = data?.whatsapp;
  if (!tg && !wa) return null;
  return (
    <>
      {tg && (
        <Button asChild size={compact ? "icon" : "sm"} variant="outline" title="Telegram" className={compact ? "h-8 w-8" : "h-8 sm:h-9 gap-1.5 px-2 sm:px-3 text-xs sm:text-sm border-[#229ED9]/40 text-[#229ED9] hover:bg-[#229ED9]/10"}>
          <a href={tg} target="_blank" rel="noopener noreferrer" aria-label="Telegram">
            <Send className="h-4 w-4" />
            {!compact && <span className="hidden sm:inline">Telegram</span>}
          </a>
        </Button>
      )}
      {wa && (
        <Button asChild size={compact ? "icon" : "sm"} variant="outline" title="WhatsApp" className={compact ? "h-8 w-8" : "h-8 sm:h-9 gap-1.5 px-2 sm:px-3 text-xs sm:text-sm border-[#25D366]/40 text-[#25D366] hover:bg-[#25D366]/10"}>
          <a href={wa} target="_blank" rel="noopener noreferrer" aria-label="WhatsApp">
            <MessageCircle className="h-4 w-4" />
            {!compact && <span className="hidden sm:inline">WhatsApp</span>}
          </a>
        </Button>
      )}
    </>
  );
}