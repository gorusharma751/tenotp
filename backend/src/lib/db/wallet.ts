// Atomic money operations — every balance change happens inside a single
// MongoDB multi-document transaction: debit/credit the balance field with
// the ledger insert, so a crash between the two can never happen.
// Requires a replica-set MongoDB (Atlas gives you one by default).
import type { ClientSession } from "mongodb";
import { getMongoClient, getCollection } from "../mongo.ts";
import type { UserDoc } from "../types.ts";

async function withMoneyTransaction<T>(fn: (session: ClientSession) => Promise<T>): Promise<T> {
  const client = await getMongoClient();
  const session = client.startSession();
  try {
    let result: T;
    await session.withTransaction(async () => {
      result = await fn(session);
    });
    return result!;
  } finally {
    await session.endSession();
  }
}

export type WalletTxDoc = {
  _id: string;
  userId: string;
  type: "deposit" | "purchase" | "refund" | "bonus" | "adjustment" | "referral";
  amount: number;
  balanceAfter: number | null;
  method?: string | null;
  note?: string | null;
  referenceId?: string | null;
  createdAt: Date;
};

export type OrderDoc = {
  _id: string;
  userId: string;
  serviceId?: string | null;
  serviceName?: string | null;
  countryCode?: string | null;
  countryName?: string | null;
  providerId?: string | null;
  providerName?: string | null;
  operator?: string | null;
  number: string;
  otp?: string | null;
  status: "pending" | "received" | "expired" | "cancelled" | "refunded";
  price: number;
  createdAt: Date;
  expiresAt?: Date | null;
  completedAt?: Date | null;
};

export type OrderEventDoc = {
  _id: string;
  orderId: string;
  action: string;
  statusCode?: number | null;
  activationId?: string | null;
  note?: string | null;
  createdAt: Date;
};

async function insertWalletTx(session: ClientSession, tx: Omit<WalletTxDoc, "_id" | "createdAt">): Promise<WalletTxDoc> {
  const col = await getCollection<WalletTxDoc>("wallet_tx");
  const doc: WalletTxDoc = { _id: crypto.randomUUID(), createdAt: new Date(), ...tx };
  await col.insertOne(doc, { session });
  return doc;
}

export async function purchaseOtp(input: {
  userId: string; serviceId: string; serviceName: string; countryCode: string; countryName: string;
  providerId: string; providerName: string; operator: string; number: string; price: number; expiresAt: string;
  /** Set when the buyer belongs to a reseller panel — the panel's markup is
   * already baked into `price`; this is the margin (price minus the
   * platform-default price) that gets credited to the panel's own wallet as
   * the reseller's commission, atomically with the purchase. */
  resellerCommission?: { panelId: string; amount: number };
}): Promise<{ orderId: string; newBalance: number }> {
  return withMoneyTransaction(async (session) => {
    const users = await getCollection<UserDoc>("users");
    const user = await users.findOne({ _id: input.userId }, { session });
    if (!user) throw new Error("User not found");
    if (user.status === "frozen" || user.status === "blocked") {
      throw new Error("Your account cannot make purchases right now. Contact support.");
    }
    if (Number(user.walletBalance) < input.price) {
      throw new Error(`Insufficient balance. Need ₹${input.price.toFixed(2)}, have ₹${Number(user.walletBalance).toFixed(2)}. Please add funds.`);
    }
    const newBalance = Number((Number(user.walletBalance) - input.price).toFixed(2));
    const updated = await users.findOneAndUpdate(
      { _id: input.userId, walletBalance: user.walletBalance },
      { $set: { walletBalance: newBalance, updatedAt: new Date() } },
      { session, returnDocument: "after" },
    );
    if (!updated) throw new Error("Balance changed, please retry the purchase");

    const orders = await getCollection<OrderDoc>("orders");
    const order: OrderDoc = {
      _id: crypto.randomUUID(), userId: input.userId, serviceId: input.serviceId, serviceName: input.serviceName,
      countryCode: input.countryCode, countryName: input.countryName, providerId: input.providerId,
      providerName: input.providerName, operator: input.operator, number: input.number, otp: null,
      status: "pending", price: input.price, createdAt: new Date(), expiresAt: new Date(input.expiresAt), completedAt: null,
    };
    await orders.insertOne(order, { session });
    await insertWalletTx(session, {
      userId: input.userId, type: "purchase", amount: -input.price, balanceAfter: newBalance,
      method: null, note: `Purchase: ${input.serviceName}`, referenceId: order._id,
    });

    if (input.resellerCommission && input.resellerCommission.amount > 0) {
      const panels = await getCollection<{ _id: string; walletBalance: number }>("reseller_panels");
      const panel = await panels.findOne({ _id: input.resellerCommission.panelId }, { session });
      if (panel) {
        const panelNewBalance = Number((Number(panel.walletBalance) + input.resellerCommission.amount).toFixed(2));
        await panels.updateOne(
          { _id: panel._id },
          { $set: { walletBalance: panelNewBalance, updatedAt: new Date() } },
          { session },
        );
        const ledger = await getCollection("reseller_wallet_tx");
        await ledger.insertOne(
          {
            _id: crypto.randomUUID(), panelId: panel._id, type: "credit", amount: input.resellerCommission.amount,
            balanceAfter: panelNewBalance, note: `Commission: ${input.serviceName} purchase by ${user.email}`,
            createdAt: new Date(),
          } as never,
          { session },
        );
      }
    }

    return { orderId: order._id, newBalance };
  });
}

export async function refundOrder(orderId: string, reason: string): Promise<number> {
  return withMoneyTransaction(async (session) => {
    const orders = await getCollection<OrderDoc>("orders");
    const order = await orders.findOne({ _id: orderId }, { session });
    if (!order) throw new Error("Order not found");
    if (order.status === "refunded") throw new Error("Order already refunded");
    if (order.status === "received") throw new Error("OTP already received, cannot refund");

    const users = await getCollection<UserDoc>("users");
    const user = await users.findOne({ _id: order.userId }, { session });
    if (!user) throw new Error("Order owner not found");
    const newBalance = Number((Number(user.walletBalance) + order.price).toFixed(2));

    await users.updateOne({ _id: order.userId }, { $set: { walletBalance: newBalance, updatedAt: new Date() } }, { session });
    await orders.updateOne({ _id: orderId }, { $set: { status: "refunded" } }, { session });
    await insertWalletTx(session, {
      userId: order.userId, type: "refund", amount: order.price, balanceAfter: newBalance,
      method: null, note: reason || "Order refunded", referenceId: orderId,
    });
    return newBalance;
  });
}

export async function approveDeposit(depositId: string, approvedBy?: string): Promise<number> {
  return withMoneyTransaction(async (session) => {
    const deposits = await getCollection<{ _id: string; userId: string; amount: number; status: string }>("deposits");
    const deposit = await deposits.findOne({ _id: depositId }, { session });
    if (!deposit) throw new Error("Deposit not found");
    if (deposit.status !== "pending") throw new Error("Deposit already processed");

    const users = await getCollection<UserDoc>("users");
    const user = await users.findOne({ _id: deposit.userId }, { session });
    if (!user) throw new Error("Depositor not found");
    const newBalance = Number((Number(user.walletBalance) + Number(deposit.amount)).toFixed(2));

    await users.updateOne({ _id: deposit.userId }, { $set: { walletBalance: newBalance, updatedAt: new Date() } }, { session });
    await deposits.updateOne(
      { _id: depositId },
      { $set: { status: "approved", approvedAt: new Date(), approvedBy: approvedBy ?? null } },
      { session },
    );
    await insertWalletTx(session, {
      userId: deposit.userId, type: "deposit", amount: Number(deposit.amount), balanceAfter: newBalance,
      method: "manual", note: "Deposit approved", referenceId: depositId,
    });
    return newBalance;
  });
}

/** Rejects a pending manual-review deposit (no money moves) — e.g. the UTR
 * didn't actually match a real payment. */
export async function rejectDeposit(depositId: string, rejectedBy: string, reason: string): Promise<void> {
  const deposits = await getCollection<{ _id: string; status: string }>("deposits");
  const deposit = await deposits.findOne({ _id: depositId });
  if (!deposit) throw new Error("Deposit not found");
  if (deposit.status !== "pending") throw new Error("Deposit already processed");
  await deposits.updateOne(
    { _id: depositId },
    { $set: { status: "rejected", approvedAt: new Date(), approvedBy: rejectedBy, adminNote: reason || "Rejected by admin" } },
  );
}

export async function redeemGiftCode(userId: string, code: string): Promise<{ newBalance: number; amount: number }> {
  return withMoneyTransaction(async (session) => {
    const coupons = await getCollection<{
      _id: string; code: string; type: string; value: number; used: number; usageLimit: number;
      expiresAt: Date | null; enabled: boolean;
    }>("coupons");
    const coupon = await coupons.findOne({ code: code.toUpperCase() }, { session });
    if (!coupon || !coupon.enabled || coupon.type !== "gift") throw new Error("Invalid gift code");
    if (coupon.expiresAt && coupon.expiresAt.getTime() < Date.now()) throw new Error("This code has expired");
    if (coupon.usageLimit > 0 && coupon.used >= coupon.usageLimit) throw new Error("This code has been fully redeemed");

    const redemptions = await getCollection<{ _id: string; couponId: string; userId: string }>("coupon_redemptions");
    const already = await redemptions.findOne({ couponId: coupon._id, userId }, { session });
    if (already) throw new Error("You already redeemed this code");

    const users = await getCollection<UserDoc>("users");
    const user = await users.findOne({ _id: userId }, { session });
    if (!user) throw new Error("User not found");
    const amount = Number(coupon.value);
    const newBalance = Number((Number(user.walletBalance) + amount).toFixed(2));

    await users.updateOne({ _id: userId }, { $set: { walletBalance: newBalance, updatedAt: new Date() } }, { session });
    await coupons.updateOne({ _id: coupon._id }, { $inc: { used: 1 } }, { session });
    await redemptions.insertOne(
      { _id: crypto.randomUUID(), couponId: coupon._id, userId, amountCredited: amount, createdAt: new Date() } as never,
      { session },
    );
    await insertWalletTx(session, {
      userId, type: "bonus", amount, balanceAfter: newBalance, method: "gift_code",
      note: `Redeemed ${coupon.code}`, referenceId: coupon._id,
    });
    return { newBalance, amount };
  });
}

export async function settlePaymentOrder(input: {
  paymentOrderId: string; utr: string; providerTransactionId: string | null; amount: number;
  txnStatus: string; txnTime: Date | null; merchantId: string | null; raw: string | null;
}): Promise<{ status: string; credited: boolean; balance: number }> {
  return withMoneyTransaction(async (session) => {
    const paymentOrders = await getCollection<{ _id: string; orderId: string; userId: string; amount: number; status: string }>("payment_orders");
    const order = await paymentOrders.findOne({ _id: input.paymentOrderId }, { session });
    if (!order) throw new Error("Payment order not found");
    if (order.status === "SUCCESS") {
      const users = await getCollection<UserDoc>("users");
      const user = await users.findOne({ _id: order.userId }, { session });
      return { status: "SUCCESS", credited: false, balance: Number(user?.walletBalance ?? 0) };
    }

    const transactions = await getCollection<{ _id: string; utr: string }>("payment_transactions");
    const dupe = await transactions.findOne({ utr: input.utr.toLowerCase() }, { session });
    if (dupe) throw new Error("This transaction has already been processed");

    const users = await getCollection<UserDoc>("users");
    const user = await users.findOne({ _id: order.userId }, { session });
    if (!user) throw new Error("User not found");
    const newBalance = Number((Number(user.walletBalance) + Number(input.amount)).toFixed(2));

    await users.updateOne({ _id: order.userId }, { $set: { walletBalance: newBalance, updatedAt: new Date() } }, { session });
    await paymentOrders.updateOne({ _id: input.paymentOrderId }, { $set: { status: "SUCCESS", paidAt: new Date(), updatedAt: new Date() } }, { session });
    const txId = crypto.randomUUID();
    await transactions.insertOne({
      _id: txId, paymentOrderId: input.paymentOrderId, provider: "bharatpe", providerTransactionId: input.providerTransactionId,
      utr: input.utr.toLowerCase(), merchantId: input.merchantId, amount: input.amount, transactionStatus: input.txnStatus,
      transactionTimestamp: input.txnTime, rawResponseEncrypted: input.raw, verifiedAt: new Date(), createdAt: new Date(),
    } as never, { session });
    const creditLedger = await getCollection("credit_ledger");
    await creditLedger.insertOne({
      _id: crypto.randomUUID(), userId: order.userId, paymentOrderId: input.paymentOrderId, transactionId: txId,
      creditAmount: input.amount, balanceAfter: newBalance, type: "payment", description: "UPI payment settled", createdAt: new Date(),
    } as never, { session });
    await insertWalletTx(session, {
      userId: order.userId, type: "deposit", amount: Number(input.amount), balanceAfter: newBalance,
      method: "upi", note: "Payment gateway settlement", referenceId: input.paymentOrderId,
    });
    const paymentEvents = await getCollection("payment_events");
    await paymentEvents.insertOne({
      _id: crypto.randomUUID(), paymentOrderId: input.paymentOrderId, eventType: "settled", provider: "bharatpe",
      responseSummary: input.txnStatus, createdAt: new Date(),
    } as never, { session });
    return { status: "SUCCESS", credited: true, balance: newBalance };
  });
}

export async function adjustResellerWallet(panelId: string, amount: number, note: string): Promise<number> {
  return withMoneyTransaction(async (session) => {
    const panels = await getCollection<{ _id: string; walletBalance: number }>("reseller_panels");
    const panel = await panels.findOne({ _id: panelId }, { session });
    if (!panel) throw new Error("Reseller panel not found");
    const newBalance = Number((Number(panel.walletBalance) + amount).toFixed(2));
    if (newBalance < 0) throw new Error(`Insufficient panel balance (current: ${panel.walletBalance})`);
    await panels.updateOne({ _id: panelId }, { $set: { walletBalance: newBalance, updatedAt: new Date() } }, { session });
    const ledger = await getCollection("reseller_wallet_tx");
    await ledger.insertOne({
      _id: crypto.randomUUID(), panelId, type: amount >= 0 ? "credit" : "debit", amount, balanceAfter: newBalance, note, createdAt: new Date(),
    } as never, { session });
    return newBalance;
  });
}

export async function adminAdjustWallet(userId: string, amount: number, direction: "credit" | "debit", note: string): Promise<number> {
  return withMoneyTransaction(async (session) => {
    const users = await getCollection<UserDoc>("users");
    const user = await users.findOne({ _id: userId }, { session });
    if (!user) throw new Error("User not found");
    const delta = direction === "credit" ? amount : -amount;
    const newBalance = Number((Number(user.walletBalance) + delta).toFixed(2));
    if (newBalance < 0) throw new Error(`Insufficient balance (current: ${user.walletBalance})`);
    const updated = await users.findOneAndUpdate(
      { _id: userId, walletBalance: user.walletBalance },
      { $set: { walletBalance: newBalance, updatedAt: new Date() } },
      { session, returnDocument: "after" },
    );
    if (!updated) throw new Error("Balance changed, please retry");
    await insertWalletTx(session, {
      userId, type: direction === "credit" ? "deposit" : "adjustment", amount: delta, balanceAfter: newBalance,
      method: "admin", note: note || `Admin ${direction}`, referenceId: null,
    });
    return newBalance;
  });
}

export async function setWalletFrozen(userId: string, frozen: boolean): Promise<string> {
  const users = await getCollection<UserDoc>("users");
  const status = frozen ? "frozen" : "active";
  const res = await users.updateOne({ _id: userId }, { $set: { status, updatedAt: new Date() } });
  if (res.matchedCount === 0) throw new Error("User not found");
  return status;
}

export async function adminUpdateProfile(userId: string, patch: { name?: string; email?: string; phone?: string; status?: string; walletBalance?: number }): Promise<void> {
  const set: Record<string, unknown> = { updatedAt: new Date() };
  if (patch.name !== undefined) set.name = patch.name;
  if (patch.email !== undefined) { set.email = patch.email; set.emailLower = patch.email.toLowerCase(); }
  if (patch.phone !== undefined) set.phone = patch.phone;
  if (patch.status !== undefined) set.status = patch.status;
  if (patch.walletBalance !== undefined) set.walletBalance = patch.walletBalance;
  const users = await getCollection<UserDoc>("users");
  const res = await users.updateOne({ _id: userId }, { $set: set });
  if (res.matchedCount === 0) throw new Error("User not found");
}
