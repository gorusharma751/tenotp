// Manual Provider (human-fulfilled OTP) flow for the bot — both sides of
// it: a BUYER posts a request and picks between sellers' bids, a SELLER
// goes online, bids, hands over a number, and types in the OTP. Mirrors
// the website's Manual Provider pages exactly, driven by chat buttons.
//
// Soft-launched like the website's version: every /api/manual-providers
// route is behind requireSoftLaunchAdmin, so a non-admin calling any of
// this just gets a 403 — the menu entry is hidden for them too (see
// telegramBotFlow's isManualUnlocked).
import { getCollection } from "./mongo.ts";
import { sendMessage, type InlineKeyboard, type InlineButton } from "./telegramBot.ts";
import { callSelfApi } from "./telegramSelfApi.ts";

type SessionDoc = { _id: string; step: string; data: Record<string, unknown>; updatedAt: Date };

async function sessionsCol() { return getCollection<SessionDoc>("telegram_bot_sessions"); }
async function getSession(chatId: string): Promise<SessionDoc> {
  const doc = await (await sessionsCol()).findOne({ _id: chatId });
  return doc ?? { _id: chatId, step: "menu", data: {}, updatedAt: new Date() };
}
async function setSession(chatId: string, step: string, data: Record<string, unknown> = {}) {
  await (await sessionsCol()).updateOne({ _id: chatId }, { $set: { step, data, updatedAt: new Date() } }, { upsert: true });
}

const NAV: InlineButton[] = [{ text: "🏠 Menu", callback_data: "m:menu" }];
const kb = (...rows: InlineButton[][]): InlineKeyboard => ({ inline_keyboard: rows });
const money = (n: number | null | undefined) => `₹${Number(n ?? 0).toFixed(2)}`;

// ---------------- Role picker ----------------
export async function showManualHome(chatId: number) {
  await sendMessage(
    chatId,
    "🤝 <b>Manual OTP</b>\n\nReal people fulfil these — a seller shares a number they actually hold and types the OTP back to you.\n\nWhich side are you on?",
    { keyboard: kb([{ text: "🛍 I'm a Buyer", callback_data: "mp:buyer" }], [{ text: "🧑‍💼 I'm a Seller", callback_data: "mp:seller" }], NAV) },
  );
}

// ================= BUYER =================
interface MpRequest {
  id: string; code: string; serviceName: string; country: string; price: number | null; status: string;
  number: string | null; otpCode: string | null; otpMode: "single" | "multi"; quantity: number; numberType: string;
}

export async function showBuyerHome(chatId: number, userId: string, roles: string[]) {
  const reqs = await callSelfApi<MpRequest[]>(userId, roles, "GET", "/api/manual-providers/requests/mine");
  const active = reqs.filter((r) => !["cancelled", "refunded", "completed", "failed"].includes(r.status));
  const lines = active.slice(0, 5).map((r) => `• <b>${r.serviceName}</b> · ${r.country} — ${r.status.replace("_", " ")}`);
  await sendMessage(
    chatId,
    `🛍 <b>Manual OTP — Buyer</b>\n\n${active.length ? `Your active requests:\n${lines.join("\n")}` : "No active requests."}`,
    {
      keyboard: kb(
        [{ text: "➕ Post a request", callback_data: "mp:new" }],
        ...(active.length ? [[{ text: "📋 My requests", callback_data: "mp:myreqs" }]] : []),
        NAV,
      ),
    },
  );
}

export async function startNewRequest(chatId: number, userId: string, roles: string[]) {
  const filters = await callSelfApi<{ countries: string[] }>(userId, roles, "GET", "/api/manual-providers/services/filters");
  if (!filters.countries?.length) {
    await sendMessage(chatId, "😕 No sellers are online for any country right now. Try again later.", { keyboard: kb(NAV) });
    return;
  }
  await setSession(String(chatId), "mp_country", { countries: filters.countries });
  await sendMessage(chatId, "🌍 <b>Step 1 of 3</b> — pick a country:", {
    keyboard: kb(...filters.countries.slice(0, 10).map((c) => [{ text: c, callback_data: `mpc:${c}` }]), NAV),
  });
}

export async function pickCountry(chatId: number, country: string) {
  await setSession(String(chatId), "mp_service", { country });
  await sendMessage(chatId, `✅ <b>${country}</b>\n\n🔍 <b>Step 2 of 3</b> — type the service name you need\n\ne.g. "WhatsApp", "Instagram"`, {
    keyboard: kb([{ text: "🔙 Change country", callback_data: "mp:new" }], NAV),
  });
}

export async function pickService(chatId: number, service: string) {
  const s = await getSession(String(chatId));
  const country = s.data.country as string | undefined;
  if (!country) { await sendMessage(chatId, "Start again — tap Post a request.", { keyboard: kb([{ text: "➕ Post a request", callback_data: "mp:new" }], NAV) }); return; }
  await setSession(String(chatId), "mp_otpmode", { country, service: service.trim() });
  await sendMessage(chatId, `✅ <b>${service.trim()}</b> · ${country}\n\n📨 <b>Step 3 of 3</b> — how many OTPs will you need on this number?`, {
    keyboard: kb([{ text: "1️⃣ Just one", callback_data: "mpo:single" }, { text: "🔁 More than one", callback_data: "mpo:multi" }], NAV),
  });
}

export async function pickOtpMode(chatId: number, mode: "single" | "multi") {
  const s = await getSession(String(chatId));
  await setSession(String(chatId), "mp_numtype", { ...s.data, otpMode: mode });
  await sendMessage(chatId, "📱 Do you need a fresh number, or is a previously-used one fine?", {
    keyboard: kb(
      [{ text: "🆕 New only", callback_data: "mpn:new" }, { text: "♻️ Old is fine", callback_data: "mpn:old" }],
      [{ text: "🤷 Any", callback_data: "mpn:any" }],
      NAV,
    ),
  });
}

export async function pickNumberType(chatId: number, numberType: "new" | "old" | "any") {
  const s = await getSession(String(chatId));
  await setSession(String(chatId), "mp_price", { ...s.data, numberType });
  await sendMessage(chatId, "💵 Name your budget (optional) — sellers see it as a hint and bid against it.\n\nType an amount, or skip:", {
    keyboard: kb([{ text: "⏭ Skip — let sellers quote", callback_data: "mpp:skip" }], NAV),
  });
}

export async function submitRequest(chatId: number, userId: string, roles: string[], budget: number | null) {
  const s = await getSession(String(chatId));
  const { country, service, otpMode, numberType } = s.data as { country?: string; service?: string; otpMode?: string; numberType?: string };
  if (!country || !service) { await startNewRequest(chatId, userId, roles); return; }
  try {
    const r = await callSelfApi<{ requestId: string; code: string }>(userId, roles, "POST", "/api/manual-providers/requests/open", {
      country, service, otpMode: otpMode ?? "single", numberType: numberType ?? "any", quantity: 1,
      ...(budget ? { buyerBidPrice: budget } : {}),
    });
    await setSession(String(chatId), "menu", {});
    await sendMessage(
      chatId,
      `✅ <b>Request posted!</b>\n\n<code>${r.code}</code>\n${service} · ${country}\n\nEvery seller who offers this has been notified. Tap below once bids start coming in.`,
      { keyboard: kb([{ text: "💬 View bids", callback_data: `mpb:${r.requestId}` }], [{ text: "📋 My requests", callback_data: "mp:myreqs" }, ...NAV]) },
    );
  } catch (err) {
    await sendMessage(chatId, `❌ ${err instanceof Error ? err.message : "Could not post"}`, { keyboard: kb([{ text: "🔄 Try again", callback_data: "mp:new" }, ...NAV]) });
  }
}

export async function showMyRequests(chatId: number, userId: string, roles: string[]) {
  const reqs = await callSelfApi<MpRequest[]>(userId, roles, "GET", "/api/manual-providers/requests/mine");
  const active = reqs.filter((r) => !["cancelled", "refunded"].includes(r.status)).slice(0, 6);
  if (!active.length) {
    await sendMessage(chatId, "📋 No requests yet.", { keyboard: kb([{ text: "➕ Post a request", callback_data: "mp:new" }], NAV) });
    return;
  }
  const rows: InlineButton[][] = active.map((r) => {
    // Each status has exactly one thing the buyer would want to do next.
    if (r.status === "open") return [{ text: `💬 Bids — ${r.serviceName}`, callback_data: `mpb:${r.id}` }];
    if (r.status === "otp_sent") return [{ text: `✅ Confirm OTP — ${r.serviceName}`, callback_data: `mpv:${r.id}` }];
    return [{ text: `👁 ${r.serviceName} — ${r.status.replace("_", " ")}`, callback_data: `mpv:${r.id}` }];
  });
  await sendMessage(chatId, "📋 <b>Your requests</b>", { keyboard: kb(...rows, NAV) });
}

interface Bid { id: string; providerName: string; providerUsername: string; providerRating: number | null; providerRatingCount: number; price: number; stock: number | null; successRate: number | null; avgResponseSec: number | null }

export async function showBids(chatId: number, userId: string, roles: string[], requestId: string) {
  const bids = await callSelfApi<Bid[]>(userId, roles, "GET", `/api/manual-providers/requests/${requestId}/bids`);
  if (!bids.length) {
    await sendMessage(chatId, "⏳ No bids yet — sellers are being notified. Check back in a moment.", {
      keyboard: kb([{ text: "🔄 Refresh", callback_data: `mpb:${requestId}` }], [{ text: "❌ Withdraw request", callback_data: `mpx:${requestId}` }, ...NAV]),
    });
    return;
  }
  const lines = bids.map((b, i) => {
    const rating = b.providerRatingCount > 0 ? `⭐${b.providerRating} (${b.providerRatingCount})` : "no reviews yet";
    const stats = [b.successRate !== null ? `${b.successRate}% success` : null, b.avgResponseSec !== null ? `~${Math.round(b.avgResponseSec)}s` : null, b.stock !== null ? `${b.stock} numbers` : null].filter(Boolean).join(" · ");
    return `${i + 1}. <b>${b.providerName}</b> — <b>${money(b.price)}</b>\n   ${rating}${stats ? `\n   ${stats}` : ""}`;
  });
  await sendMessage(chatId, `💬 <b>${bids.length} offer(s)</b>\n\n${lines.join("\n\n")}\n\nTap one to accept &amp; pay:`, {
    keyboard: kb(
      ...bids.map((b, i) => [{ text: `✅ ${i + 1}. ${b.providerName} — ${money(b.price)}`, callback_data: `mpa:${requestId}:${b.id}` }]),
      [{ text: "🔄 Refresh", callback_data: `mpb:${requestId}` }, ...NAV],
    ),
  });
}

export async function acceptBid(chatId: number, userId: string, roles: string[], requestId: string, bidId: string) {
  try {
    const r = await callSelfApi<{ newBalance: number }>(userId, roles, "POST", `/api/manual-providers/requests/${requestId}/accept-bid`, { bidId });
    await sendMessage(chatId, `✅ <b>Paid &amp; assigned!</b>\n\n💰 Balance: ${money(r.newBalance)}\n\nThe seller will send you a number shortly.`, {
      keyboard: kb([{ text: "🔄 Check status", callback_data: `mpv:${requestId}` }, ...NAV]),
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Could not accept";
    await sendMessage(chatId, `❌ ${msg}`, {
      keyboard: /insufficient balance/i.test(msg)
        ? kb([{ text: "💰 Add funds", callback_data: "m:deposit" }], [{ text: "🔙 Back to bids", callback_data: `mpb:${requestId}` }, ...NAV])
        : kb([{ text: "🔙 Back to bids", callback_data: `mpb:${requestId}` }, ...NAV]),
    });
  }
}

export async function viewRequest(chatId: number, userId: string, roles: string[], requestId: string) {
  const r = await callSelfApi<MpRequest>(userId, roles, "GET", `/api/manual-providers/requests/${requestId}`);
  const parts = [`<b>${r.serviceName}</b> · ${r.country}`, `Status: <b>${r.status.replace("_", " ")}</b>`];
  if (r.price !== null) parts.push(`Paid: ${money(r.price)}`);
  if (r.number) parts.push(`\n📱 Number: <code>${r.number}</code>`);
  if (r.otpCode) parts.push(`🔑 OTP: <code>${r.otpCode}</code>`);

  const rows: InlineButton[][] = [];
  if (r.status === "open") rows.push([{ text: "💬 View bids", callback_data: `mpb:${requestId}` }]);
  if (r.status === "otp_sent") {
    // The OTP is in hand but unconfirmed — this is the only point where
    // money actually moves to the seller, so make both answers one tap.
    rows.push([{ text: "✅ OTP is correct", callback_data: `mpok:${requestId}` }]);
    rows.push([{ text: "🔁 Wrong — resend", callback_data: `mprs:${requestId}:wrong` }]);
    if (r.otpMode === "multi") rows.push([{ text: "➕ Need another OTP", callback_data: `mprs:${requestId}:need_another` }]);
  }
  if (["open", "assigned", "in_progress"].includes(r.status)) rows.push([{ text: "❌ Cancel", callback_data: `mpx:${requestId}` }]);
  if (["assigned", "in_progress", "otp_sent"].includes(r.status)) rows.push([{ text: "🔄 Refresh", callback_data: `mpv:${requestId}` }]);
  rows.push(NAV);
  await sendMessage(chatId, parts.join("\n"), { keyboard: kb(...rows) });
}

export async function confirmOtp(chatId: number, userId: string, roles: string[], requestId: string) {
  try {
    await callSelfApi(userId, roles, "POST", `/api/manual-providers/requests/${requestId}/confirm-otp`);
    await sendMessage(chatId, "✅ Confirmed — the seller has been paid. Thanks!", {
      keyboard: kb([{ text: "➕ New request", callback_data: "mp:new" }, ...NAV]),
    });
  } catch (err) {
    await sendMessage(chatId, `❌ ${err instanceof Error ? err.message : "Could not confirm"}`, { keyboard: kb(NAV) });
  }
}

export async function resendOtp(chatId: number, userId: string, roles: string[], requestId: string, reason: string) {
  try {
    await callSelfApi(userId, roles, "POST", `/api/manual-providers/requests/${requestId}/resend-otp`, { reason });
    await sendMessage(chatId, reason === "wrong" ? "🔁 Told the seller it was wrong — they'll send another." : "➕ Asked the seller for another OTP.", {
      keyboard: kb([{ text: "🔄 Check status", callback_data: `mpv:${requestId}` }, ...NAV]),
    });
  } catch (err) {
    await sendMessage(chatId, `❌ ${err instanceof Error ? err.message : "Could not request a resend"}`, { keyboard: kb(NAV) });
  }
}

export async function cancelRequest(chatId: number, userId: string, roles: string[], requestId: string) {
  // "open" requests were never charged, so they're withdrawn via
  // decline-quote; anything already paid goes through cancel (refunds).
  try {
    await callSelfApi(userId, roles, "POST", `/api/manual-providers/requests/${requestId}/cancel`);
    await sendMessage(chatId, "✅ Cancelled and refunded.", { keyboard: kb([{ text: "➕ New request", callback_data: "mp:new" }, ...NAV]) });
  } catch {
    try {
      await callSelfApi(userId, roles, "POST", `/api/manual-providers/requests/${requestId}/decline-quote`);
      await sendMessage(chatId, "✅ Request withdrawn.", { keyboard: kb([{ text: "➕ New request", callback_data: "mp:new" }, ...NAV]) });
    } catch (err) {
      await sendMessage(chatId, `❌ ${err instanceof Error ? err.message : "Could not cancel"}`, { keyboard: kb(NAV) });
    }
  }
}

// ================= SELLER =================
interface SellerMe { online: boolean; companyName: string; pendingBalance: number; availableBalance: number; completedRequests: number }
interface OpenBoardRow { id: string; code: string; serviceName: string; country: string; buyerBudgetNet: number | null; quantity: number; numberType: string; myBidStatus: string | null; canBid: boolean; buyerUsername: string; buyerStats: { completedCount: number; disputeCount: number } }
interface SellerRequest { id: string; code: string; serviceName: string; country: string; price: number | null; status: string; number: string | null; otpCode: string | null; buyerUsername: string }

export async function showSellerHome(chatId: number, userId: string, roles: string[]) {
  try {
    const me = await callSelfApi<SellerMe>(userId, roles, "GET", "/api/manual-providers/seller/me");
    await sendMessage(
      chatId,
      `🧑‍💼 <b>${me.companyName}</b>\n\nStatus: ${me.online ? "🟢 Online" : "🔴 Offline"}\n💰 Pending: ${money(me.pendingBalance)}\n🏦 Available: ${money(me.availableBalance)}\n✅ Completed: ${me.completedRequests}`,
      {
        keyboard: kb(
          [{ text: me.online ? "🔴 Go offline" : "🟢 Go online", callback_data: `mps:toggle:${me.online ? 0 : 1}` }],
          [{ text: "📢 Open Board", callback_data: "mps:board" }, { text: "📋 My jobs", callback_data: "mps:jobs" }],
          [{ text: "💸 Withdraw", callback_data: "mps:withdraw" }],
          NAV,
        ),
      },
    );
  } catch {
    // Not onboarded as a provider — admin has to add them, same as the site.
    await sendMessage(chatId, "🧑‍💼 You're not registered as a seller yet.\n\nSeller accounts are approved by admin — contact support to get onboarded.", { keyboard: kb(NAV) });
  }
}

export async function toggleOnline(chatId: number, userId: string, roles: string[], online: boolean) {
  await callSelfApi(userId, roles, "PATCH", "/api/manual-providers/seller/online", { online });
  await sendMessage(chatId, online ? "🟢 You're online — new requests will reach you." : "🔴 You're offline.", { keyboard: kb([{ text: "🧑‍💼 Seller panel", callback_data: "mp:seller" }, ...NAV]) });
}

export async function showOpenBoard(chatId: number, userId: string, roles: string[]) {
  const rows = await callSelfApi<OpenBoardRow[]>(userId, roles, "GET", "/api/manual-providers/seller/open-requests");
  if (!rows.length) {
    await sendMessage(chatId, "📢 No open requests right now.", { keyboard: kb([{ text: "🔄 Refresh", callback_data: "mps:board" }], [{ text: "🧑‍💼 Seller panel", callback_data: "mp:seller" }, ...NAV]) });
    return;
  }
  const top = rows.slice(0, 6);
  const lines = top.map((r, i) => {
    const buyer = `@${r.buyerUsername} · ${r.buyerStats.completedCount} taken${r.buyerStats.disputeCount ? ` · ⚠️${r.buyerStats.disputeCount} disputes` : ""}`;
    const wants = `${r.quantity}x${r.numberType !== "any" ? ` · ${r.numberType}` : ""}`;
    // Their budget is shown as what the SELLER would net, never the
    // buyer's margin-inclusive total.
    const budget = r.buyerBudgetNet !== null ? `\n   Their budget ≈ ${money(r.buyerBudgetNet)} for you` : "";
    return `${i + 1}. <b>${r.serviceName}</b> · ${r.country} — ${wants}\n   ${buyer}${budget}`;
  });
  await sendMessage(chatId, `📢 <b>Open Board</b>\n\n${lines.join("\n\n")}`, {
    keyboard: kb(
      ...top.map((r, i) => [
        r.myBidStatus
          ? { text: `${i + 1}. ${r.serviceName} — bid ${r.myBidStatus}`, callback_data: "mps:board" }
          : r.canBid
            ? { text: `💰 Bid on ${i + 1}. ${r.serviceName}`, callback_data: `mpbid:${r.id}` }
            : { text: `${i + 1}. ${r.serviceName} — not offered by you`, callback_data: "mps:board" },
      ]),
      [{ text: "🔄 Refresh", callback_data: "mps:board" }, ...NAV],
    ),
  });
}

export async function startBid(chatId: number, requestId: string) {
  await setSession(String(chatId), "mp_bid", { requestId });
  await sendMessage(chatId, "💰 Type your price for this request (what <b>you</b> want to earn):", { keyboard: kb([{ text: "🔙 Back", callback_data: "mps:board" }, ...NAV]) });
}

export async function submitBid(chatId: number, userId: string, roles: string[], price: number) {
  const s = await getSession(String(chatId));
  const requestId = s.data.requestId as string | undefined;
  if (!requestId) { await showOpenBoard(chatId, userId, roles); return; }
  if (!Number.isFinite(price) || price <= 0) {
    await sendMessage(chatId, "❌ Enter a valid amount.", { keyboard: kb([{ text: "🔙 Back", callback_data: "mps:board" }, ...NAV]) });
    return;
  }
  try {
    await callSelfApi(userId, roles, "POST", `/api/manual-providers/seller/requests/${requestId}/bid`, { price });
    await setSession(String(chatId), "menu", {});
    await sendMessage(chatId, `✅ Bid of ${money(price)} submitted — the buyer decides now.`, { keyboard: kb([{ text: "📢 Open Board", callback_data: "mps:board" }, ...NAV]) });
  } catch (err) {
    await sendMessage(chatId, `❌ ${err instanceof Error ? err.message : "Could not bid"}`, { keyboard: kb([{ text: "📢 Open Board", callback_data: "mps:board" }, ...NAV]) });
  }
}

export async function showSellerJobs(chatId: number, userId: string, roles: string[]) {
  const rows = await callSelfApi<SellerRequest[]>(userId, roles, "GET", "/api/manual-providers/seller/requests?status=active");
  if (!rows.length) {
    await sendMessage(chatId, "📋 No active jobs.", { keyboard: kb([{ text: "📢 Open Board", callback_data: "mps:board" }, ...NAV]) });
    return;
  }
  const buttons: InlineButton[][] = rows.slice(0, 6).map((r) => {
    if (r.status === "assigned") return [{ text: `📱 Send number — ${r.serviceName}`, callback_data: `mpnum:${r.id}` }];
    if (r.status === "in_progress") return [{ text: `🔑 Send OTP — ${r.serviceName}`, callback_data: `mpotp:${r.id}` }];
    return [{ text: `${r.serviceName} — ${r.status.replace("_", " ")}`, callback_data: "mps:jobs" }];
  });
  const lines = rows.slice(0, 6).map((r) => `• <b>${r.serviceName}</b> · ${r.country} — ${r.status.replace("_", " ")} — you get ${money(r.price)}`);
  await sendMessage(chatId, `📋 <b>Your active jobs</b>\n\n${lines.join("\n")}`, { keyboard: kb(...buttons, [{ text: "🔄 Refresh", callback_data: "mps:jobs" }, ...NAV]) });
}

export async function promptNumber(chatId: number, requestId: string) {
  await setSession(String(chatId), "mp_number", { requestId });
  await sendMessage(chatId, "📱 Type the phone number to give the buyer (the one you'll read the OTP from):", { keyboard: kb([{ text: "🔙 Back", callback_data: "mps:jobs" }, ...NAV]) });
}

export async function sendNumber(chatId: number, userId: string, roles: string[], number: string) {
  const s = await getSession(String(chatId));
  const requestId = s.data.requestId as string | undefined;
  if (!requestId) { await showSellerJobs(chatId, userId, roles); return; }
  try {
    await callSelfApi(userId, roles, "POST", `/api/manual-providers/seller/requests/${requestId}/start`, { number: number.trim() });
    await setSession(String(chatId), "menu", {});
    await sendMessage(chatId, "✅ Number sent to the buyer. Once the OTP arrives on your phone, send it here.", {
      keyboard: kb([{ text: "🔑 Send OTP now", callback_data: `mpotp:${requestId}` }], [{ text: "📋 My jobs", callback_data: "mps:jobs" }, ...NAV]),
    });
  } catch (err) {
    await sendMessage(chatId, `❌ ${err instanceof Error ? err.message : "Could not send"}`, { keyboard: kb([{ text: "📋 My jobs", callback_data: "mps:jobs" }, ...NAV]) });
  }
}

export async function promptOtp(chatId: number, requestId: string) {
  await setSession(String(chatId), "mp_otp", { requestId });
  await sendMessage(chatId, "🔑 Type the OTP you received on that number:", { keyboard: kb([{ text: "🔙 Back", callback_data: "mps:jobs" }, ...NAV]) });
}

export async function sendOtp(chatId: number, userId: string, roles: string[], otp: string) {
  const s = await getSession(String(chatId));
  const requestId = s.data.requestId as string | undefined;
  if (!requestId) { await showSellerJobs(chatId, userId, roles); return; }
  try {
    await callSelfApi(userId, roles, "POST", `/api/manual-providers/seller/requests/${requestId}/complete`, { otpCode: otp.trim() });
    await setSession(String(chatId), "menu", {});
    await sendMessage(chatId, "✅ OTP sent. You'll be paid as soon as the buyer confirms it (or automatically if they don't respond in time).", {
      keyboard: kb([{ text: "📋 My jobs", callback_data: "mps:jobs" }, { text: "🧑‍💼 Panel", callback_data: "mp:seller" }], NAV),
    });
  } catch (err) {
    await sendMessage(chatId, `❌ ${err instanceof Error ? err.message : "Could not send OTP"}`, { keyboard: kb([{ text: "📋 My jobs", callback_data: "mps:jobs" }, ...NAV]) });
  }
}

export async function sellerWithdraw(chatId: number, userId: string, roles: string[]) {
  try {
    await callSelfApi(userId, roles, "POST", "/api/manual-providers/seller/withdraw", {});
    await sendMessage(chatId, "✅ Withdrawal requested — admin will process the payout to your saved details.", { keyboard: kb([{ text: "🧑‍💼 Panel", callback_data: "mp:seller" }, ...NAV]) });
  } catch (err) {
    await sendMessage(chatId, `❌ ${err instanceof Error ? err.message : "Could not request withdrawal"}`, { keyboard: kb([{ text: "🧑‍💼 Panel", callback_data: "mp:seller" }, ...NAV]) });
  }
}

/** Text typed while a Manual Provider step is active. Returns true if it
 * was consumed here, so the caller knows not to fall through. */
export async function handleManualText(chatId: number, userId: string, roles: string[], step: string, text: string): Promise<boolean> {
  if (step === "mp_service") { await pickService(chatId, text); return true; }
  if (step === "mp_price") { await submitRequest(chatId, userId, roles, Number(text.trim().replace(/[₹,\s]/g, "")) || null); return true; }
  if (step === "mp_bid") { await submitBid(chatId, userId, roles, Number(text.trim().replace(/[₹,\s]/g, ""))); return true; }
  if (step === "mp_number") { await sendNumber(chatId, userId, roles, text); return true; }
  if (step === "mp_otp") { await sendOtp(chatId, userId, roles, text); return true; }
  return false;
}

/** Button taps under the "mp*" namespace. Returns true if handled. */
export async function handleManualCallback(chatId: number, userId: string, roles: string[], data: string): Promise<boolean> {
  if (data === "m:manual") { await showManualHome(chatId); return true; }
  if (data === "mp:buyer") { await showBuyerHome(chatId, userId, roles); return true; }
  if (data === "mp:seller") { await showSellerHome(chatId, userId, roles); return true; }
  if (data === "mp:new") { await startNewRequest(chatId, userId, roles); return true; }
  if (data === "mp:myreqs") { await showMyRequests(chatId, userId, roles); return true; }
  if (data.startsWith("mpc:")) { await pickCountry(chatId, data.slice(4)); return true; }
  if (data.startsWith("mpo:")) { await pickOtpMode(chatId, data.slice(4) === "multi" ? "multi" : "single"); return true; }
  if (data.startsWith("mpn:")) { await pickNumberType(chatId, data.slice(4) as "new" | "old" | "any"); return true; }
  if (data === "mpp:skip") { await submitRequest(chatId, userId, roles, null); return true; }
  if (data.startsWith("mpb:")) { await showBids(chatId, userId, roles, data.slice(4)); return true; }
  if (data.startsWith("mpa:")) { const [, reqId, bidId] = data.split(":"); await acceptBid(chatId, userId, roles, reqId, bidId); return true; }
  if (data.startsWith("mpv:")) { await viewRequest(chatId, userId, roles, data.slice(4)); return true; }
  if (data.startsWith("mpok:")) { await confirmOtp(chatId, userId, roles, data.slice(5)); return true; }
  if (data.startsWith("mprs:")) { const [, reqId, reason] = data.split(":"); await resendOtp(chatId, userId, roles, reqId, reason); return true; }
  if (data.startsWith("mpx:")) { await cancelRequest(chatId, userId, roles, data.slice(4)); return true; }
  if (data.startsWith("mps:toggle:")) { await toggleOnline(chatId, userId, roles, data.endsWith(":1")); return true; }
  if (data === "mps:board") { await showOpenBoard(chatId, userId, roles); return true; }
  if (data === "mps:jobs") { await showSellerJobs(chatId, userId, roles); return true; }
  if (data === "mps:withdraw") { await sellerWithdraw(chatId, userId, roles); return true; }
  if (data.startsWith("mpbid:")) { await startBid(chatId, data.slice(6)); return true; }
  if (data.startsWith("mpnum:")) { await promptNumber(chatId, data.slice(6)); return true; }
  if (data.startsWith("mpotp:")) { await promptOtp(chatId, data.slice(6)); return true; }
  return false;
}
