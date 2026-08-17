# TenOTP

Virtual numbers & OTP delivery platform — split into two independent services:

- **[`backend/`](backend/)** — Express + TypeScript REST API, MongoDB, JWT auth, payments, realtime (SSE). No bundler — runs directly via `node --experimental-strip-types`.
- **[`frontend/`](frontend/)** — Vite + React SPA (`@tanstack/react-router`, code-based routing). Talks to the backend only through `frontend/src/lib/apiClient.ts`.

They deploy separately (**backend → Render**, **frontend → Vercel**) and run separately in local dev (two terminals, two `npm run dev`s — see below).

> **Verified working end-to-end** (real `npm run dev` backend, real MongoDB, no mocks): signup →
> promote to admin → login (JWT reflects the new role) → `GET /api/admin/users` → add a BharatPe
> merchant via `POST /api/payments/merchant/upsert` → merchant is saved, encrypted, listed, and the
> backend automatically reached BharatPe's real transaction endpoint and got a real
> "access token rejected" response (proof the endpoint fix is live and reachable, not just
> compiling). Paste real BharatPe credentials in the admin panel and this flips to "connected"
> with no code changes needed.

---

## 1. Local setup

Two services, two terminals. Both need Node.js **22.6+**.

> **Always `cd` into `backend/` or `frontend/` first.** There is no more
> root-level `package.json`/`npm run dev` — the old single-app monolith was
> removed once the split was verified working. Running `npm run dev` from
> the repo root will fail with "no such file" (or, if your terminal still
> has old scrollback in it, show an unrelated leftover error from before the
> cleanup) — either way it means you're in the wrong directory, not that
> anything is broken.

```bash
# Terminal 1 — backend
cd backend
npm install
cp .env.example .env      # fill in MONGODB_URI, AUTH_JWT_SECRET, etc. — see section 2
npm run db:indexes        # one-time: creates MongoDB indexes/unique constraints
npm run dev                # → http://localhost:8787
```

```bash
# Terminal 2 — frontend
cd frontend
npm install
cp .env.example .env      # VITE_API_URL=http://localhost:8787 (default is already correct for local dev)
npm run dev                # → http://localhost:5173
```

Open `http://localhost:5173` — it calls the backend at `http://localhost:8787` for everything.

### Windows note: native-binary bundler blocks (already solved, no action needed)

Some Windows security policies (WDAC/Application Control, common on managed/work laptops) block native `.node` files under `node_modules` outright — this breaks Vite's default toolchain, since Rollup, esbuild, and Tailwind v4's CSS engine (`@tailwindcss/oxide`) each ship a native binary for speed. Rather than requiring WSL2, this repo works around it entirely in-project:

- `frontend/package.json` — `overrides` swaps Rollup and esbuild for their official pure-WASM builds (`@rollup/wasm-node`, `esbuild-wasm`).
- `frontend/.npmrc` — `force=true`, needed because `@tailwindcss/oxide-wasm32-wasi` (Tailwind's WASM fallback binding) declares a `wasm32` platform that doesn't match your real CPU architecture; npm would otherwise refuse to install a package that's never meant to natively match your machine.
- `frontend/package.json`'s `dev`/`build`/`preview` scripts set `NAPI_RS_FORCE_WASI=true` (via `cross-env`, so it works on any OS) — this tells the native-binary loader used by Rollup/esbuild's transitive deps and Tailwind's oxide engine to load their WASM builds instead of the native ones.

None of this is Windows-specific in effect — `npm install && npm run dev` behaves identically on macOS/Linux (WASM there is simply unused, since the native binaries load fine and nothing forces the fallback... except the `NAPI_RS_FORCE_WASI=true` in the scripts always forces WASM everywhere, trading a bit of build speed for one working setup on every OS). If you ever want native speed back on a machine without this restriction, drop `NAPI_RS_FORCE_WASI=true` from the three scripts and remove the `overrides` block.

---

## 2. Environment variables

### `backend/.env` (see `backend/.env.example`)

| Variable | Required | Notes |
| --- | --- | --- |
| `PORT` | — | Defaults to `8787`. |
| `APP_URL` | ✅ | Public frontend URL, used in password-reset links. |
| `FRONTEND_ORIGIN` | ✅ | CORS allowlist — the frontend origin(s) allowed to call this API. Comma-separated for multiple (e.g. local + deployed): `http://localhost:5173,https://tenotp.vercel.app`. |
| `MONGODB_URI` | ✅ | Connection string to a **replica-set** MongoDB cluster (the wallet/order engine uses multi-document transactions, realtime uses change streams — neither works on a plain standalone `mongod`). A free [MongoDB Atlas](https://www.mongodb.com/atlas) cluster already is a replica set. |
| `MONGODB_DB_NAME` | ✅ | Defaults to `tenotp`. |
| `AUTH_JWT_SECRET` | ✅ | Signs session JWTs returned to the frontend. Generate with `node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"`. |
| `PAYMENT_PROVIDER` | ✅ | Legacy default-provider hint (`bharatpe`). |
| `PAYMENT_ENCRYPTION_KEY` | ✅ | Encrypts every stored payment-gateway credential at rest. Generate the same way as `AUTH_JWT_SECRET`. |
| `CRON_SECRET` | for scheduled sync | Required header (`x-cron-secret`) for `/api/public/sync-*` — see section 6. |
| `GRIZZLYSMS_API_KEY` / `TIGERSMS_API_KEY` / `SMSBOWER_API_KEY` / `SASTASMS_API_KEY` / `FIVESIM_API_KEY` | for live OTP numbers | Only the ones you've enabled in the admin panel need real values. |
| `RAZORPAY_KEY_ID` / `RAZORPAY_KEY_SECRET` | optional | Env fallback — the admin panel can set these instead. |

### `frontend/.env` (see `frontend/.env.example`)

| Variable | Notes |
| --- | --- |
| `VITE_API_URL` | Base URL of the backend. `http://localhost:8787` locally, your Render URL in production. |

Run `npm run db:indexes` (inside `backend/`) once against a fresh database — it creates every unique constraint the schema needs (unique emails, referral codes, coupon codes, one-redemption-per-user, deposit UTR dedupe, etc.).

---

## 3. Creating the first admin

No signup checkbox makes you an admin (that would be a security hole). To create your first one:

1. Sign up a normal account through the frontend.
2. Connect to MongoDB (Atlas web UI, `mongosh`, or Compass) and run against the `users` collection:
   ```js
   db.users.updateOne(
     { emailLower: "you@example.com" },
     { $addToSet: { roles: "admin" } }
   )
   ```
3. Log out and back in (the JWT caches your roles at login time — you need a fresh token). The admin panel is at `/gourav-ankit-adi` on the frontend (intentionally not `/admin`).
4. Every admin after the first can be promoted from inside the Admins page — no more manual DB edits.

---

## 4. Adding payment gateway API keys (admin panel only)

None of the payment gateway credentials go in `.env`. They're entered in the admin panel (**Settings → Payments**, and the **Merchants** page), encrypted with `PAYMENT_ENCRYPTION_KEY`, and stored in MongoDB — so you can add/rotate credentials without redeploying.

- **Manual UPI** — no setup, just your UPI ID + payee name; user pastes UTR, admin approves from Deposits.
- **BharatPe (auto-credit)** — paste Merchant ID + dashboard token. The transaction-verification endpoint, date-range query, and UTR/amount matching all default automatically.
- **Razorpay (auto-credit)** — paste Key ID + Key Secret. Signature verified server-side on payment success, wallet auto-credits.
- **Paytm Business (auto-credit)** — UPI mode (just a merchant UPI ID + SMS-forwarder webhook) or Gateway mode (full API via MID + Merchant Key).

Every panel has a "Save & test" button to confirm credentials work before going live. All of Settings → Payments (Razorpay/Paytm/BharatPe/manual UPI) and the Merchants page are fully ported to the split frontend.

---

## 5. Adding SMS provider API keys

1. Get an API key from whichever SMS-activation provider(s) you use, set it in `backend/.env` (local) or the Render dashboard (production): `GRIZZLYSMS_API_KEY`, `TIGERSMS_API_KEY`, `SMSBOWER_API_KEY`, `SASTASMS_API_KEY`, `FIVESIM_API_KEY`.
2. In the admin panel's **Providers** page, connect/enable each server, set markup %, and check health/latency.
3. **Catalog sync** — schedule an external trigger (cron) to POST to `/api/public/sync-all` (every ~2 min) and `/api/public/sync-grizzly` (every ~6 hrs) with header `x-cron-secret: <CRON_SECRET>`. Render Cron Jobs, GitHub Actions `schedule:`, or cron-job.org all work.

---

## 6. Pushing to GitHub

**Step 1 — create the (empty) repo on GitHub.**
Go to [github.com/new](https://github.com/new), pick a name (e.g. `tenotp`), leave it **empty** (no README/`.gitignore`/license — this repo already has its own), and click **Create repository**. Copy the URL it gives you, e.g. `https://github.com/<your-username>/tenotp.git`.

*(Or, if you have the [`gh` CLI](https://cli.github.com/) installed and logged in: `gh repo create tenotp --private --source=. --remote=origin` does the same thing from your terminal and sets the remote for you — skip to Step 3 if you use this.)*

**Step 2 — point this folder at it and push.** Run from the repo root (`d:\Porsnoal project\ten otp letest` locally):

```bash
git init
git add .
git commit -m "Initial commit"
git branch -M main
git remote add origin https://github.com/<your-username>/<your-repo>.git
git push -u origin main
```

**Step 3 — double-check secrets didn't get committed.** Run `git status` right before the push — it must **not** list `backend/.env` or `frontend/.env` (both are git-ignored; only the `.env.example` templates are tracked, which have no real values). If a real secret ever gets committed by accident, rotate it immediately (generate a new `AUTH_JWT_SECRET`/`PAYMENT_ENCRYPTION_KEY`, rotate your Mongo password, etc.) — deleting it in a later commit does not erase it from git history.

From here on, every `git push` to `main` is what Render and Vercel will auto-redeploy from (both connect straight to the GitHub repo).

---

## 7. Deploying

Order matters a little: deploy the **backend first** (Vercel will ask for its URL), then the **frontend**, then go back and tell the backend the frontend's URL (CORS needs both sides to know about each other). Total time: ~10–15 minutes.

### 7a. Backend → Render

1. Sign in at [render.com](https://render.com) (GitHub login is easiest — it also grants repo access for the next step).
2. Dashboard → **New +** (top right) → **Blueprint**.
3. **Connect a repository** → pick the GitHub repo you just pushed. Render reads [`backend/render.yaml`](backend/render.yaml) automatically (it's a Blueprint file — Render finds it itself) and shows a preview of one service: `tenotp-backend`.
4. Click **Apply** / **Create New Resources**. Render will then prompt you for the env vars marked `sync: false` in the blueprint — fill these in before or right after the first deploy (**Environment** tab on the service page):
   | Variable | What to put |
   | --- | --- |
   | `APP_URL` | Leave a placeholder for now (e.g. `https://example.com`) — you'll update it in step 7c once Vercel gives you the real frontend URL. |
   | `FRONTEND_ORIGIN` | Same — placeholder for now, update in 7c. |
   | `MONGODB_URI` | Your MongoDB Atlas connection string (`mongodb+srv://...`) — same one from `backend/.env` locally. |
   | `MONGODB_DB_NAME` | Your database name (e.g. `Tenotp`) — the blueprint defaults to `tenotp`, override it if yours is spelled differently. |
   | `GRIZZLYSMS_API_KEY` / `TIGERSMS_API_KEY` / `SMSBOWER_API_KEY` / `SASTASMS_API_KEY` / `FIVESIM_API_KEY` | Only the ones you're actually using — can leave blank and add later from the Providers admin page/here, no redeploy needed for these five since the admin panel also supports storing them, but Render env vars are the primary source. |
   | `RAZORPAY_KEY_ID` / `RAZORPAY_KEY_SECRET` | Optional — can also be set from the admin Settings page instead. |

   `AUTH_JWT_SECRET`, `PAYMENT_ENCRYPTION_KEY`, and `CRON_SECRET` are set to `generateValue: true` in the blueprint — Render creates strong random values for these automatically, you don't need to type anything.
5. Wait for the first deploy to finish (Render shows live build logs). When it's green/"Live", copy the service URL from the top of the page — looks like `https://tenotp-backend.onrender.com`. **Save this URL, you need it for the frontend step next.**
6. Sanity check it's actually up: open `https://tenotp-backend.onrender.com/health` in a browser — it should show `{"ok":true}`.
7. **One-time setup** (Render dashboard → your service → **Shell** tab, or run locally with `MONGODB_URI` pointed at production):
   ```bash
   npm run db:indexes
   ```
   This creates the unique constraints (unique emails, referral codes, etc.) production needs — same as the local setup in section 2.
8. Create your first admin — same steps as section 3 above, just against the production database this time.

> This is a plain Node process — no native-binary/bundler issues on Render's Linux build (that Windows-only workaround in this README doesn't apply there).

### 7b. Frontend → Vercel

1. Sign in at [vercel.com](https://vercel.com) (GitHub login again).
2. Dashboard → **Add New...** → **Project** → import the same GitHub repo.
3. Vercel auto-detects it's a monorepo — before clicking Deploy, expand **"Root Directory"** and set it to `frontend` (this is the one setting that must not be skipped, or the build looks for `package.json` in the wrong place and fails).
4. Framework preset should auto-detect as **Vite** — leave build/output settings as-is ([`frontend/vercel.json`](frontend/vercel.json) already configures everything else, including the SPA rewrite `/* → /index.html` that client-side routing needs).
5. Before clicking **Deploy**, add one environment variable (**Environment Variables** section on the same import screen, or **Project Settings → Environment Variables** after):
   | Variable | Value |
   | --- | --- |
   | `VITE_API_URL` | The Render backend URL from step 7a.5, e.g. `https://tenotp-backend.onrender.com` (no trailing slash) |
6. Click **Deploy**. When it finishes, Vercel gives you a URL like `https://tenotp.vercel.app` (or `https://<project>-<hash>.vercel.app` — the plain `.vercel.app` one without a hash is the stable one to use going forward). **Save this URL too.**

### 7c. Connect them — the step people forget

Go back to **Render → your backend service → Environment**, and update the two placeholders from step 7a.4:

| Variable | Set to |
| --- | --- |
| `APP_URL` | Your Vercel URL, e.g. `https://tenotp.vercel.app` (used in password-reset email links) |
| `FRONTEND_ORIGIN` | Same Vercel URL — this is the CORS allowlist; without it, the deployed frontend's API calls get blocked by the browser |

Saving these triggers an automatic redeploy on Render (~1–2 min). Once it's back up, open your Vercel URL in a browser and confirm signup/login works end-to-end — that round-trip (frontend → Render API → MongoDB Atlas → back) is the real test that both sides are correctly wired together.

### 7d. After that — set up the catalog sync cron (see section 5)

The SMS number/service catalog doesn't update itself — schedule something to `POST` to `/api/public/sync-all` (every ~2 min) and `/api/public/sync-grizzly` (every ~6 hrs) against your Render URL, with header `x-cron-secret: <the value Render generated for CRON_SECRET>`. Render's own **Cron Jobs** feature, a GitHub Actions `schedule:` workflow, or a free service like cron-job.org all work — see section 5 above for details.

Realtime (the "OTP received" popup) needs MongoDB change streams held open over SSE, which needs the backend's persistent process — this works regardless of where the frontend is hosted, since the SSE connection goes straight from the browser to the Render backend, bypassing Vercel entirely.

### Redeploying later

Both platforms auto-redeploy on every `git push` to `main` — that's the whole workflow after this first setup. No manual redeploy step needed unless you want to roll back to a previous deploy (both dashboards support that with one click).

---

## Repo structure

```
backend/     Express API — see backend/src/routes/*.ts (one file per feature area)
frontend/    Vite React SPA — see frontend/src/routeGroups/*.tsx (route wiring) and
             frontend/src/routes/**/*.tsx (page components)
```

## Known gaps

- **Password reset email delivery** has no provider wired up — the backend only `console.warn`'s the reset link (`backend/src/lib/email.ts`). Wire up Resend/SES/etc. before relying on self-service resets.
- **OAuth sign-in** (Google/Apple/Microsoft) was dropped in the split — only email/password auth was ported. Re-adding it means wiring an OAuth flow against the backend's JWT issuance.
- **No automated test suite** — verify changes by running the flows manually: sign up → buy a number → wallet debit/credit → admin actions → deposit auto-credit.
- No cryptocurrency payment gateway (never existed — `backend/src/lib/payments/crypto.server.ts` is an encryption helper, not a payment adapter).
- `sitemap.xml` generation was dropped (needs a build-time step for a pure SPA, out of scope here).
