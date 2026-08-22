// USDT deposits — the user sends USDT to our address and submits the
// transaction hash, which we verify ON-CHAIN before crediting anything.
// Deliberately mirrors the existing UPI/BharatPe deposit flow (session →
// pay → submit reference → verify → credit) so there's one mental model,
// and it reuses the same deposits/approveDeposit money path rather than a
// second way of moving money.
//
// SECURITY — every one of these checks exists because skipping it is a
// real, known way to get robbed:
//   * contract address is pinned to the REAL USDT contract. Anyone can
//     deploy a token that calls itself "USDT"; without this check a
//     worthless fake token would credit real balance.
//   * destination must be OUR configured address, so a hash copied from
//     someone else's unrelated transfer doesn't pay the sender.
//   * the hash is claimed atomically and unique-indexed, so the same
//     transfer can't be submitted twice (by the same user or two).
//   * amount and confirmations come from the chain, never from the user.
//   * credited amount is derived from the ON-CHAIN USDT amount, not from
//     what the user said they'd send.
import crypto from "node:crypto";
import { getCollection } from "./mongo.ts";
import { approveDeposit } from "./db/wallet.ts";

export type CryptoNetwork = "trc20" | "bep20";

export type CryptoConfig = {
  enabled: boolean;
  /** Our receiving addresses, per network. Empty = that network is off. */
  address_trc20: string;
  address_bep20: string;
  /** INR per 1 USDT. Admin-set — deliberately not auto-fetched from a
   * price feed, so a feed glitch or manipulation can't move the rate. */
  usdt_inr_rate: number;
  min_usdt: number;
  /** How many block confirmations before we treat a transfer as final. */
  confirmations_required: number;
  /** Optional — only needed for BEP20 verification (BscScan free key). */
  bscscan_api_key: string;
};

const DEFAULT_CONFIG: CryptoConfig = {
  enabled: false,
  address_trc20: "",
  address_bep20: "",
  usdt_inr_rate: 0,
  min_usdt: 1,
  confirmations_required: 1,
  bscscan_api_key: "",
};

/** The genuine USDT contracts. Pinned as constants, never configurable —
 * a settable "which contract counts as USDT" field would just be the fake
 * token hole with extra steps. */
const USDT_CONTRACT: Record<CryptoNetwork, string> = {
  trc20: "TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t",
  bep20: "0x55d398326f99059ff775485246999027b3197955",
};

export type CryptoSessionDoc = {
  _id: string;
  userId: string;
  network: CryptoNetwork;
  address: string;
  /** What we asked them to send, and what it's worth — both frozen at
   * creation so a later rate change can't alter an in-flight deposit. */
  expectedUsdt: number;
  rate: number;
  inrAmount: number;
  status: "pending" | "submitted" | "crediting" | "paid" | "rejected" | "expired";
  txHash: string | null;
  creditedUsdt: number | null;
  creditedInr: number | null;
  depositId: string | null;
  note: string | null;
  expiresAt: Date;
  createdAt: Date;
  creditedAt: Date | null;
};

async function secretsCol() {
  return getCollection<{ _id: string; value: CryptoConfig; updatedAt: Date }>("admin_secrets");
}
export async function loadCryptoConfig(): Promise<CryptoConfig> {
  const row = await (await secretsCol()).findOne({ _id: "crypto_deposit" });
  return { ...DEFAULT_CONFIG, ...(row?.value ?? {}) };
}
export async function patchCryptoConfig(patch: Partial<CryptoConfig>): Promise<CryptoConfig> {
  const value = { ...(await loadCryptoConfig()), ...patch };
  await (await secretsCol()).updateOne({ _id: "crypto_deposit" }, { $set: { value, updatedAt: new Date() } }, { upsert: true });
  return value;
}
export function addressFor(cfg: CryptoConfig, network: CryptoNetwork): string {
  return (network === "trc20" ? cfg.address_trc20 : cfg.address_bep20).trim();
}
export function isCryptoReady(cfg: CryptoConfig): boolean {
  return cfg.enabled && cfg.usdt_inr_rate > 0 && Boolean(cfg.address_trc20 || cfg.address_bep20);
}

export async function cryptoSessionsCol() {
  return getCollection<CryptoSessionDoc>("crypto_sessions");
}

export async function createCryptoSession(userId: string, inrAmount: number, network: CryptoNetwork): Promise<CryptoSessionDoc> {
  const cfg = await loadCryptoConfig();
  if (!isCryptoReady(cfg)) throw new Error("Crypto deposits aren't enabled yet");
  const address = addressFor(cfg, network);
  if (!address) throw new Error("That network isn't available right now");
  if (!Number.isFinite(inrAmount) || inrAmount < 10) throw new Error("Enter a valid amount");

  const expectedUsdt = Number((inrAmount / cfg.usdt_inr_rate).toFixed(2));
  if (expectedUsdt < cfg.min_usdt) throw new Error(`Minimum deposit is ${cfg.min_usdt} USDT (₹${Math.ceil(cfg.min_usdt * cfg.usdt_inr_rate)})`);

  const doc: CryptoSessionDoc = {
    _id: crypto.randomUUID(), userId, network, address,
    expectedUsdt, rate: cfg.usdt_inr_rate, inrAmount: Number(inrAmount.toFixed(2)),
    status: "pending", txHash: null, creditedUsdt: null, creditedInr: null, depositId: null, note: null,
    expiresAt: new Date(Date.now() + 60 * 60 * 1000), createdAt: new Date(), creditedAt: null,
  };
  await (await cryptoSessionsCol()).insertOne(doc);
  return doc;
}

type OnChainTransfer = { toAddress: string; contract: string; usdt: number; confirmations: number };

/** Reads one transfer straight off the chain. Returns null when the hash
 * isn't found or isn't a token transfer we can read — never throws for a
 * "not found", since a user pasting a hash a few seconds early is normal. */
async function readTransfer(network: CryptoNetwork, txHash: string, cfg: CryptoConfig): Promise<OnChainTransfer | null> {
  if (network === "trc20") {
    const res = await fetch(`https://apilist.tronscanapi.com/api/transaction-info?hash=${encodeURIComponent(txHash)}`, {
      signal: AbortSignal.timeout(15000),
    });
    if (!res.ok) return null;
    const body = (await res.json()) as {
      confirmed?: boolean; confirmations?: number;
      trc20TransferInfo?: Array<{ to_address?: string; contract_address?: string; amount_str?: string; decimals?: number }>;
    };
    const t = body.trc20TransferInfo?.[0];
    if (!t?.to_address || !t.contract_address || !t.amount_str) return null;
    const decimals = t.decimals ?? 6;
    return {
      toAddress: t.to_address,
      contract: t.contract_address,
      usdt: Number(t.amount_str) / 10 ** decimals,
      confirmations: body.confirmed ? Math.max(1, Number(body.confirmations ?? 1)) : 0,
    };
  }

  // BEP20 — BscScan's token-transfer log for the hash's receipt.
  if (!cfg.bscscan_api_key) throw new Error("BEP20 verification isn't configured — use TRC20 or contact support");
  const url = `https://api.bscscan.com/api?module=proxy&action=eth_getTransactionReceipt&txhash=${encodeURIComponent(txHash)}&apikey=${cfg.bscscan_api_key}`;
  const res = await fetch(url, { signal: AbortSignal.timeout(15000) });
  if (!res.ok) return null;
  const body = (await res.json()) as { result?: { status?: string; logs?: Array<{ address?: string; topics?: string[]; data?: string }> } };
  const receipt = body.result;
  if (!receipt || receipt.status !== "0x1") return null;
  // ERC20 Transfer(address,address,uint256)
  const TRANSFER_TOPIC = "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef";
  const log = (receipt.logs ?? []).find((l) => (l.topics?.[0] ?? "").toLowerCase() === TRANSFER_TOPIC);
  if (!log?.address || !log.topics?.[2] || !log.data) return null;
  return {
    toAddress: `0x${log.topics[2].slice(-40)}`,
    contract: log.address,
    usdt: Number(BigInt(log.data)) / 1e18, // USDT on BSC uses 18 decimals
    confirmations: 1, // a mined receipt with status 0x1 is at least 1 confirmation
  };
}

/** Verifies a submitted hash and, if everything checks out, credits the
 * wallet. Every failure path leaves the session reusable rather than
 * burning it, so a user who pasted too early can just retry. */
export async function verifyAndCreditCrypto(sessionId: string, userId: string, txHashRaw: string): Promise<{ credited: boolean; message: string; balance: number | null }> {
  const txHash = txHashRaw.trim();
  if (txHash.length < 20) throw new Error("Enter the full transaction hash");

  const sessions = await cryptoSessionsCol();
  const s = await sessions.findOne({ _id: sessionId });
  if (!s) throw new Error("Deposit session not found");
  if (s.userId !== userId) throw new Error("Forbidden");
  if (s.status === "paid") return { credited: true, message: "Already credited", balance: null };

  // Reject a hash already used anywhere — the unique index below is the
  // real guarantee, this is the friendly error.
  const dupe = await sessions.findOne({ txHash, status: "paid" });
  if (dupe) throw new Error("This transaction has already been credited");

  const cfg = await loadCryptoConfig();
  const transfer = await readTransfer(s.network, txHash, cfg);
  if (!transfer) {
    return { credited: false, message: "Transaction not found on-chain yet. Wait a minute after sending, then try again.", balance: null };
  }

  const norm = (a: string) => a.trim().toLowerCase();
  if (norm(transfer.contract) !== norm(USDT_CONTRACT[s.network])) {
    throw new Error("That transfer isn't real USDT on this network. Nothing has been credited.");
  }
  if (norm(transfer.toAddress) !== norm(s.address)) {
    throw new Error("That transfer went to a different address, not ours. Nothing has been credited.");
  }
  if (transfer.confirmations < cfg.confirmations_required) {
    return { credited: false, message: `Waiting for ${cfg.confirmations_required} confirmation(s) — try again shortly.`, balance: null };
  }
  // Short by more than a cent is a genuine underpay; a tiny rounding
  // difference shouldn't block a legitimate deposit.
  if (transfer.usdt + 0.01 < s.expectedUsdt) {
    throw new Error(`Received ${transfer.usdt.toFixed(2)} USDT but ${s.expectedUsdt.toFixed(2)} was expected. Contact support.`);
  }

  // Credit what actually arrived, at the rate frozen when the session was
  // made — never what the user claimed they'd send.
  const creditedUsdt = transfer.usdt;
  const creditedInr = Number((creditedUsdt * s.rate).toFixed(2));

  const claimed = await sessions.findOneAndUpdate(
    { _id: sessionId, status: { $nin: ["paid", "crediting"] } },
    { $set: { status: "crediting", txHash } },
    { returnDocument: "after" },
  );
  if (!claimed) return { credited: true, message: "Already being credited", balance: null };

  try {
    const deposits = await getCollection<{ _id: string; userId: string; amount: number; method: string; currency: string; network: string | null; utr: string | null; screenshotUrl: string | null; status: string; adminNote: string | null; approvedBy: string | null; approvedAt: Date | null; createdAt: Date }>("deposits");
    const depositId = crypto.randomUUID();
    await deposits.insertOne({
      _id: depositId, userId: s.userId, amount: creditedInr, method: "USDT", currency: "USDT",
      network: s.network.toUpperCase(), utr: txHash, screenshotUrl: null, status: "pending",
      adminNote: `${creditedUsdt} USDT @ ₹${s.rate}`, approvedBy: null, approvedAt: null, createdAt: new Date(),
    });
    const balance = await approveDeposit(depositId);
    await sessions.updateOne(
      { _id: sessionId },
      { $set: { status: "paid", txHash, creditedUsdt, creditedInr, depositId, creditedAt: new Date(), note: `Verified on-chain (${s.network})` } },
    );
    return { credited: true, message: `Credited ₹${creditedInr.toFixed(2)} (${creditedUsdt} USDT)`, balance };
  } catch (err) {
    // Roll the claim back so a transient failure can be retried rather
    // than leaving the session stuck mid-credit.
    await sessions.updateOne({ _id: sessionId }, { $set: { status: "submitted" } });
    throw err;
  }
}
