export type Role = "user" | "admin";

export interface User {
  id: string;
  name: string;
  email: string;
  avatarUrl?: string;
  role: Role;
  createdAt: string;
  wallet: number;
  verified: boolean;
}

export interface Country {
  code: string;
  name: string;
  flag: string;
  numbersAvailable: number;
  priceFrom: number;
}

export interface Service {
  id: string;
  name: string;
  icon: string;
  category: string;
  price: number;
  successRate: number;
}

export type OrderStatus = "pending" | "received" | "expired" | "cancelled";

export interface Order {
  id: string;
  service: string;
  country: string;
  number: string;
  status: OrderStatus;
  otp?: string;
  price: number;
  createdAt: string;
  expiresAt: string;
}

export interface Rental {
  id: string;
  number: string;
  country: string;
  service: string;
  durationDays: number;
  price: number;
  status: "active" | "expired";
  startedAt: string;
  expiresAt: string;
}

export interface WalletTx {
  id: string;
  type: "deposit" | "purchase" | "refund" | "bonus";
  amount: number;
  balance: number;
  method?: string;
  note?: string;
  createdAt: string;
}

export interface Ticket {
  id: string;
  subject: string;
  status: "open" | "pending" | "resolved" | "closed";
  priority: "low" | "medium" | "high";
  category: string;
  updatedAt: string;
  messages: TicketMessage[];
}
export interface TicketMessage {
  id: string;
  from: "user" | "support";
  body: string;
  at: string;
}

export interface Notification {
  id: string;
  title: string;
  body: string;
  type: "info" | "success" | "warning" | "error";
  read: boolean;
  createdAt: string;
}

export interface ApiKey {
  id: string;
  label: string;
  prefix: string;
  createdAt: string;
  lastUsed?: string;
  scopes: string[];
}

export interface StatPoint { label: string; value: number }

export interface AdminUser {
  id: string;
  name: string;
  email: string;
  country: string;
  role: "user" | "reseller" | "admin";
  status: "active" | "suspended" | "pending";
  wallet: number;
  orders: number;
  referral?: string;
  createdAt: string;
  lastLogin?: string;
}

export interface Operator { id: string; name: string; countryCode: string; priority: number; enabled: boolean }

export interface AdminCountry extends Country {
  enabled: boolean;
  operators: number;
  priority: number;
}

export interface AdminService extends Service {
  enabled: boolean;
  countries: number;
  orders: number;
}

export interface NumberInventoryItem {
  id: string;
  number: string;
  countryCode: string;
  service: string;
  operator: string;
  status: "available" | "assigned" | "reserved" | "blocked";
  assignedTo?: string;
  addedAt: string;
}

export interface AdminOrder extends Order {
  user: string;
  userId: string;
  operator: string;
}

export interface AdminWallet {
  userId: string;
  user: string;
  email: string;
  balance: number;
  lifetime: number;
  frozen: boolean;
  updatedAt: string;
}

export interface Payment {
  id: string;
  user: string;
  userId: string;
  method: string;
  amount: number;
  status: "pending" | "completed" | "failed";
  reference: string;
  createdAt: string;
}

export interface Refund {
  id: string;
  orderId: string;
  user: string;
  amount: number;
  reason: string;
  status: "pending" | "approved" | "rejected";
  createdAt: string;
}

export interface Coupon {
  id: string;
  code: string;
  type: "percent" | "flat" | "gift";
  value: number;
  used: number;
  limit: number;
  expiresAt: string;
  enabled: boolean;
}

export interface PriceRule {
  id: string;
  provider_id: string | null;
  scope: "global" | "provider" | "category" | "service";
  scope_ref: string | null;
  markup_type: "percent" | "fixed";
  markup_value: number;
  min_price: number | null;
  max_price: number | null;
  currency: string;
  region: string | null;
  priority: number;
  active: boolean;
  created_at: string;
  updated_at: string;
}

export interface Promotion {
  id: string;
  title: string;
  kind: "banner" | "offer" | "popup" | "announcement";
  audience: string;
  status: "draft" | "scheduled" | "live" | "ended";
  startsAt: string;
  endsAt: string;
  description?: string;
  linkUrl?: string;
  imageUrl?: string;
}

export interface ResellerPanel {
  id: string;
  owner_user_id: string;
  name: string;
  slug: string;
  markup_percent: number;
  wallet_balance: number;
  status: string;
  branding_json: string;
  created_at: string;
  owner_email?: string;
  users_count?: number;
}

export interface ResellerBranding {
  logoUrl?: string;
  primaryColor?: string;
  supportContact?: string;
}

export interface ResellerMember {
  id: string;
  name: string;
  email: string;
  wallet_balance: number;
  is_owner: boolean;
  joined_at: string;
}

export interface ResellerLedgerEntry {
  id: string;
  type: "credit" | "debit";
  amount: number;
  balance_after: number;
  note: string | null;
  created_at: string;
}

export interface AdminRole {
  id: string;
  name: string;
  members: number;
  permissions: string[];
  description: string;
}

export interface AuditEvent {
  id: string;
  actor: string;
  action: string;
  target: string;
  ip: string;
  createdAt: string;
  severity: "info" | "warning" | "critical";
}

export interface MediaAsset {
  id: string;
  name: string;
  folder: string;
  kind: "image" | "logo" | "banner" | "flag" | "icon";
  size: string;
  url: string;
  uploadedAt: string;
}

export interface PermissionModule {
  module: string;
  perms: string[];
}

export interface UserPermission {
  permission_key: string;
  allowed: boolean;
}

export interface AdminNotification {
  id: string;
  title: string;
  body: string;
  channel: "push" | "email" | "sms" | "in-app";
  audience: string;
  status: "draft" | "sent" | "scheduled";
  sentAt?: string;
}

// ============================================================
// Order Management Engine
// ============================================================
export type ManagedOrderStatus =
  | "draft"
  | "pending"
  | "processing"
  | "completed"
  | "cancelled"
  | "failed";

export type ManagedOrderPaymentStatus = "unpaid" | "paid" | "refunded" | "failed";

export interface OrderCustomer {
  id: string;
  name: string;
  email: string;
  avatarUrl?: string;
  country: string;
  since: string;
  totalOrders: number;
  lifetimeValue: number;
}

export interface OrderServiceInfo {
  id: string;
  name: string;
  icon: string;
  category: string;
  countryCode: string;
  countryName: string;
  countryFlag: string;
  operator: string;
}

export interface OrderTimelineEvent {
  id: string;
  status: ManagedOrderStatus;
  title: string;
  description?: string;
  at: string;
  actor?: string;
}

export interface OrderActivityLog {
  id: string;
  action: string;
  detail?: string;
  by: string;
  at: string;
  level: "info" | "success" | "warning" | "error";
}

export interface OrderInvoice {
  id: string;
  number: string;
  issuedAt: string;
  dueAt: string;
  subtotal: number;
  tax: number;
  discount: number;
  total: number;
  currency: string;
  url: string;
}

export interface OrderPayment {
  id: string;
  status: ManagedOrderPaymentStatus;
  method: string;
  reference: string;
  amount: number;
  currency: string;
  paidAt?: string;
}

export interface OrderTransaction {
  id: string;
  type: "charge" | "refund" | "adjustment" | "bonus";
  amount: number;
  balanceAfter: number;
  note?: string;
  at: string;
}

export interface ManagedOrder {
  id: string;
  reference: string;
  status: ManagedOrderStatus;
  paymentStatus: ManagedOrderPaymentStatus;
  amount: number;
  currency: string;
  quantity: number;
  createdAt: string;
  updatedAt: string;
  channel: "web" | "api" | "mobile";
  approvedBy?: string;
  rejectedReason?: string;
  customer: OrderCustomer;
  service: OrderServiceInfo;
  invoice: OrderInvoice;
  payment: OrderPayment;
  timeline: OrderTimelineEvent[];
  activity: OrderActivityLog[];
  transactions: OrderTransaction[];
}

export interface OrderListQuery {
  q?: string;
  status?: ManagedOrderStatus | "all";
  paymentStatus?: ManagedOrderPaymentStatus | "all";
  channel?: "web" | "api" | "mobile" | "all";
  from?: string;
  to?: string;
  page?: number;
  pageSize?: number;
  sort?: "newest" | "oldest" | "amount-desc" | "amount-asc";
}

export interface OrderListResult {
  items: ManagedOrder[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

// ============================================================
// Provider Integration Framework
// ============================================================
export type ProviderEnvironment = "sandbox" | "production";
export type ProviderStatus = "connected" | "disconnected" | "degraded" | "error";
export type ProviderHealth = "healthy" | "degraded" | "down" | "unknown";

export interface ProviderConfig {
  id: string;
  name: string;
  slug: string;
  serverName?: string;
  kind?: string; // adapter kind, e.g. "grizzlysms" or "custom"
  category: "sms" | "email" | "push" | "payment" | "storage" | "otp";
  logo: string;
  status: ProviderStatus;
  environment: ProviderEnvironment;
  baseUrl: string;
  apiKey: string;        // placeholder – masked in UI
  apiSecret: string;     // placeholder – masked in UI
  webhookSecret?: string;
  timeoutMs: number;
  retries: number;
  rateLimitPerMinute: number;
  markupPercent?: number; // extra % added to base API price shown to end user
  health: ProviderHealth;
  lastCheckAt?: string;
  enabledInSandbox: boolean;
  enabledInProduction: boolean;
  successRate: number;
  latencyMs: number;
  createdAt: string;
  updatedAt: string;
}

export interface ProviderLog {
  id: string;
  providerId: string;
  direction: "request" | "response";
  method: "GET" | "POST" | "PUT" | "DELETE";
  path: string;
  status: number;
  latencyMs: number;
  message: string;
  at: string;
  level: "info" | "warning" | "error";
}

// ============================================================
// Notification & Event Framework
// ============================================================
export type NotificationPriority = "low" | "normal" | "high" | "urgent";
export type NotificationCategory = "system" | "billing" | "order" | "security" | "product";

export interface UserNotification {
  id: string;
  title: string;
  body: string;
  category: NotificationCategory;
  priority: NotificationPriority;
  read: boolean;
  actionUrl?: string;
  createdAt: string;
}

export interface Announcement {
  id: string;
  title: string;
  body: string;
  audience: "all" | "users" | "admins" | "resellers";
  pinned: boolean;
  publishedAt: string;
  status: "draft" | "scheduled" | "published" | "archived";
}

export interface EventItem {
  id: string;
  type: string;
  actor: string;
  target?: string;
  payload?: Record<string, unknown>;
  at: string;
  severity: "info" | "success" | "warning" | "error";
}

export interface ChannelLog {
  id: string;
  channel: "email" | "sms" | "push" | "webhook";
  to: string;
  subject?: string;
  body: string;
  status: "queued" | "sent" | "failed" | "delivered";
  at: string;
  retries: number;
}

export interface JobItem {
  id: string;
  name: string;
  queue: string;
  status: "queued" | "running" | "success" | "failed" | "retrying";
  attempts: number;
  maxAttempts: number;
  scheduledAt: string;
  finishedAt?: string;
  duration?: number;
  lastError?: string;
}

export interface HealthMetric {
  key: string;
  label: string;
  value: number;
  unit: string;
  status: "ok" | "warn" | "error";
  since: string;
}

export interface AlertItem {
  id: string;
  title: string;
  detail: string;
  severity: "info" | "warning" | "critical";
  acknowledged: boolean;
  raisedAt: string;
}
