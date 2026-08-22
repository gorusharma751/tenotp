// Full bot conversation engine — main menu buttons, buy-number flow
// (country search -> service search -> confirm -> buy), deposit (QR ->
// UTR), balance, orders, and referral info. Every money/provider-touching
// action calls this SAME backend's own REST API (see telegramSelfApi.ts)
// instead of re-implementing pricing/purchase/payment logic a second time
// — same account, same wallet, same rules as the website.
import { getCollection } from "./mongo.ts";
import { sendMessage, sendPhotoOrLink, answerCallbackQuery, mainReplyKeyboard, type InlineKeyboard, type InlineButton } from "./telegramBot.ts";
import { callSelfApi } from "./telegramSelfApi.ts";
import { findOrCreateTelegramUser, type TelegramProfile } from "./auth/telegramAccount.ts";
import type { UserDoc } from "./types.ts";

type SessionDoc = { _id: string; step: string; data: Record<string, unknown>; updatedAt: Date };

async function sessionsCol() {
  return getCollection<SessionDoc>("telegram_bot_sessions");
}
async function getSession(chatId: string): Promise<SessionDoc> {
  const col = await sessionsCol();
  const doc = await col.findOne({ _id: chatId });
  return doc ?? { _id: chatId, step: "menu", data: {}, updatedAt: new Date() };
}
async function setSession(chatId: string, step: string, data: Record<string, unknown> = {}) {
  const col = await sessionsCol();
  await col.updateOne({ _id: chatId }, { $set: { step, data, updatedAt: new Date() } }, { upsert: true });
}
async function clearSession(chatId: string) {
  await setSession(chatId, "menu", {});
}

// ---- Main menu ----
// Persistent buttons under the message box (see mainReplyKeyboard) rather
// than inline ones attached to a single message — they stay put for the
// whole chat instead of scrolling away. Tapping one just sends its label
// as text, which BUTTON_COMMANDS maps back to the matching command.
const BUTTON_COMMANDS: Record<string, string> = {
  "🛒 buy number": "/buy",
  "🔍 search service": "/search",
  "💰 deposit": "/deposit",
  "💼 balance": "/balance",
  "📦 my orders": "/orders",
  "🎁 refer & earn": "/refer",
  "❓ help": "/help",
};

async function sendMenu(chatId: number, greeting?: string) {
  await sendMessage(chatId, greeting ?? "What would you like to do?", { replyKeyboard: mainReplyKeyboard() });
}

// ---- Buy flow: country search -> service search -> confirm -> buy ----
interface CountryRow { code: string; name: string; flag: string; numbersAvailable: number; priceFrom: number }
interface ServiceRow {
  id: string; externalId: string; name: string; icon: string; category: string; price: number; stock: number;
  providerId: string; providerName: string; serverLabel: string; countryCode: string; avgSpeedSec: number | null; supportsMulti: boolean;
}

async function startBuyFlow(chatId: number) {
  await setSession(String(chatId), "buy_country", {});
  await sendMessage(chatId, '🌍 Type a country name to search (e.g. "India", "USA")...');
}

async function handleCountrySearch(chatId: number, userId: string, roles: string[], text: string) {
  const countries = await callSelfApi<CountryRow[]>(userId, roles, "GET", "/api/catalog/countries");
  const q = text.trim().toLowerCase();
  const matches = countries.filter((c) => c.name.toLowerCase().includes(q)).slice(0, 8);
  if (matches.length === 0) {
    await sendMessage(chatId, "No countries matched that — try again, or /menu to go back.");
    return;
  }
  await setSession(String(chatId), "buy_country_pick", { countries: matches });
  const rows: InlineButton[][] = matches.map((c) => [{ text: `${c.flag} ${c.name} — from ₹${c.priceFrom}`, callback_data: `cty:${c.code}` }]);
  await sendMessage(chatId, "Pick a country:", { keyboard: { inline_keyboard: rows } });
}

async function handleCountryPick(chatId: number, code: string) {
  const session = await getSession(String(chatId));
  const countries = (session.data.countries as CountryRow[] | undefined) ?? [];
  const country = countries.find((c) => c.code === code);
  if (!country) {
    await sendMessage(chatId, "That country expired — try /buy again.");
    await setSession(String(chatId), "buy_country", {});
    return;
  }
  await setSession(String(chatId), "buy_service", { country });
  await sendMessage(chatId, `📍 ${country.flag} ${country.name} selected.\n\nNow type a service name to search (e.g. "WhatsApp", "Telegram")...`);
}

async function handleServiceSearch(chatId: number, userId: string, roles: string[], text: string) {
  const session = await getSession(String(chatId));
  const country = session.data.country as CountryRow | undefined;
  if (!country) {
    await sendMessage(chatId, "Pick a country first — type /buy to start over.");
    return;
  }
  const rows = await callSelfApi<ServiceRow[]>(userId, roles, "POST", "/api/otp/services", { countryName: country.name, q: text.trim() });
  if (rows.length === 0) {
    await sendMessage(chatId, `No matching services found for "${text}" in ${country.name}. Try another name, or /menu to go back.`);
    return;
  }
  const top = rows.slice(0, 8);
  await setSession(String(chatId), "buy_service_pick", { country, services: top });
  const keyboard: InlineKeyboard = {
    inline_keyboard: top.map((s, i) => [{ text: `${s.name} — ₹${s.price} (${s.stock} left, ${s.serverLabel})`, callback_data: `svc:${i}` }]),
  };
  await sendMessage(chatId, `Found ${rows.length} option(s) for "${text}" in ${country.name}:`, { keyboard });
}

async function handleServicePick(chatId: number, idx: number) {
  const session = await getSession(String(chatId));
  const country = session.data.country as CountryRow | undefined;
  const services = (session.data.services as ServiceRow[] | undefined) ?? [];
  const service = services[idx];
  if (!country || !service) {
    await sendMessage(chatId, "That option expired — try again with /buy.");
    return;
  }
  await setSession(String(chatId), "buy_confirm", { country, service });
  const keyboard: InlineKeyboard = {
    inline_keyboard: [[{ text: "✅ Confirm & buy", callback_data: "buy_confirm" }, { text: "❌ Cancel", callback_data: "buy_cancel" }]],
  };
  await sendMessage(
    chatId,
    `<b>${service.name}</b> in ${country.name}\nServer: ${service.serverLabel}\nPrice: ₹${service.price}\nStock: ${service.stock}\n\nConfirm purchase?`,
    { keyboard },
  );
}

async function handleBuyConfirm(chatId: number, userId: string, roles: string[]) {
  const session = await getSession(String(chatId));
  const country = session.data.country as CountryRow | undefined;
  const service = session.data.service as ServiceRow | undefined;
  if (!country || !service) {
    await sendMessage(chatId, "That order expired — start again with /buy.");
    return;
  }
  await clearSession(String(chatId));
  try {
    const order = await callSelfApi<{ id: string; number: string; service: string; country: string; price: number }>(
      userId, roles, "POST", "/api/otp/buy",
      { countryCode: service.countryCode, providerId: service.providerId, serviceId: service.externalId },
    );
    await sendMessage(
      chatId,
      `✅ <b>Order placed!</b>\n\n${order.service} · ${order.country}\nNumber: <code>${order.number}</code>\nPrice: ₹${order.price}\n\nUse the number to request the OTP, then check /orders in a bit — I'll show it once it arrives.`,
      { withAppButton: true, appButtonText: "View in app", appPath: "/dashboard/otp-inbox" },
    );
  } catch (err) {
    await sendMessage(chatId, `❌ Could not complete the purchase: ${err instanceof Error ? err.message : "unknown error"}`);
  }
}

// ---- Deposit flow ----
async function startDepositFlow(chatId: number) {
  await setSession(String(chatId), "deposit_amount", {});
  await sendMessage(chatId, "💰 How much would you like to deposit? (₹10 – ₹200000)\n\nJust type the amount.");
}

async function handleDepositAmount(chatId: number, userId: string, roles: string[], text: string) {
  const amount = Number(text.trim());
  if (!Number.isFinite(amount) || amount < 10 || amount > 200000) {
    await sendMessage(chatId, "Enter a valid amount between ₹10 and ₹200000.");
    return;
  }
  try {
    const qr = await callSelfApi<{ sessionId: string; orderId: string; amount: number; qrData: string; qrImage: string; upiId: string }>(
      userId, roles, "POST", "/api/payments/paytm/create-qr", { amount },
    );
    await setSession(String(chatId), "deposit_utr", { sessionId: qr.sessionId, amount: qr.amount });
    const caption = `💰 Pay <b>₹${qr.amount}</b>${qr.upiId ? ` to <code>${qr.upiId}</code>` : ""}\n\nScan the QR with any UPI app, or use the link below. Once paid, reply here with the UTR / reference number.\n\n${qr.qrData}`;
    if (qr.qrImage) await sendPhotoOrLink(chatId, qr.qrImage, caption);
    else await sendMessage(chatId, caption);
  } catch (err) {
    await sendMessage(chatId, `Could not start a deposit: ${err instanceof Error ? err.message : "unknown error"}`);
    await clearSession(String(chatId));
  }
}

async function handleUtrSubmit(chatId: number, userId: string, roles: string[], text: string) {
  const session = await getSession(String(chatId));
  const sessionId = session.data.sessionId as string | undefined;
  if (!sessionId) {
    await sendMessage(chatId, "Start a deposit first with /deposit.");
    return;
  }
  const utr = text.trim();
  if (utr.length < 6) {
    await sendMessage(chatId, "That doesn't look like a valid UTR — enter the full reference number.");
    return;
  }
  await clearSession(String(chatId));
  try {
    const result = await callSelfApi<{ credited: boolean; pending: boolean; balance: number }>(
      userId, roles, "POST", "/api/payments/paytm/submit-utr", { sessionId, utr },
    );
    if (result.credited) await sendMessage(chatId, `✅ Deposit confirmed! New balance: ₹${result.balance.toFixed(2)}`);
    else await sendMessage(chatId, "⏳ Submitted — awaiting admin verification. You'll be notified once it's confirmed.");
  } catch (err) {
    await sendMessage(chatId, `Could not verify: ${err instanceof Error ? err.message : "unknown error"}`);
  }
}

// ---- Simple info commands ----
async function showBalance(chatId: number, userId: string, roles: string[]) {
  const wallet = await callSelfApi<{ balance: number }>(userId, roles, "GET", "/api/wallet/balance");
  await sendMessage(chatId, `💰 Wallet balance: <b>₹${Number(wallet.balance).toFixed(2)}</b>`, { withAppButton: true, appButtonText: "Add funds", appPath: "/dashboard/deposit" });
}

interface OrderRow { id: string; service: string; country: string; number: string; status: string; otp?: string; price: number }
async function showOrders(chatId: number, userId: string, roles: string[]) {
  const orders = await callSelfApi<OrderRow[]>(userId, roles, "GET", "/api/otp/my-orders");
  if (orders.length === 0) {
    await sendMessage(chatId, "No orders yet.", { withAppButton: true, appButtonText: "Buy a number", appPath: "/dashboard/buy-number" });
    return;
  }
  const lines = orders.slice(0, 5).map((o) => `• ${o.service} (${o.country}) — <b>${o.status}</b>${o.otp ? ` — OTP: <code>${o.otp}</code>` : ""}`);
  await sendMessage(chatId, `📦 <b>Your recent orders</b>\n\n${lines.join("\n")}`, { withAppButton: true, appButtonText: "View all", appPath: "/dashboard/orders" });
}

interface ReferralRow { referrerId: string; referrerEmail?: string; refereeEmail: string; earned: number; status: string }
async function showReferrals(chatId: number, userId: string, roles: string[], user: UserDoc) {
  const rows = await callSelfApi<ReferralRow[]>(userId, roles, "GET", "/api/referrals/");
  const totalEarned = rows.reduce((sum, r) => sum + Number(r.earned || 0), 0);
  const base = process.env.FRONTEND_URL || "https://tenotp.vercel.app";
  const link = `${base}/signup?ref=${user.referralCode}`;
  await sendMessage(
    chatId,
    `🎁 <b>Refer & Earn</b>\n\nYour code: <code>${user.referralCode}</code>\nYour link: ${link}\n\nEvery time someone you referred completes a purchase, you earn <b>10%</b> commission — credited straight to your wallet.\n\n👥 Referred so far: ${rows.length}\n💰 Total earned: ₹${totalEarned.toFixed(2)}`,
  );
}

const HELP_TEXT = [
  "<b>TenOTP bot</b>",
  "",
  "/start, /menu — main menu",
  "/buy — buy a virtual number",
  "/search — search for a service",
  "/deposit — add funds",
  "/balance — wallet balance",
  "/orders — recent orders",
  "/refer — your referral code & earnings",
  "/help — this message",
].join("\n");

// ---- Entry points from routes/telegramWebhook.ts ----

export async function handleTextMessage(chatId: number, from: TelegramProfile, text: string) {
  const user = await findOrCreateTelegramUser(from);
  const roles = user.roles;
  // A tap on one of the persistent buttons arrives as its plain label —
  // translate it to the equivalent command before parsing.
  const asButton = BUTTON_COMMANDS[text.trim().toLowerCase()];
  if (asButton) text = asButton;
  const cmd = text.trim().split(/\s+/)[0].toLowerCase().split("@")[0];

  if (cmd === "/start" || cmd === "/menu") {
    await clearSession(String(chatId));
    await sendMenu(chatId, `👋 Welcome to <b>TenOTP</b>, ${from.first_name ?? "there"}!\n\nBuy virtual numbers, get OTPs instantly, deposit funds, and earn referral commissions — all from here.`);
    return;
  }
  if (cmd === "/buy" || cmd === "/search") { await startBuyFlow(chatId); return; }
  if (cmd === "/deposit") { await startDepositFlow(chatId); return; }
  if (cmd === "/balance") { await showBalance(chatId, user._id, roles); return; }
  if (cmd === "/orders") { await showOrders(chatId, user._id, roles); return; }
  if (cmd === "/refer") { await showReferrals(chatId, user._id, roles, user); return; }
  if (cmd === "/help") { await sendMessage(chatId, HELP_TEXT, { withAppButton: true }); return; }
  if (cmd === "/cancel") { await clearSession(String(chatId)); await sendMenu(chatId, "Cancelled."); return; }

  // Not a command — route by whatever step this chat is currently in.
  const session = await getSession(String(chatId));
  try {
    if (session.step === "buy_country") { await handleCountrySearch(chatId, user._id, roles, text); return; }
    if (session.step === "buy_service") { await handleServiceSearch(chatId, user._id, roles, text); return; }
    if (session.step === "deposit_amount") { await handleDepositAmount(chatId, user._id, roles, text); return; }
    if (session.step === "deposit_utr") { await handleUtrSubmit(chatId, user._id, roles, text); return; }
  } catch (err) {
    await sendMessage(chatId, `Something went wrong: ${err instanceof Error ? err.message : "unknown error"}`);
    return;
  }

  await sendMessage(chatId, "Not sure what you mean — try /menu, or /help for commands.", { withAppButton: true });
}

export async function handleCallback(chatId: number, callbackQueryId: string, from: TelegramProfile, data: string) {
  const user = await findOrCreateTelegramUser(from);
  const roles = user.roles;
  await answerCallbackQuery(callbackQueryId);

  try {
    if (data === "m:buy" || data === "m:search") { await startBuyFlow(chatId); return; }
    if (data === "m:deposit") { await startDepositFlow(chatId); return; }
    if (data === "m:balance") { await showBalance(chatId, user._id, roles); return; }
    if (data === "m:orders") { await showOrders(chatId, user._id, roles); return; }
    if (data === "m:refer") { await showReferrals(chatId, user._id, roles, user); return; }
    if (data === "m:help") { await sendMessage(chatId, HELP_TEXT, { withAppButton: true }); return; }
    if (data.startsWith("cty:")) { await handleCountryPick(chatId, data.slice(4)); return; }
    if (data.startsWith("svc:")) { await handleServicePick(chatId, Number(data.slice(4))); return; }
    if (data === "buy_confirm") { await handleBuyConfirm(chatId, user._id, roles); return; }
    if (data === "buy_cancel") { await clearSession(String(chatId)); await sendMenu(chatId, "Cancelled."); return; }
  } catch (err) {
    await sendMessage(chatId, `Something went wrong: ${err instanceof Error ? err.message : "unknown error"}`);
  }
}
