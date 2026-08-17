import { Router } from "express";
import { verifySessionToken } from "../lib/auth/jwt.ts";
import { getDb } from "../lib/mongo.ts";

export const realtimeRouter = Router();

// Server-Sent Events relay for live "OTP received" + notification updates,
// backed by MongoDB change streams (needs a persistent Node process and a
// replica-set cluster — Atlas gives you one by default — not a serverless
// function host).
//
// Browsers' native EventSource cannot set custom headers, so unlike the rest
// of this backend (Authorization: Bearer <token>), the session token is
// passed as a query parameter: GET /api/realtime/otp?token=<jwt>.
realtimeRouter.get("/otp", async (req, res) => {
  const token = String(req.query.token ?? "");
  const claims = token ? verifySessionToken(token) : null;
  if (!claims) return res.status(401).json({ error: "Unauthorized" });
  const userId = claims.sub;

  const db = await getDb();

  res.writeHead(200, {
    "content-type": "text/event-stream",
    "cache-control": "no-cache, no-transform",
    connection: "keep-alive",
  });

  let closed = false;
  const send = (event: string, data: unknown) => {
    if (closed) return;
    try {
      res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
    } catch {
      /* connection already gone */
    }
  };

  // Orders: fire when an order's `otp` field is populated, or its status changes.
  const ordersStream = db.collection("orders").watch(
    [
      {
        $match: {
          operationType: "update",
          "fullDocument.userId": userId,
          $or: [
            { "updateDescription.updatedFields.otp": { $exists: true } },
            { "updateDescription.updatedFields.status": { $exists: true } },
          ],
        },
      },
    ],
    { fullDocument: "updateLookup" },
  );
  ordersStream.on("change", (change: { fullDocument?: Record<string, unknown> }) => {
    const doc = change.fullDocument;
    if (!doc) return;
    if (doc.otp) {
      send("otp", {
        orderId: doc._id,
        service: doc.serviceName ?? "OTP",
        number: doc.number ?? "",
        otp: String(doc.otp),
      });
    } else if (doc.status) {
      send("order_status", { orderId: doc._id, status: doc.status });
    }
  });
  ordersStream.on("error", () => {
    /* connection will retry client-side */
  });

  // Notifications: fire on insert for this user.
  const notifStream = db
    .collection("notifications")
    .watch([{ $match: { operationType: "insert", "fullDocument.userId": userId } }], {
      fullDocument: "updateLookup",
    });
  notifStream.on("change", (change: { fullDocument?: Record<string, unknown> }) => {
    const doc = change.fullDocument;
    if (!doc) return;
    send("notification", { title: doc.title ?? "Notification", body: doc.body ?? "" });
  });
  notifStream.on("error", () => {
    /* connection will retry client-side */
  });

  // Keep intermediary proxies from timing out an idle connection.
  const heartbeat = setInterval(() => send("ping", { t: Date.now() }), 25_000);

  const cleanup = () => {
    if (closed) return;
    closed = true;
    clearInterval(heartbeat);
    try {
      ordersStream.close();
    } catch {
      /* ignore */
    }
    try {
      notifStream.close();
    } catch {
      /* ignore */
    }
  };

  req.on("close", cleanup);
});
