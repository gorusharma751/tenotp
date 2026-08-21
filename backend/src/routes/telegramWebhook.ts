// Receives every message sent to the bot (Telegram calls this URL directly
// once the webhook is registered — see lib/telegramBot.ts's setWebhook) and
// replies to slash commands. This is what makes "/balance", "/orders" etc.
// actually work, on top of the Menu Button that just launches the Mini App.
//
// Every command that needs account data looks the user up by telegramId
// (set on first Mini App launch or first /start here — see below) — same
// account, same wallet, same orders as the website, nothing Telegram-only.
import { Router } from "express";
import { getCollection } from "../lib/mongo.ts";
import { sendMessage } from "../lib/telegramBot.ts";
import { findOrCreateTelegramUser } from "../lib/auth/telegramAccount.ts";
import type { UserDoc } from "../lib/types.ts";
import type { OrderDoc } from "../lib/db/wallet.ts";

export const telegramWebhookRouter = Router();

type TelegramMessage = {
  chat: { id: number };
  from?: { id: number; first_name?: string; last_name?: string; username?: string };
  text?: string;
};

const HELP_TEXT = [
  "<b>TenOTP bot commands</b>",
  "",
  "/start — open the app / see your balance",
  "/balance — check your wallet balance",
  "/orders — your 5 most recent orders",
  "/help — this message",
].join("\n");

telegramWebhookRouter.post("/webhook", async (req, res) => {
  // Telegram sends the secret_token set on setWebhook back on every call —
  // the only real proof this request came from Telegram, not someone who
  // guessed the webhook URL. Ack fast either way (Telegram retries/backs
  // off aggressively on anything but a quick 2xx), do the real work after.
  const expected = process.env.TELEGRAM_WEBHOOK_SECRET;
  if (expected && req.headers["x-telegram-bot-api-secret-token"] !== expected) {
    return res.status(401).end();
  }
  res.status(200).end();

  try {
    const msg: TelegramMessage | undefined = req.body?.message;
    if (!msg?.text || !msg.from) return;
    const chatId = msg.chat.id;
    const command = msg.text.trim().split(/\s+/)[0].toLowerCase().split("@")[0]; // strip "@BotName" suffix group chats append

    if (command === "/start") {
      const user = await findOrCreateTelegramUser(msg.from);
      await sendMessage(
        chatId,
        `👋 Welcome to <b>TenOTP</b>, ${msg.from.first_name ?? "there"}!\n\nBuy virtual numbers, get OTPs instantly, and manage your wallet — right here in Telegram.\n\n💰 Wallet balance: ₹${Number(user.walletBalance ?? 0).toFixed(2)}\n\nTap below to open the app, or try /help for commands.`,
        { withAppButton: true },
      );
      return;
    }

    // Every other command needs an existing account — /start (or the Mini
    // App itself) creates it, so anything else just looks it up.
    const users = await getCollection<UserDoc>("users");
    const user = await users.findOne({ telegramId: String(msg.from.id) });
    if (!user) {
      await sendMessage(chatId, "Send /start first so I can set up your account.", { withAppButton: true });
      return;
    }

    if (command === "/balance") {
      await sendMessage(chatId, `💰 Wallet balance: <b>₹${Number(user.walletBalance ?? 0).toFixed(2)}</b>`, { withAppButton: true, appButtonText: "Add funds", appPath: "/dashboard/deposit" });
    } else if (command === "/orders") {
      const ordersCol = await getCollection<OrderDoc>("orders");
      const recent = await ordersCol.find({ userId: user._id }).sort({ createdAt: -1 }).limit(5).toArray();
      if (recent.length === 0) {
        await sendMessage(chatId, "No orders yet.", { withAppButton: true, appButtonText: "Buy a number", appPath: "/dashboard/buy-number" });
        return;
      }
      const lines = recent.map((o) => {
        const otpPart = o.otp ? ` — OTP: <code>${o.otp}</code>` : "";
        return `• ${o.serviceName ?? "Service"} (${o.countryName ?? o.countryCode ?? "—"}) — <b>${o.status}</b>${otpPart}`;
      });
      await sendMessage(chatId, `📦 <b>Your recent orders</b>\n\n${lines.join("\n")}`, { withAppButton: true, appButtonText: "View all orders", appPath: "/dashboard/orders" });
    } else if (command === "/help") {
      await sendMessage(chatId, HELP_TEXT, { withAppButton: true });
    } else {
      await sendMessage(chatId, "Not sure what you mean — try /help, or tap the menu button to open the app.", { withAppButton: true });
    }
  } catch (err) {
    console.error("[telegram webhook] handler failed:", err instanceof Error ? err.message : err);
  }
});
