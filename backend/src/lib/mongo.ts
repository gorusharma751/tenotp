// Server-side MongoDB client — singleton connection per process.
import { MongoClient, type Db, type Document } from "mongodb";
import dns from "node:dns";

// `mongodb+srv://` needs a DNS SRV lookup, which Node's own resolver can fail
// even when the OS resolver works fine (seen on some Windows networks).
// Appending public resolvers as a fallback fixes it without overriding
// whatever DNS setup already works.
try {
  const current = dns.getServers();
  const fallback = ["8.8.8.8", "1.1.1.1"];
  dns.setServers([...current, ...fallback.filter((s) => !current.includes(s))]);
} catch {
  /* best-effort */
}

let _client: MongoClient | undefined;
let _connectPromise: Promise<MongoClient> | undefined;
let _dbName: string | undefined;

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    const message = `Missing environment variable: ${name}. Set it in .env (see .env.example).`;
    console.error(`[Mongo] ${message}`);
    throw new Error(message);
  }
  return value;
}

async function connect(): Promise<MongoClient> {
  const uri = requireEnv("MONGODB_URI");
  _dbName = process.env.MONGODB_DB_NAME || "tenotp";
  const client = new MongoClient(uri, {
    maxPoolSize: 20,
    serverSelectionTimeoutMS: 10_000,
  });
  await client.connect();
  _client = client;
  return client;
}

export async function getMongoClient(): Promise<MongoClient> {
  if (_client) return _client;
  if (!_connectPromise) _connectPromise = connect();
  return _connectPromise;
}

export async function getDb(): Promise<Db> {
  const client = await getMongoClient();
  return client.db(_dbName);
}

export async function getCollection<T extends Document = Document>(name: string) {
  const db = await getDb();
  return db.collection<T>(name);
}

export type { Document };
