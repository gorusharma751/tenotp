// Standalone CLI wrapper — the real index list now lives in
// src/lib/ensureIndexes.ts, which also runs automatically on every server
// boot (see src/index.ts). This script is kept for local/manual use.
//
// Run with:  npm run db:indexes
import { MongoClient } from "mongodb";
import dns from "node:dns";
import { ensureIndexes } from "../src/lib/ensureIndexes.ts";

// `mongodb+srv://` needs a DNS SRV lookup, which Node's own resolver can fail
// even when the OS resolver works fine (seen on some Windows networks).
try {
  const current = dns.getServers();
  const fallback = ["8.8.8.8", "1.1.1.1"];
  dns.setServers([...current, ...fallback.filter((s) => !current.includes(s))]);
} catch {
  /* best-effort */
}

async function main() {
  const uri = process.env.MONGODB_URI;
  if (!uri) throw new Error("Missing MONGODB_URI");
  const dbName = process.env.MONGODB_DB_NAME || "tenotp";
  const client = new MongoClient(uri);
  await client.connect();
  await ensureIndexes(client.db(dbName));
  console.log("[ensure-indexes] done.");
  await client.close();
}

main().catch((err) => {
  console.error("[ensure-indexes] failed:", err);
  process.exitCode = 1;
});
