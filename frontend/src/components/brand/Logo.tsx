import { Link } from "@tanstack/react-router";
import { cn } from "@/lib/utils";

const LOGO_URL =
  "https://res.cloudinary.com/dc25i9l4x/image/upload/v1784033724/ChatGPT_Image_Jul_14__2026__06_22_09_PM-removebg-preview_wyh1fg.png";

export function Logo({ className, to = "/" }: { className?: string; to?: string }) {
  return (
    <Link to={to} className={cn("flex items-center gap-2 font-display font-bold text-lg tracking-tight", className)}>
      <img src={LOGO_URL} alt="TenOTP" className="h-8 w-8 object-contain" />
      <span>Ten<span className="text-gradient-brand">OTP</span></span>
    </Link>
  );
}
