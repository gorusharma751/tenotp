import { Router } from "express";
import { getCollection } from "../lib/mongo.ts";
import { requireAuth } from "../middleware/auth.ts";
import type { UserDoc } from "../lib/types.ts";
import type { WalletTxDoc } from "../lib/db/wallet.ts";

export const walletRouter = Router();

walletRouter.get("/balance", requireAuth, async (req, res) => {
  const users = await getCollection<UserDoc>("users");
  const u = await users.findOne({ _id: req.auth.userId });
  res.json({ balance: Number(u?.walletBalance ?? 0) });
});

walletRouter.get("/transactions", requireAuth, async (req, res) => {
  const tx = await getCollection<WalletTxDoc>("wallet_tx");
  const rows = await tx.find({ userId: req.auth.userId }).sort({ createdAt: -1 }).limit(200).toArray();
  res.json(
    rows.map((x) => ({
      id: x._id,
      type: x.type === "referral" || x.type === "adjustment" ? "bonus" : x.type,
      amount: Number(x.amount),
      balance: Number(x.balanceAfter ?? 0),
      method: x.method ?? undefined,
      note: x.note ?? undefined,
      createdAt: x.createdAt.toISOString(),
    })),
  );
});

walletRouter.post("/redeem-gift-code", requireAuth, async (req, res) => {
  try {
    const code = String(req.body?.code ?? "").trim();
    if (!code) throw new Error("Gift code required");
    const { redeemGiftCode } = await import("../lib/db/wallet.ts");
    const result = await redeemGiftCode(req.auth.userId, code);
    res.json(result);
  } catch (err) {
    res.status(400).json({ error: err instanceof Error ? err.message : "Redeem failed" });
  }
});
