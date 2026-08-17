import { useState } from "react";
import { PageHeader } from "@/components/common/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { api } from "@/lib/apiClient";
import { useUserStore } from "@/store/userStore";
import { CheckCircle2, XCircle, Loader2, PlayCircle } from "lucide-react";

// ---------------------------------------------------------------------
// NOTE — best-effort adaptation, not a real port.
//
// The monolith version of this page called two Mongo-only createServerFns
// with no REST equivalent:
//   - countCollectionFn(table)   → arbitrary collection.countDocuments()
//   - whoAmIFn()                 → { email, roles } from the session context
// Neither exists on the Express backend (no generic "count any collection"
// endpoint, and no /whoami route — see backend/src/routes/admin.ts and
// backend/src/routes/providers.ts). This version substitutes:
//   - "Tables" checks now hit real GET endpoints that already return full
//     collections (users/orders/services/... /providers/tickets/reseller-panels)
//     and reports array length as a stand-in row count.
//   - "session + admin role" now reads useUserStore.getState().admin
//     client-side instead of an API round-trip.
// Any collection with no listing endpoint (provider_services, deposits,
// wallet_tx, sync_logs, app_settings) was dropped from the Tables group
// rather than invented.
// ---------------------------------------------------------------------

type Result = {
  name: string;
  group: string;
  status: "pending" | "running" | "pass" | "fail";
  detail?: string;
  ms?: number;
};

type Check = { name: string; group: string; run: () => Promise<string> };

const countOf = (path: string, label: string) => async () => {
  const rows = await api.get<unknown[]>(path);
  return `${rows.length} ${label}`;
};

const CHECKS: Check[] = [
  // Reads via real /api/admin/* endpoints
  { name: "GET /api/admin/users", group: "Reads", run: countOf("/api/admin/users", "users") },
  { name: "GET /api/admin/orders", group: "Reads", run: countOf("/api/admin/orders", "orders") },
  { name: "GET /api/admin/services", group: "Reads", run: countOf("/api/admin/services", "services") },
  { name: "GET /api/admin/countries", group: "Reads", run: countOf("/api/admin/countries", "countries") },
  { name: "GET /api/admin/numbers", group: "Reads", run: countOf("/api/admin/numbers", "numbers") },
  { name: "GET /api/admin/wallets", group: "Reads", run: countOf("/api/admin/wallets", "wallets") },
  { name: "GET /api/admin/payments", group: "Reads", run: countOf("/api/admin/payments", "payments") },
  { name: "GET /api/admin/refunds", group: "Reads", run: countOf("/api/admin/refunds", "refunds") },
  { name: "GET /api/admin/coupons", group: "Reads", run: countOf("/api/admin/coupons", "coupons") },
  { name: "GET /api/admin/promotions", group: "Reads", run: countOf("/api/admin/promotions", "promotions") },
  { name: "GET /api/admin/audit", group: "Reads", run: countOf("/api/admin/audit", "events") },
  { name: "GET /api/admin/media", group: "Reads", run: countOf("/api/admin/media", "assets") },
  { name: "GET /api/admin/notifications", group: "Reads", run: countOf("/api/admin/notifications", "notifs") },
  {
    name: "GET /api/admin/analytics",
    group: "Reads",
    run: async () => {
      const a = await api.get<{ kpi: { totalUsers: number } }>("/api/admin/analytics");
      return `KPIs loaded (${a.kpi.totalUsers} users)`;
    },
  },

  // Collection-ish reads — substituted with real listing endpoints that
  // happen to return the full collection (see note above).
  { name: "collection: providers", group: "Tables", run: countOf("/api/providers", "rows") },
  { name: "collection: tickets", group: "Tables", run: countOf("/api/admin/tickets", "rows") },
  { name: "collection: reseller_panels", group: "Tables", run: countOf("/api/admin/reseller-panels", "rows") },
  { name: "collection: users (roles)", group: "Tables", run: countOf("/api/admin/users", "rows") },

  // Writes — Promotions full CRUD via real endpoints
  {
    name: "Promotions CRUD (create → update → delete)",
    group: "Writes",
    run: async () => {
      const created = await api.post<{ id: string }>("/api/admin/promotions", {
        title: `smoke ${Date.now()}`,
        kind: "banner",
        status: "draft",
      });
      await api.patch(`/api/admin/promotions/${created.id}`, { status: "live", description: "smoke ok" });
      await api.del(`/api/admin/promotions/${created.id}`);
      return "create + update + delete ok";
    },
  },

  // Auth / role verification — client-side, from the session already
  // loaded into the store (no whoami endpoint on the backend).
  {
    name: "session + admin role",
    group: "Auth",
    run: async () => {
      const me = useUserStore.getState().admin;
      if (!me) throw new Error("not signed in as admin");
      if (me.role !== "admin") throw new Error("not admin");
      return `authenticated as admin (${me.email})`;
    },
  },
];

export default function AdminSmokeTest() {
  const [results, setResults] = useState<Result[]>(
    CHECKS.map((c) => ({ name: c.name, group: c.group, status: "pending" })),
  );
  const [running, setRunning] = useState(false);

  const runAll = async () => {
    setRunning(true);
    setResults(CHECKS.map((c) => ({ name: c.name, group: c.group, status: "pending" })));
    for (let i = 0; i < CHECKS.length; i++) {
      setResults((prev) => prev.map((r, idx) => (idx === i ? { ...r, status: "running" } : r)));
      const start = performance.now();
      try {
        const detail = await CHECKS[i].run();
        setResults((prev) =>
          prev.map((r, idx) =>
            idx === i
              ? { ...r, status: "pass", detail, ms: Math.round(performance.now() - start) }
              : r,
          ),
        );
      } catch (e: unknown) {
        setResults((prev) =>
          prev.map((r, idx) =>
            idx === i
              ? {
                  ...r,
                  status: "fail",
                  detail: e instanceof Error ? e.message : String(e),
                  ms: Math.round(performance.now() - start),
                }
              : r,
          ),
        );
      }
    }
    setRunning(false);
  };

  const groups = Array.from(new Set(CHECKS.map((c) => c.group)));
  const pass = results.filter((r) => r.status === "pass").length;
  const fail = results.filter((r) => r.status === "fail").length;

  return (
    <div>
      <PageHeader
        title="Admin Smoke Test"
        description="Runs live reads and a full Promotions CRUD write to verify every admin module talks to the database."
        actions={
          <Button className="gradient-brand" onClick={runAll} disabled={running}>
            {running ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <PlayCircle className="mr-2 h-4 w-4" />
            )}
            {running ? "Running..." : "Run all checks"}
          </Button>
        }
      />
      <div className="mb-4 flex gap-2">
        <Badge variant="secondary">Total: {CHECKS.length}</Badge>
        <Badge className="bg-success text-success-foreground">Pass: {pass}</Badge>
        <Badge variant={fail > 0 ? "destructive" : "secondary"}>Fail: {fail}</Badge>
      </div>
      <div className="grid gap-4">
        {groups.map((g) => (
          <Card key={g} className="shadow-soft">
            <CardHeader>
              <CardTitle className="text-base">{g}</CardTitle>
            </CardHeader>
            <CardContent className="divide-y">
              {results
                .filter((r) => r.group === g)
                .map((r) => (
                  <div
                    key={r.name}
                    className="flex items-center justify-between gap-3 py-2 text-sm"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      {r.status === "pass" && (
                        <CheckCircle2 className="h-4 w-4 text-success shrink-0" />
                      )}
                      {r.status === "fail" && (
                        <XCircle className="h-4 w-4 text-destructive shrink-0" />
                      )}
                      {r.status === "running" && (
                        <Loader2 className="h-4 w-4 animate-spin shrink-0" />
                      )}
                      {r.status === "pending" && (
                        <div className="h-2 w-2 rounded-full bg-muted-foreground/40 shrink-0" />
                      )}
                      <span className="font-medium truncate">{r.name}</span>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {r.ms != null && (
                        <span className="text-xs text-muted-foreground tabular-nums">{r.ms}ms</span>
                      )}
                      <span
                        className={`text-xs truncate max-w-[16rem] ${r.status === "fail" ? "text-destructive" : "text-muted-foreground"}`}
                      >
                        {r.detail}
                      </span>
                    </div>
                  </div>
                ))}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
