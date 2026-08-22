// Full bot conversation engine — everything the website does, driven by
// buttons and commands inside the chat ("bar bar mini app nahi dena,
// command ka khel hona chahiye"): buy a number, search services, deposit
// via BharatPe QR with auto-confirmation, check balance/orders, and
// referrals. Every money/provider-touching action calls this SAME backend's
// own REST API (see telegramSelfApi.ts) instead of re-implementing pricing
// / purchase / payment logic — same account, same wallet, same rules as the
// website, nothing to drift.
//
// Every reply ends with the buttons for whatever can sensibly happen next,
// so the flow never dead-ends on a message with nothing to tap.
import { getCollection } from "./mongo.ts";
import { sendMessage, sendPhotoOrLink, answerCallbackQuery, mainReplyKeyboard, type InlineKeyboard, type InlineButton } from "./telegramBot.ts";
import { callSelfApi } from "./telegramSelfApi.ts";
import { findOrCreateTelegramUser, linkTelegramToAccount, type TelegramProfile } from "./auth/telegramAccount.ts";
import { handleManualText, handleManualCallback, showManualHome } from "./telegramManualFlow.ts";
import type { UserDoc } from "./types.ts";

/** Manual Provider is soft-launched — live but admin-only for now, exactly
 * like the website's version (the API itself enforces this via
 * requireSoftLaunchAdmin; this just keeps the entry hidden for everyone
 * else instead of showing a button that would only 403). */
function isManualUnlocked(user: UserDoc): boolean {
  return user.roles.includes("admin");
}

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

// ---- Shared next-step button rows ----
const NAV_HOME: InlineButton[] = [{ text: "🏠 Menu", callback_data: "m:menu" }];
const kb = (...rows: InlineButton[][]): InlineKeyboard => ({ inline_keyboard: rows });

// Persistent panel under the message box (see mainReplyKeyboard) — taps
// arrive as plain text, mapped back to commands here.
const BUTTON_COMMANDS: Record<string, string> = {
  "🛒 buy number": "/buy",
  "🔍 search service": "/search",
  "💰 deposit": "/deposit",
  "💼 balance": "/balance",
  "📦 my orders": "/orders",
  "🎁 refer & earn": "/refer",
  "🤝 manual otp": "/manual",
  "❓ help": "/help",
};

async function sendMenu(chatId: number, greeting?: string, withManual = false) {
  await sendMessage(chatId, greeting ?? "What would you like to do?", { replyKeyboard: mainReplyKeyboard({ withManual }) });
}

/** Shown on /start and /menu. When Manual Provider is available to this
 * account there are genuinely two sides to be on, so ask once — buyers go
 * straight to the buying menu (which itself offers both virtual and manual
 * numbers), sellers get the seller panel. Everyone else skips the question
 * entirely, since "buyer" is the only thing they can be. */
async function sendWelcome(chatId: number, user: UserDoc, firstName?: string) {
  const manual = isManualUnlocked(user);
  const unlinked = user.email.endsWith("@telegram.local")
    ? `\n\n🔗 Already have an account on the website? Send /link to use it here (same wallet &amp; orders).`
    : "";
  const balance = `\n\n💰 Balance: ₹${Number(user.walletBalance ?? 0).toFixed(2)}`;

  if (!manual) {
    await sendMenu(chatId, `👋 Welcome to <b>TenOTP</b>, ${firstName ?? "there"}!${balance}${unlinked}`, false);
    return;
  }
  await sendMessage(
    chatId,
    `👋 Welcome to <b>TenOTP</b>, ${firstName ?? "there"}!${balance}${unlinked}\n\nWhich side are you on?`,
    { keyboard: kb([{ text: "🛍 I'm a Buyer", callback_data: "role:buyer" }], [{ text: "🧑‍💼 I'm a Seller", callback_data: "role:seller" }]) },
  );
}

/** The buyer's home — both ways to get a number, side by side, so the
 * choice is right there rather than buried ("buyer me 2 honge na, manual
 * aur virtual"). */
async function sendBuyerMenu(chatId: number, user: UserDoc) {
  await sendMenu(
    chatId,
    `🛍 <b>Buyer</b>\n\n` +
      `⚡ <b>Virtual Number</b> — instant, automatic, cheapest\n` +
      `🤝 <b>Manual OTP</b> — a real person's number, for services virtual numbers don't accept\n\n` +
      `💰 Balance: ₹${Number(user.walletBalance ?? 0).toFixed(2)}`,
    isManualUnlocked(user),
  );
  await sendMessage(chatId, "Pick how you want your number:", {
    keyboard: kb(
      [{ text: "⚡ Virtual Number (instant)", callback_data: "m:buy" }],
      [{ text: "🤝 Manual OTP (real number)", callback_data: "m:manual" }],
      [{ text: "💰 Deposit", callback_data: "m:deposit" }, { text: "📦 Orders", callback_data: "m:orders" }],
    ),
  });
}

// ---- Buy flow ----
interface CountryRow { code: string; name: string; flag: string; numbersAvailable: number; priceFrom: number }
interface ServiceRow {
  id: string; externalId: string; name: string; icon: string; category: string; price: number; stock: number;
  providerId: string; providerName: string; serverLabel: string; countryCode: string; avgSpeedSec: number | null; supportsMulti: boolean;
}

async function startBuyFlow(chatId: number) {
  await setSession(String(chatId), "buy_country", {});
  await sendMessage(chatId, '🌍 <b>Step 1 of 3</b> — type a country name\n\ne.g. "India", "USA", "Russia"', { keyboard: kb(NAV_HOME) });
}

async function selectCountry(chatId: number, country: CountryRow) {
  await setSession(String(chatId), "buy_service", { country });
  await sendMessage(
    chatId,
    `✅ ${country.flag} <b>${country.name}</b> selected.\n\n🔍 <b>Step 2 of 3</b> — type a service name\n\ne.g. "WhatsApp", "Telegram", "Instagram"`,
    { keyboard: kb([{ text: "🌍 Change country", callback_data: "m:buy" }], NAV_HOME) },
  );
}

async function handleCountrySearch(chatId: number, userId: string, roles: string[], text: string) {
  const countries = await callSelfApi<CountryRow[]>(userId, roles, "GET", "/api/catalog/countries");
  const q = text.trim().toLowerCase();
  const matches = countries.filter((c) => c.name.toLowerCase().includes(q)).slice(0, 8);
  if (matches.length === 0) {
    await sendMessage(chatId, `❌ No country matched "${text}". Type another name.`, { keyboard: kb(NAV_HOME) });
    return;
  }
  // Typing the country's actual name shouldn't then make you tap it again —
  // only show the picker when the search is genuinely ambiguous.
  const exact = matches.find((c) => c.name.toLowerCase() === q);
  if (exact || matches.length === 1) {
    await selectCountry(chatId, exact ?? matches[0]);
    return;
  }
  await setSession(String(chatId), "buy_country_pick", { countries: matches });
  await sendMessage(chatId, `Found ${matches.length} matches — pick one:`, {
    keyboard: kb(...matches.map((c) => [{ text: `${c.flag} ${c.name} — from ₹${c.priceFrom}`, callback_data: `cty:${c.code}` }]), NAV_HOME),
  });
}

async function handleCountryPick(chatId: number, code: string) {
  const session = await getSession(String(chatId));
  const countries = (session.data.countries as CountryRow[] | undefined) ?? [];
  const country = countries.find((c) => c.code === code);
  if (!country) {
    await startBuyFlow(chatId);
    return;
  }
  await selectCountry(chatId, country);
}

async function handleServiceSearch(chatId: number, userId: string, roles: string[], text: string) {
  const session = await getSession(String(chatId));
  const country = session.data.country as CountryRow | undefined;
  if (!country) {
    await startBuyFlow(chatId);
    return;
  }
  const rows = await callSelfApi<ServiceRow[]>(userId, roles, "POST", "/api/otp/services", { countryName: country.name, q: text.trim() });
  if (rows.length === 0) {
    await sendMessage(chatId, `❌ No service matched "${text}" in ${country.name}. Try another name.`, {
      keyboard: kb([{ text: "🌍 Change country", callback_data: "m:buy" }], NAV_HOME),
    });
    return;
  }
  const top = rows.slice(0, 8);
  await setSession(String(chatId), "buy_service_pick", { country, services: top });
  await sendMessage(chatId, `🔍 <b>Step 3 of 3</b> — ${rows.length} option(s) for "${text}" in ${country.name}:`, {
    keyboard: kb(...top.map((s, i) => [{ text: `${s.name} · ₹${s.price} · ${s.stock} left`, callback_data: `svc:${i}` }]), NAV_HOME),
  });
}

async function handleServicePick(chatId: number, idx: number) {
  const session = await getSession(String(chatId));
  const country = session.data.country as CountryRow | undefined;
  const services = (session.data.services as ServiceRow[] | undefined) ?? [];
  const service = services[idx];
  if (!country || !service) {
    await startBuyFlow(chatId);
    return;
  }
  await setSession(String(chatId), "buy_confirm", { country, service });
  await sendMessage(
    chatId,
    `🧾 <b>Confirm your order</b>\n\nService: <b>${service.name}</b>\nCountry: ${country.flag} ${country.name}\nServer: ${service.serverLabel}\nStock: ${service.stock}\n\n💵 Price: <b>₹${service.price}</b>`,
    { keyboard: kb([{ text: "✅ Confirm & Buy", callback_data: "buy_confirm" }], [{ text: "🔙 Back", callback_data: "m:buy" }, ...NAV_HOME]) },
  );
}

async function handleBuyConfirm(chatId: number, userId: string, roles: string[]) {
  const session = await getSession(String(chatId));
  const country = session.data.country as CountryRow | undefined;
  const service = session.data.service as ServiceRow | undefined;
  if (!country || !service) {
    await startBuyFlow(chatId);
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
      `✅ <b>Number ready!</b>\n\n📱 <code>${order.number}</code>\n\n${order.service} · ${order.country}\nPaid: ₹${order.price}\n\nUse this number where you need the OTP, then tap <b>Check OTP</b> below.`,
      { keyboard: kb([{ text: "🔄 Check OTP", callback_data: `otp:${order.id}` }], [{ text: "🛒 Buy another", callback_data: "m:buy" }, ...NAV_HOME]) },
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : "unknown error";
    // Out of money is the one failure with an obvious next step — offer it.
    const lowBalance = /insufficient balance/i.test(msg);
    await sendMessage(chatId, `❌ ${msg}`, {
      keyboard: lowBalance
        ? kb([{ text: "💰 Add funds", callback_data: "m:deposit" }], [{ text: "🛒 Try again", callback_data: "m:buy" }, ...NAV_HOME])
        : kb([{ text: "🛒 Try again", callback_data: "m:buy" }, ...NAV_HOME]),
    });
  }
}

async function handleCheckOtp(chatId: number, userId: string, roles: string[], orderId: string) {
  try {
    const r = await callSelfApi<{ status: string; otp: string | null }>(userId, roles, "POST", "/api/otp/status", { orderId });
    if (r.otp) {
      await sendMessage(chatId, `🎉 <b>OTP received!</b>\n\n<code>${r.otp}</code>`, {
        keyboard: kb([{ text: "🛒 Buy another", callback_data: "m:buy" }, ...NAV_HOME]),
      });
      return;
    }
    await sendMessage(chatId, `⏳ No OTP yet (status: ${r.status}). Give it a few seconds and check again.`, {
      keyboard: kb([{ text: "🔄 Check again", callback_data: `otp:${orderId}` }], [{ text: "❌ Cancel order", callback_data: `cancel:${orderId}` }, ...NAV_HOME]),
    });
  } catch (err) {
    await sendMessage(chatId, `❌ ${err instanceof Error ? err.message : "Could not check status"}`, { keyboard: kb(NAV_HOME) });
  }
}

async function handleCancelOrder(chatId: number, userId: string, roles: string[], orderId: string) {
  try {
    await callSelfApi(userId, roles, "POST", "/api/otp/cancel", { orderId });
    await sendMessage(chatId, "✅ Order cancelled and refunded to your wallet.", {
      keyboard: kb([{ text: "🛒 Buy again", callback_data: "m:buy" }, ...NAV_HOME]),
    });
  } catch (err) {
    await sendMessage(chatId, `❌ ${err instanceof Error ? err.message : "Could not cancel"}`, {
      keyboard: kb([{ text: "🔄 Check OTP", callback_data: `otp:${orderId}` }, ...NAV_HOME]),
    });
  }
}

// ---- Deposit flow (BharatPe QR -> pay -> auto-confirm / UTR) ----
const AMOUNT_PRESETS: InlineButton[][] = [
  [{ text: "₹50", callback_data: "dep:50" }, { text: "₹100", callback_data: "dep:100" }, { text: "₹200", callback_data: "dep:200" }],
  [{ text: "₹500", callback_data: "dep:500" }, { text: "₹1000", callback_data: "dep:1000" }, { text: "₹2000", callback_data: "dep:2000" }],
];

async function startDepositFlow(chatId: number) {
  await setSession(String(chatId), "deposit_amount", {});
  await sendMessage(chatId, "💰 <b>Add funds</b>\n\nPick an amount, or just type any amount (₹10 – ₹200000):", {
    keyboard: kb(...AMOUNT_PRESETS, NAV_HOME),
  });
}

async function createDeposit(chatId: number, userId: string, roles: string[], amount: number) {
  if (!Number.isFinite(amount) || amount < 10 || amount > 200000) {
    await sendMessage(chatId, "❌ Enter an amount between ₹10 and ₹200000.", { keyboard: kb(...AMOUNT_PRESETS, NAV_HOME) });
    return;
  }
  try {
    // provider: "bharatpe" — same gateway the website's deposit page uses,
    // so auto-verification (findBharatpeCredit) works the same way here.
    const qr = await callSelfApi<{ sessionId: string; orderId: string; amount: number; qrData: string; qrImage: string; upiId: string }>(
      userId, roles, "POST", "/api/payments/paytm/create-qr", { amount, provider: "bharatpe" },
    );
    await setSession(String(chatId), "deposit_wait", { sessionId: qr.sessionId, amount: qr.amount });
    const caption =
      `💰 <b>Pay exactly ₹${qr.amount}</b>\n\n` +
      `📲 Scan this QR with any UPI app (GPay / PhonePe / Paytm)` +
      (qr.upiId ? `\n\nOr pay to UPI ID:\n<code>${qr.upiId}</code>` : "") +
      `\n\n⚠️ Pay the exact amount — it's how the payment is matched to you.\n\n` +
      `After paying, tap <b>✅ I've Paid</b>.`;
    const keyboard = kb(
      [{ text: "✅ I've Paid", callback_data: "dep:check" }],
      [{ text: "✍️ Enter UTR instead", callback_data: "dep:utr" }],
      [{ text: "❌ Cancel", callback_data: "m:menu" }],
    );
    // Same fallback the website's deposit page uses: when no merchant QR
    // image is configured, render the UPI link as a QR instead of leaving
    // the user with just a link ("payment karte time QR nahi ban ke aa
    // raha"). Telegram fetches the URL itself for sendPhoto.
    const qrImage = qr.qrImage || `https://api.qrserver.com/v1/create-qr-code/?size=512x512&margin=16&data=${encodeURIComponent(qr.qrData)}`;
    await sendPhotoOrLink(chatId, qrImage, caption, keyboard);
  } catch (err) {
    await sendMessage(chatId, `❌ Could not start a deposit: ${err instanceof Error ? err.message : "unknown error"}`, { keyboard: kb(NAV_HOME) });
    await clearSession(String(chatId));
  }
}

async function handleDepositCheck(chatId: number, userId: string, roles: string[]) {
  const session = await getSession(String(chatId));
  const sessionId = session.data.sessionId as string | undefined;
  if (!sessionId) {
    await startDepositFlow(chatId);
    return;
  }
  try {
    const r = await callSelfApi<{ status: string; credited: boolean; balance: number | null; message: string }>(
      userId, roles, "POST", "/api/payments/paytm/check-qr", { sessionId },
    );
    if (r.credited) {
      await clearSession(String(chatId));
      await sendMessage(chatId, `✅ <b>Payment received!</b>\n\n💰 New balance: <b>₹${Number(r.balance ?? 0).toFixed(2)}</b>`, {
        keyboard: kb([{ text: "🛒 Buy a number", callback_data: "m:buy" }, ...NAV_HOME]),
      });
      return;
    }
    await sendMessage(chatId, `⏳ ${r.message || "Waiting for payment"}\n\nIf you've already paid, wait a few seconds and check again — or submit the UTR.`, {
      keyboard: kb([{ text: "🔄 Check again", callback_data: "dep:check" }], [{ text: "✍️ Enter UTR", callback_data: "dep:utr" }, ...NAV_HOME]),
    });
  } catch (err) {
    await sendMessage(chatId, `❌ ${err instanceof Error ? err.message : "Could not verify"}`, {
      keyboard: kb([{ text: "✍️ Enter UTR", callback_data: "dep:utr" }, ...NAV_HOME]),
    });
  }
}

async function promptUtr(chatId: number) {
  const session = await getSession(String(chatId));
  if (!session.data.sessionId) {
    await startDepositFlow(chatId);
    return;
  }
  await setSession(String(chatId), "deposit_utr", session.data);
  await sendMessage(chatId, "✍️ Type the <b>UTR / reference number</b> from your payment app:", { keyboard: kb(NAV_HOME) });
}

async function handleUtrSubmit(chatId: number, userId: string, roles: string[], text: string) {
  const session = await getSession(String(chatId));
  const sessionId = session.data.sessionId as string | undefined;
  if (!sessionId) {
    await startDepositFlow(chatId);
    return;
  }
  const utr = text.trim();
  if (utr.length < 6) {
    await sendMessage(chatId, "❌ That doesn't look like a valid UTR — enter the full reference number.", { keyboard: kb(NAV_HOME) });
    return;
  }
  try {
    const result = await callSelfApi<{ credited: boolean; pending: boolean; balance: number }>(
      userId, roles, "POST", "/api/payments/paytm/submit-utr", { sessionId, utr },
    );
    await clearSession(String(chatId));
    if (result.credited) {
      await sendMessage(chatId, `✅ <b>Deposit confirmed!</b>\n\n💰 New balance: <b>₹${Number(result.balance).toFixed(2)}</b>`, {
        keyboard: kb([{ text: "🛒 Buy a number", callback_data: "m:buy" }, ...NAV_HOME]),
      });
    } else {
      await sendMessage(chatId, "⏳ UTR submitted — verification in progress. You'll be notified once it's confirmed (usually within a few minutes).", {
        keyboard: kb([{ text: "💼 Check balance", callback_data: "m:balance" }, ...NAV_HOME]),
      });
    }
  } catch (err) {
    await sendMessage(chatId, `❌ ${err instanceof Error ? err.message : "Could not verify"}`, { keyboard: kb(NAV_HOME) });
  }
}

// ---- Info screens ----
async function showBalance(chatId: number, userId: string, roles: string[]) {
  const wallet = await callSelfApi<{ balance: number }>(userId, roles, "GET", "/api/wallet/balance");
  await sendMessage(chatId, `💼 <b>Wallet balance</b>\n\n₹${Number(wallet.balance).toFixed(2)}`, {
    keyboard: kb([{ text: "💰 Add funds", callback_data: "m:deposit" }, { text: "🛒 Buy number", callback_data: "m:buy" }], NAV_HOME),
  });
}

interface OrderRow { id: string; service: string; country: string; number: string; status: string; otp?: string; price: number }
async function showOrders(chatId: number, userId: string, roles: string[]) {
  const orders = await callSelfApi<OrderRow[]>(userId, roles, "GET", "/api/otp/my-orders");
  if (orders.length === 0) {
    await sendMessage(chatId, "📦 No orders yet.", { keyboard: kb([{ text: "🛒 Buy your first number", callback_data: "m:buy" }], NAV_HOME) });
    return;
  }
  const recent = orders.slice(0, 5);
  const lines = recent.map((o) => `• <b>${o.service}</b> (${o.country})\n  <code>${o.number}</code> — ${o.status}${o.otp ? ` — OTP: <code>${o.otp}</code>` : ""}`);
  // Any order still waiting gets its own re-check button, so a pending OTP
  // is always one tap away rather than needing the app.
  const pending = recent.filter((o) => !o.otp && o.status === "pending").slice(0, 3);
  await sendMessage(chatId, `📦 <b>Recent orders</b>\n\n${lines.join("\n")}`, {
    keyboard: kb(...pending.map((o) => [{ text: `🔄 Check OTP — ${o.service}`, callback_data: `otp:${o.id}` }]), [{ text: "🛒 Buy number", callback_data: "m:buy" }, ...NAV_HOME]),
  });
}

interface ReferralRow { earned: number }
async function showReferrals(chatId: number, userId: string, roles: string[], user: UserDoc) {
  const rows = await callSelfApi<ReferralRow[]>(userId, roles, "GET", "/api/referrals/");
  const totalEarned = rows.reduce((sum, r) => sum + Number(r.earned || 0), 0);
  const botName = process.env.TELEGRAM_BOT_USERNAME || "TenotpNo1_bot";
  const link = `https://t.me/${botName}?start=${user.referralCode}`;
  await sendMessage(
    chatId,
    `🎁 <b>Refer &amp; Earn</b>\n\nShare your link — you earn <b>10%</b> of every purchase your referrals make, credited straight to your wallet.\n\n🔗 ${link}\n\nYour code: <code>${user.referralCode}</code>\n\n👥 Referred: <b>${rows.length}</b>\n💰 Earned: <b>₹${totalEarned.toFixed(2)}</b>`,
    { keyboard: kb([{ text: "💼 Balance", callback_data: "m:balance" }, ...NAV_HOME]) },
  );
}

// ---- Link an existing website account ----
async function startLink(chatId: number, user: UserDoc) {
  if (user.telegramId && !user.email.endsWith("@telegram.local")) {
    await sendMessage(chatId, `✅ Already linked to <b>${user.email}</b>.`, { keyboard: kb(NAV_HOME) });
    return;
  }
  await setSession(String(chatId), "link_email", {});
  await sendMessage(
    chatId,
    "🔗 <b>Link your website account</b>\n\nUsing the same account everywhere means one wallet, one order history — instead of a separate bot-only account.\n\nType the <b>email</b> you use on the website:",
    { keyboard: kb(NAV_HOME) },
  );
}

async function handleLinkEmail(chatId: number, email: string) {
  await setSession(String(chatId), "link_password", { email: email.trim() });
  await sendMessage(chatId, "🔑 Now type your <b>password</b>.\n\n(Delete the message after — Telegram keeps chat history.)", { keyboard: kb(NAV_HOME) });
}

async function handleLinkPassword(chatId: number, telegramId: string, password: string) {
  const s = await getSession(String(chatId));
  const email = s.data.email as string | undefined;
  if (!email) { await sendMessage(chatId, "Start again with /link.", { keyboard: kb(NAV_HOME) }); return; }
  try {
    const linked = await linkTelegramToAccount(telegramId, email, password);
    await clearSession(String(chatId));
    await sendMenu(
      chatId,
      `✅ <b>Linked to ${linked.email}</b>\n\nThis chat now uses that account — same wallet, same orders as the website.\n\n💰 Balance: ₹${Number(linked.walletBalance ?? 0).toFixed(2)}`,
      isManualUnlocked(linked),
    );
  } catch (err) {
    console.error("[link] failed:", err instanceof Error ? err.message : err);
    await setSession(String(chatId), "link_email", {});
    await sendMessage(chatId, `❌ ${err instanceof Error ? err.message : "Could not link"}\n\nType your email again, or /menu to stop.`, { keyboard: kb(NAV_HOME) });
  }
}

const HELP_TEXT = [
  "<b>TenOTP bot — everything works right here in chat</b>",
  "",
  "🛒 /buy — buy a virtual number",
  "🔍 /search — search for a service",
  "💰 /deposit — add funds (UPI QR, auto-confirmed)",
  "💼 /balance — wallet balance",
  "📦 /orders — recent orders + check OTP",
  "🎁 /refer — your referral link &amp; earnings",
  "🔗 /link — use your existing website account here",
  "🏠 /menu — main menu",
  "",
  "Use the buttons under the message box for one-tap access.",
].join("\n");

// ---- Referral capture on /start <code> ----
async function applyReferralCode(user: UserDoc, code: string) {
  if (!code || user.referredBy) return; // already attributed; never re-attribute
  const users = await getCollection<UserDoc>("users");
  const referrer = await users.findOne({ referralCode: code.toUpperCase() });
  if (!referrer || referrer._id === user._id) return; // unknown code, or self-referral
  await users.updateOne({ _id: user._id }, { $set: { referredBy: referrer._id } });
  const referrals = await getCollection("referrals");
  await referrals.updateOne(
    { referrerId: referrer._id, referredId: user._id },
    { $setOnInsert: { _id: crypto.randomUUID(), referrerId: referrer._id, referredId: user._id, percent: 10, totalEarned: 0, createdAt: new Date() } },
    { upsert: true },
  );
}

// ---- Entry points from routes/telegramWebhook.ts ----

export async function handleTextMessage(chatId: number, from: TelegramProfile, text: string) {
  const user = await findOrCreateTelegramUser(from);
  const roles = user.roles;
  // A tap on one of the persistent buttons arrives as its plain label.
  const asButton = BUTTON_COMMANDS[text.trim().toLowerCase()];
  if (asButton) text = asButton;
  const parts = text.trim().split(/\s+/);
  const cmd = parts[0].toLowerCase().split("@")[0];

  if (cmd === "/start" || cmd === "/menu") {
    // "/start <code>" is how a referral link arrives — attribute it before
    // anything else so the referrer earns from this user's first purchase.
    if (cmd === "/start" && parts[1]) await applyReferralCode(user, parts[1]);
    await clearSession(String(chatId));
    await sendWelcome(chatId, user, from.first_name);
    return;
  }
  if (cmd === "/manual") {
    if (!isManualUnlocked(user)) {
      await sendMessage(chatId, "🤝 Manual OTP isn't available on your account yet.", { keyboard: kb(NAV_HOME) });
      return;
    }
    await clearSession(String(chatId));
    await showManualHome(chatId);
    return;
  }
  if (cmd === "/buy" || cmd === "/search") { await startBuyFlow(chatId); return; }
  if (cmd === "/deposit") { await startDepositFlow(chatId); return; }
  if (cmd === "/balance") { await showBalance(chatId, user._id, roles); return; }
  if (cmd === "/orders") { await showOrders(chatId, user._id, roles); return; }
  if (cmd === "/refer") { await showReferrals(chatId, user._id, roles, user); return; }
  if (cmd === "/link") { await startLink(chatId, user); return; }
  if (cmd === "/help") { await sendMessage(chatId, HELP_TEXT, { keyboard: kb(NAV_HOME) }); return; }
  if (cmd === "/cancel") { await clearSession(String(chatId)); await sendMenu(chatId, "Cancelled."); return; }

  // Not a command — route by whatever step this chat is in.
  const session = await getSession(String(chatId));
  try {
    // Manual Provider steps live in their own module — let it claim the
    // message first if one of its flows is mid-way.
    if (session.step.startsWith("mp_") && await handleManualText(chatId, user._id, roles, session.step, text)) return;
    if (session.step === "buy_country") { await handleCountrySearch(chatId, user._id, roles, text); return; }
    if (session.step === "buy_service") { await handleServiceSearch(chatId, user._id, roles, text); return; }
    if (session.step === "deposit_amount") { await createDeposit(chatId, user._id, roles, Number(text.trim().replace(/[₹,\s]/g, ""))); return; }
    if (session.step === "deposit_utr") { await handleUtrSubmit(chatId, user._id, roles, text); return; }
    if (session.step === "link_email") { await handleLinkEmail(chatId, text); return; }
    if (session.step === "link_password") { await handleLinkPassword(chatId, String(from.id), text); return; }
  } catch (err) {
    await sendMessage(chatId, `❌ ${err instanceof Error ? err.message : "Something went wrong"}`, { keyboard: kb(NAV_HOME) });
    return;
  }

  await sendMessage(chatId, "🤔 Not sure what you mean — use the buttons below, or /help.", { keyboard: kb(NAV_HOME) });
}

export async function handleCallback(chatId: number, callbackQueryId: string, from: TelegramProfile, data: string) {
  const user = await findOrCreateTelegramUser(from);
  const roles = user.roles;
  // Ack immediately so Telegram stops showing the button's loading spinner —
  // the real work below can take a second (upstream provider calls).
  await answerCallbackQuery(callbackQueryId);

  try {
    // Manual Provider buttons — gated the same way the menu entry is, so a
    // stale button from before access changed can't be used either.
    if ((data === "m:manual" || data.startsWith("mp")) && isManualUnlocked(user)) {
      if (await handleManualCallback(chatId, user._id, roles, data)) return;
    }
    if (data === "role:buyer") { await clearSession(String(chatId)); await sendBuyerMenu(chatId, user); return; }
    if (data === "role:seller") {
      // Guarded like every other Manual Provider entry — a stale button
      // from before access changed must not get through.
      if (!isManualUnlocked(user)) { await sendBuyerMenu(chatId, user); return; }
      await clearSession(String(chatId));
      await handleManualCallback(chatId, user._id, roles, "mp:seller");
      return;
    }
    if (data === "m:menu") { await clearSession(String(chatId)); await sendWelcome(chatId, user); return; }
    if (data === "m:buy" || data === "m:search") { await startBuyFlow(chatId); return; }
    if (data === "m:deposit") { await startDepositFlow(chatId); return; }
    if (data === "m:balance") { await showBalance(chatId, user._id, roles); return; }
    if (data === "m:orders") { await showOrders(chatId, user._id, roles); return; }
    if (data === "m:refer") { await showReferrals(chatId, user._id, roles, user); return; }
    if (data === "m:help") { await sendMessage(chatId, HELP_TEXT, { keyboard: kb(NAV_HOME) }); return; }
    if (data.startsWith("cty:")) { await handleCountryPick(chatId, data.slice(4)); return; }
    if (data.startsWith("svc:")) { await handleServicePick(chatId, Number(data.slice(4))); return; }
    if (data === "buy_confirm") { await handleBuyConfirm(chatId, user._id, roles); return; }
    if (data.startsWith("otp:")) { await handleCheckOtp(chatId, user._id, roles, data.slice(4)); return; }
    if (data.startsWith("cancel:")) { await handleCancelOrder(chatId, user._id, roles, data.slice(7)); return; }
    if (data === "dep:check") { await handleDepositCheck(chatId, user._id, roles); return; }
    if (data === "dep:utr") { await promptUtr(chatId); return; }
    if (data.startsWith("dep:")) { await createDeposit(chatId, user._id, roles, Number(data.slice(4))); return; }
  } catch (err) {
    await sendMessage(chatId, `❌ ${err instanceof Error ? err.message : "Something went wrong"}`, { keyboard: kb(NAV_HOME) });
  }
}
