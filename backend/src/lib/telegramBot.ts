// Thin wrapper over the Telegram Bot API — https://core.telegram.org/bots/api.
// Every call is best-effort from the webhook handler's point of view: a
// failed sendMessage should never crash the webhook response (Telegram
// already got its 200 ack by then regardless — see routes/telegramWebhook.ts).
function apiUrl(method: string): string {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) throw new Error("TELEGRAM_BOT_TOKEN not configured");
  return `https://api.telegram.org/bot${token}/${method}`;
}

async function callTelegramApi(method: string, payload: Record<string, unknown>): Promise<unknown> {
  const res = await fetch(apiUrl(method), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const body = (await res.json()) as { ok: boolean; description?: string };
  if (!body.ok) console.error(`[telegramBot] ${method} failed:`, body.description ?? body);
  return body;
}

export type InlineButton = { text: string; callback_data?: string; web_app?: { url: string } };
export type InlineKeyboard = { inline_keyboard: InlineButton[][] };

/** The persistent button panel that sits under the message box — "jaise
 * mini app khulta hai waise hi neeche text ke neeche hi buttons aane
 * chahiye". Unlike inline buttons (which are attached to one message and
 * scroll away), this stays put across the whole chat, so the main actions
 * are always one tap away. Buttons send their label as a plain message,
 * which handleTextMessage maps back to the right command. */
export type ReplyKeyboard = { keyboard: Array<Array<{ text: string; web_app?: { url: string } }>>; resize_keyboard: boolean; is_persistent: boolean };

export function mainReplyKeyboard(): ReplyKeyboard {
  const base = process.env.FRONTEND_URL || "https://tenotp.vercel.app";
  return {
    keyboard: [
      [{ text: "🛒 Buy Number" }, { text: "🔍 Search Service" }],
      [{ text: "💰 Deposit" }, { text: "💼 Balance" }],
      [{ text: "📦 My Orders" }, { text: "🎁 Refer & Earn" }],
      [{ text: "📱 Open App", web_app: { url: base } }, { text: "❓ Help" }],
    ],
    resize_keyboard: true,
    is_persistent: true,
  };
}

/** The "Open TenOTP" inline button every command reply that isn't already
 * inside the app offers — one tap launches the same Mini App the Menu
 * Button does. */
export function appButton(text = "Open TenOTP", path = ""): InlineButton {
  const base = process.env.FRONTEND_URL || "https://tenotp.vercel.app";
  return { text, web_app: { url: `${base}${path}` } };
}

export function withAppButtonRow(rows: InlineButton[][], text?: string, path?: string): InlineKeyboard {
  return { inline_keyboard: [...rows, [appButton(text, path)]] };
}

export async function sendMessage(
  chatId: number | string,
  text: string,
  opts?: { keyboard?: InlineKeyboard; replyKeyboard?: ReplyKeyboard; withAppButton?: boolean; appButtonText?: string; appPath?: string },
) {
  const payload: Record<string, unknown> = { chat_id: chatId, text, parse_mode: "HTML" };
  if (opts?.replyKeyboard) payload.reply_markup = opts.replyKeyboard;
  else if (opts?.keyboard) payload.reply_markup = opts.keyboard;
  else if (opts?.withAppButton) payload.reply_markup = { inline_keyboard: [[appButton(opts.appButtonText, opts.appPath)]] };
  return callTelegramApi("sendMessage", payload);
}

/** Sends the deposit QR — `photo` is either a real https URL (Telegram
 * fetches it itself) or a `data:image/...;base64,...` URI (decoded and
 * uploaded as multipart, since Telegram's sendPhoto doesn't accept data
 * URIs directly). Falls back to a text message with the UPI link if
 * there's no image at all (e.g. gateway mode with no admin-uploaded QR). */
export async function sendPhotoOrLink(chatId: number | string, photo: string, caption: string, keyboard?: InlineKeyboard) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) throw new Error("TELEGRAM_BOT_TOKEN not configured");

  if (photo.startsWith("data:image")) {
    const match = /^data:image\/(\w+);base64,(.+)$/.exec(photo);
    if (match) {
      const [, ext, b64] = match;
      const bytes = Buffer.from(b64, "base64");
      const form = new FormData();
      form.append("chat_id", String(chatId));
      form.append("caption", caption);
      form.append("parse_mode", "HTML");
      if (keyboard) form.append("reply_markup", JSON.stringify(keyboard));
      form.append("photo", new Blob([bytes], { type: `image/${ext}` }), `qr.${ext}`);
      const res = await fetch(`https://api.telegram.org/bot${token}/sendPhoto`, { method: "POST", body: form });
      const body = (await res.json()) as { ok: boolean; description?: string };
      if (!body.ok) console.error("[telegramBot] sendPhoto (upload) failed:", body.description ?? body);
      return body;
    }
  } else if (photo.startsWith("http")) {
    return callTelegramApi("sendPhoto", { chat_id: chatId, photo, caption, parse_mode: "HTML", reply_markup: keyboard });
  }
  // No usable image — text fallback so the flow still works.
  return sendMessage(chatId, caption, { keyboard });
}

export async function answerCallbackQuery(callbackQueryId: string, text?: string) {
  return callTelegramApi("answerCallbackQuery", { callback_query_id: callbackQueryId, text, show_alert: false });
}

export async function editMessageText(chatId: number | string, messageId: number, text: string, keyboard?: InlineKeyboard) {
  return callTelegramApi("editMessageText", { chat_id: chatId, message_id: messageId, text, parse_mode: "HTML", reply_markup: keyboard });
}

/** Registers the "/" command menu Telegram shows in the chat composer —
 * call once (e.g. from a small one-off setup script), not per-request. */
export async function setMyCommands(commands: Array<{ command: string; description: string }>) {
  return callTelegramApi("setMyCommands", { commands });
}

export async function setWebhook(url: string, secretToken: string) {
  return callTelegramApi("setWebhook", { url, secret_token: secretToken, allowed_updates: ["message", "callback_query"] });
}
