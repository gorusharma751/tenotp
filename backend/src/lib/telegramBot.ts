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

/** The "Open TenOTP" inline button every command reply that isn't already
 * inside the app offers — one tap launches the same Mini App the Menu
 * Button does. */
function openAppKeyboard(text = "Open TenOTP", path = "") {
  const base = process.env.FRONTEND_URL || "https://tenotp.vercel.app";
  return { inline_keyboard: [[{ text, web_app: { url: `${base}${path}` } }]] };
}

export async function sendMessage(chatId: number | string, text: string, opts?: { withAppButton?: boolean; appButtonText?: string; appPath?: string }) {
  const payload: Record<string, unknown> = { chat_id: chatId, text, parse_mode: "HTML" };
  if (opts?.withAppButton) payload.reply_markup = openAppKeyboard(opts.appButtonText, opts.appPath);
  return callTelegramApi("sendMessage", payload);
}

/** Registers the "/" command menu Telegram shows in the chat composer —
 * call once (e.g. from a small one-off setup script), not per-request. */
export async function setMyCommands(commands: Array<{ command: string; description: string }>) {
  return callTelegramApi("setMyCommands", { commands });
}

export async function setWebhook(url: string, secretToken: string) {
  return callTelegramApi("setWebhook", { url, secret_token: secretToken, allowed_updates: ["message"] });
}
