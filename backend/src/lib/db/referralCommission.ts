// "jisne refer kiya usko commission milega" — the referral record has
// existed since signup (routes/auth.ts inserts one, percent: 10) but
// nothing ever actually credited it; totalEarned sat at 0 forever. This is
// the missing piece: called once a referred user's order actually
// completes (OTP received — see routes/otp.ts's /status), credits the
// REFERRER's wallet with `percent`% of that order's price.
import crypto from "node:crypto";
import { getMongoClient, getCollection } from "../mongo.ts";
import type { UserDoc } from "../types.ts";
import type { WalletTxDoc } from "./wallet.ts";

type ReferralDoc = { _id: string; referrerId: string; referredId: string; percent: number; totalEarned: number; createdAt: Date };

/** Best-effort by design — a commission-crediting hiccup should never make
 * the buyer's own OTP-received response fail; it just gets logged. */
export async function creditReferralCommission(buyerUserId: string, orderPrice: number, orderId: string): Promise<void> {
  try {
    const referralsCol = await getCollection<ReferralDoc>("referrals");
    const referral = await referralsCol.findOne({ referredId: buyerUserId });
    if (!referral) return; // this buyer wasn't referred by anyone
    const commission = Number(((Number(orderPrice) * referral.percent) / 100).toFixed(2));
    if (!(commission > 0)) return;

    const client = await getMongoClient();
    const session = client.startSession();
    try {
      await session.withTransaction(async () => {
        const users = await getCollection<UserDoc>("users");
        const referrer = await users.findOne({ _id: referral.referrerId }, { session });
        if (!referrer) return;
        const newBalance = Number((Number(referrer.walletBalance) + commission).toFixed(2));
        await users.updateOne({ _id: referrer._id }, { $set: { walletBalance: newBalance, updatedAt: new Date() } }, { session });
        const walletTxCol = await getCollection<WalletTxDoc>("wallet_tx");
        await walletTxCol.insertOne({
          _id: crypto.randomUUID(), userId: referrer._id, type: "referral", amount: commission, balanceAfter: newBalance,
          method: null, note: `Referral commission (${referral.percent}%) — a user you referred completed a purchase`,
          referenceId: orderId, createdAt: new Date(),
        }, { session });
        await referralsCol.updateOne({ _id: referral._id }, { $inc: { totalEarned: commission } }, { session });
      });
    } finally {
      await session.endSession();
    }

    try {
      const notifCol = await getCollection("notifications");
      await notifCol.insertOne({
        _id: crypto.randomUUID(), userId: referral.referrerId, title: "Referral commission earned",
        body: `You earned ₹${commission.toFixed(2)} commission — someone you referred just completed a purchase.`,
        type: "success", read: false, createdAt: new Date(),
      } as never);
    } catch { /* best-effort */ }
  } catch (err) {
    console.error("[creditReferralCommission] failed:", err instanceof Error ? err.message : err);
  }
}
