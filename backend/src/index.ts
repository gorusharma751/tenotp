import express from "express";
import cors from "cors";
import { authRouter } from "./routes/auth.ts";
import { otpRouter } from "./routes/otp.ts";
import { walletRouter } from "./routes/wallet.ts";
import { paymentsRouter } from "./routes/payments.ts";
import { adminRouter } from "./routes/admin.ts";
import { providersRouter } from "./routes/providers.ts";
import { publicRouter } from "./routes/public.ts";
import { realtimeRouter } from "./routes/realtime.ts";
import { referralsRouter } from "./routes/referrals.ts";
import { catalogRouter } from "./routes/catalog.ts";
import { manualProvidersRouter } from "./routes/manualProviders.ts";
import { telegramWebhookRouter } from "./routes/telegramWebhook.ts";
import { getDb } from "./lib/mongo.ts";
import { ensureIndexes } from "./lib/ensureIndexes.ts";
import { startProviderAutoSync } from "./lib/providers/autoSync.ts";
import { autoExpireStaleRequests } from "./lib/db/manualProviders.ts";

const app = express();

// Frontend origin(s) allowed to call this API with credentials. Comma-separated
// in FRONTEND_ORIGIN, e.g. "http://localhost:5173,https://tenotp.vercel.app".
const allowedOrigins = (process.env.FRONTEND_ORIGIN || "http://localhost:5173")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

app.use(
  cors({
    origin(origin, callback) {
      if (!origin || allowedOrigins.includes(origin)) return callback(null, true);
      callback(new Error(`Origin ${origin} not allowed`));
    },
    credentials: true,
  }),
);
app.use(express.json({ limit: "6mb" })); // deposit screenshot data URLs can be a few MB

app.get("/health", (_req, res) => res.json({ ok: true }));

app.use("/api/auth", authRouter);
app.use("/api/otp", otpRouter);
app.use("/api/wallet", walletRouter);
app.use("/api/payments", paymentsRouter);
app.use("/api/admin", adminRouter);
app.use("/api/providers", providersRouter);
app.use("/api/public", publicRouter);
app.use("/api/realtime", realtimeRouter);
app.use("/api/referrals", referralsRouter);
app.use("/api/catalog", catalogRouter);
app.use("/api/manual-providers", manualProvidersRouter);
app.use("/api/telegram", telegramWebhookRouter);

app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error(err);
  res.status(500).json({ error: err.message || "Internal server error" });
});

const port = Number(process.env.PORT) || 8787;
app.listen(port, () => {
  console.log(`[backend] listening on http://localhost:${port}`);
});

// Best-effort, non-blocking: the server should keep serving requests even
// if Mongo is briefly unreachable at boot — both of these retry naturally
// on their own schedule (ensureIndexes on the next deploy, auto-sync on
// its next interval tick) rather than needing to succeed at startup.
getDb()
  .then((db) => ensureIndexes(db))
  .then(() => console.log("[backend] indexes ensured"))
  .catch((err) => console.error("[backend] ensureIndexes failed (non-fatal):", err instanceof Error ? err.message : err));

// Keeps provider connection status and the countries/services catalog
// live automatically — see lib/providers/autoSync.ts for what this does
// and why. No external cron, no Render Shell, no manual "Sync" clicks
// needed for this to stay fresh.
startProviderAutoSync();

// Auto-refunds a Manual Provider request if the seller never starts it
// within settings.assignExpiryMinutes — otherwise a buyer's money could
// sit stuck forever against an unresponsive/offline seller with no way
// out. Checked every minute; each run only touches requests actually past
// their deadline.
setInterval(() => {
  autoExpireStaleRequests().catch((err) => console.error("[autoExpireStaleRequests] sweep failed:", err instanceof Error ? err.message : err));
}, 60_000);
