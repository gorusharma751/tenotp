import {
  LayoutDashboard, ShoppingCart, Package, Inbox, Clock, Wallet, CreditCard,
  History, Users, KeyRound, User, Shield, Settings, Bell, LifeBuoy, Ticket,
  Activity, Star, Bookmark, Download, ScrollText, Receipt, Undo2, BadgeDollarSign,
  Gauge, Wrench, Puzzle, Globe2, Server, BarChart3, FileWarning, ShieldCheck,
  Megaphone, TicketPercent, Image as ImageIcon, Cog, ClipboardList, HardDrive,
  Users2, KeySquare, BookOpen,
} from "lucide-react";
import { PlugZap, Radio, Rss, Zap, Siren, HeartPulse, Workflow } from "lucide-react";

export type NavItem = { title: string; url: string; icon: any; group?: string };

export const USER_NAV: NavItem[] = [
  { title: "Overview", url: "/dashboard", icon: LayoutDashboard, group: "Main" },
  { title: "How to use", url: "/dashboard/how-to-use", icon: BookOpen, group: "Main" },
  { title: "Buy Number", url: "/dashboard/buy-number", icon: ShoppingCart, group: "Main" },
  { title: "Orders", url: "/dashboard/orders", icon: Package, group: "Main" },
  { title: "OTP Inbox", url: "/dashboard/otp-inbox", icon: Inbox, group: "Main" },

  { title: "Wallet", url: "/dashboard/wallet", icon: Wallet, group: "Billing" },
  { title: "Deposit", url: "/dashboard/deposit", icon: CreditCard, group: "Billing" },
  { title: "Payment History", url: "/dashboard/payment-history", icon: Receipt, group: "Billing" },
  { title: "History", url: "/dashboard/history", icon: History, group: "Billing" },

  { title: "Referrals", url: "/dashboard/referrals", icon: Users, group: "Developer" },
  { title: "API Keys", url: "/dashboard/api-keys", icon: KeyRound, group: "Developer" },

  { title: "Profile", url: "/dashboard/profile", icon: User, group: "Account" },
  { title: "Settings", url: "/dashboard/settings", icon: Settings, group: "Account" },
  { title: "Notifications", url: "/dashboard/notifications", icon: Bell, group: "Account" },
  { title: "Tickets", url: "/dashboard/tickets", icon: Ticket, group: "Account" },
];

export const ADMIN_NAV: NavItem[] = [
  { title: "Dashboard", url: "/gourav-ankit-adi/dashboard", icon: LayoutDashboard, group: "Main" },
  { title: "Users", url: "/gourav-ankit-adi/users", icon: Users, group: "Operations" },
  { title: "Orders", url: "/gourav-ankit-adi/orders", icon: Package, group: "Operations" },
  { title: "Services", url: "/gourav-ankit-adi/services", icon: Puzzle, group: "Operations" },
  { title: "Countries", url: "/gourav-ankit-adi/countries", icon: Globe2, group: "Operations" },

  { title: "Wallets", url: "/gourav-ankit-adi/wallets", icon: Wallet, group: "Finance" },
  { title: "Deposits", url: "/gourav-ankit-adi/deposits", icon: Download, group: "Finance" },
  { title: "Payments", url: "/gourav-ankit-adi/payments", icon: CreditCard, group: "Finance" },
  { title: "Refunds", url: "/gourav-ankit-adi/refunds", icon: Undo2, group: "Finance" },

  { title: "Support", url: "/gourav-ankit-adi/support", icon: LifeBuoy, group: "Support" },
  { title: "Tickets", url: "/gourav-ankit-adi/tickets", icon: Ticket, group: "Support" },

  { title: "Settings", url: "/gourav-ankit-adi/settings", icon: Settings, group: "System" },
  { title: "Providers", url: "/gourav-ankit-adi/providers", icon: PlugZap, group: "System" },
  { title: "Pricing", url: "/gourav-ankit-adi/pricing", icon: BadgeDollarSign, group: "System" },
  { title: "Audit", url: "/gourav-ankit-adi/audit", icon: FileWarning, group: "System" },

  { title: "Admins", url: "/gourav-ankit-adi/gourav-ankit-adis", icon: ShieldCheck, group: "Access" },
  { title: "Resellers", url: "/gourav-ankit-adi/resellers", icon: Users2, group: "Access" },

  { title: "Notifications", url: "/gourav-ankit-adi/notifications", icon: Bell, group: "Marketing" },
  { title: "Coupons", url: "/gourav-ankit-adi/coupons", icon: TicketPercent, group: "Marketing" },
  { title: "Referrals", url: "/gourav-ankit-adi/referrals", icon: Users, group: "Marketing" },
  { title: "Promotions", url: "/gourav-ankit-adi/promotions", icon: Megaphone, group: "Marketing" },
  { title: "Smoke Test", url: "/gourav-ankit-adi/smoke-test", icon: Activity, group: "System" },
];

export const PUBLIC_NAV = [
  { title: "Home", url: "/" },
  { title: "Services", url: "/services" },
  { title: "Countries", url: "/countries" },
  { title: "API", url: "/api" },
  { title: "About", url: "/about-us" },
  { title: "Contact", url: "/contact-us" },
];
