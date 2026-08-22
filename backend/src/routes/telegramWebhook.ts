// Receives every message/button-tap sent to the bot (Telegram calls this
// URL directly once the webhook is registered — see lib/telegramBot.ts's
// setWebhook) and hands it off to the conversation engine in
// lib/telegramBotFlow.ts. This file is just the HTTP entrypoint + the
// Telegram-came-from-Telegram signature check.
import { Router } from "express";
import { handleTextMessage, handleCallback, handleInlineQuery } from "../lib/telegramBotFlow.ts";

export const telegramWebhookRouter = Router();

type TelegramUpdate = {
  message?: { chat: { id: number }; from?: { id: number; first_name?: string; last_name?: string; username?: string }; text?: string };
  callback_query?: { id: string; from: { id: number; first_name?: string; last_name?: string; username?: string }; message?: { chat: { id: number }; message_id?: number }; data?: string };
  inline_query?: { id: string; from: { id: number; first_name?: string; last_name?: string; username?: string }; query: string };
};

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
    const update: TelegramUpdate = req.body ?? {};

    if (update.inline_query) {
      const iq = update.inline_query;
      await handleInlineQuery(iq.id, iq.from, iq.query ?? "");
      return;
    }

    if (update.callback_query) {
      const cq = update.callback_query;
      const chatId = cq.message?.chat.id;
      if (chatId && cq.data) await handleCallback(chatId, cq.id, cq.from, cq.data, cq.message?.message_id);
      return;
    }

    if (update.message?.text && update.message.from) {
      await handleTextMessage(update.message.chat.id, update.message.from, update.message.text);
    }
  } catch (err) {
    console.error("[telegram webhook] handler failed:", err instanceof Error ? err.message : err);
  }
});
