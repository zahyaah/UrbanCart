# Urban Cart

A full-stack e-commerce app: React/Redux frontend, a Fastify/Postgres backend
with real authentication, a server-side cart, and a demo checkout. Browse
products, manage a cart (merged automatically on login), place an order, and
"pay" with a demo button — no real payment is taken and no card details are
collected.

**Live:** not yet deployed — see [Deployment](#deployment) to stand up the
backend on Render; the frontend's hosting target is a separate decision not
made yet.

## Stack

**Frontend:** React 18 + Vite 5 + TypeScript, Redux Toolkit (RTK Query for
every API slice), React Router v6, Tailwind CSS v4 + shadcn/ui, Framer
Motion. Vitest + React Testing Library, Playwright.

**Backend** (`server/`): Fastify v5 + TypeScript, Postgres via Drizzle ORM,
Redis (catalog cache + shared rate-limit store), Sentry (error reporting),
pino structured logging. Vitest against
a real Postgres/Redis instance, not mocks.

**Infra:** Docker Compose (full local stack — Postgres, Redis, backend,
frontend), a Render Blueprint (`render.yaml`) for the deployed backend, k6
for load testing.

## Architecture

```
 Browser
   │
   ├── React SPA (nginx in prod, Vite dev server locally)
   │     RTK Query ──────────────┐
   │                             ▼
   └── Fastify API (server/) ────┤
         │          │            │
         ▼          ▼            ▼
      Postgres    Redis       Sentry
   (Drizzle ORM) (cache +   (error reporting)
                 rate limit
                    store)
```

The frontend never talks to Postgres, Redis, or Sentry directly —
everything goes through the Fastify API, which is the only thing that holds
credentials for any of them. Auth is httpOnly-cookie session tokens (not
localStorage) with a double-submit CSRF token; see
[`server/spec/`](server/spec/) for the full per-module design docs and
[`docs/decisions/`](docs/decisions/) for the architectural decisions with
their reasoning.

## Running locally

### Option A: Docker Compose (full stack, closest to production)

```bash
docker compose up --build
# first run only. The seed script refuses NODE_ENV=production (it wipes the
# catalog), and the compose backend runs with NODE_ENV=production for
# image parity, so override it for this one command:
docker compose exec -e NODE_ENV=development backend node dist/db/seed.js
```

Frontend at `http://localhost:8080`, backend at `http://localhost:3001`.

### Option B: Run frontend and backend directly (faster iteration)

```bash
# Postgres + Redis only, via the same compose file
docker compose up -d postgres redis

cd server
cp .env.example .env   # fill in a real JWT_ACCESS_SECRET; Redis/Sentry optional
npm install
npm run db:migrate
npm run db:seed
npm run dev             # http://localhost:3001

# separate terminal, from the repo root
cp .env.example .env    # VITE_API_URL=http://localhost:3001
npm install
npm run dev              # http://localhost:5173
```

## Commands

**Frontend** (repo root):

| Command | Description |
|---|---|
| `npm run dev` | Development server |
| `npm run build` | Production build |
| `npm run lint` | ESLint |
| `npm test` | Unit tests (Vitest) |
| `npm run coverage` | Unit tests with a coverage report |
| `npm run test:e2e` | Playwright suite against a real backend — see [Testing](#testing) |
| `npm run typecheck` | TypeScript, no emit |

**Backend** (`server/`):

| Command | Description |
|---|---|
| `npm run dev` | Development server with reload |
| `npm run build` / `npm start` | Compile to `dist/`, then run it |
| `npm run lint` / `npm run typecheck` | ESLint / TypeScript |
| `npm test` | Vitest against a real Postgres + Redis |
| `npm run db:migrate` | Apply Drizzle migrations |
| `npm run db:seed` | Seed 20 catalog products |

## Features

- **Real accounts.** Email/password auth, httpOnly access + refresh token
  cookies, refresh-token rotation with theft detection (see
  [`server/spec/SPEC-identity.md`](server/spec/SPEC-identity.md)).
- **Server-side cart with guest merge.** Add to cart while logged out; log in
  and it merges into your account's server cart automatically, quantity-capped
  and race-condition-safe (`REPEATABLE READ` + serialization retry).
- **Demo checkout.** Idempotency-key-protected order creation (a
  double-submitted "Place Order" click creates exactly one order), totals
  computed server-side from current DB prices, and a demo pay step
  (`POST /orders/:id/pay`) that moves the caller's own pending order to paid.
  No payment provider, no card fields, no money moves.
- **Shipping address**, collected and persisted on the order at purchase
  time.
- **Redis-cached catalog**, cache-aside with a short TTL — see
  [ADR-0006](docs/decisions/0006-catalog-cache-ttl-only-no-invalidation.md).
- **Code-split frontend bundle** — the checkout wizard and auth pages load
  on demand, not on first paint. See [Performance](#performance).
- **Light and dark themes**, toggled from the nav bar, persisted to
  `localStorage`.
- **Responsive layout**, 44px minimum touch targets, tested at 375/768/1280px.

## Testing

**Backend** (`server/`, 90 tests): integration tests run against a real
Postgres (`urbancart_test`) and Redis instance, not mocks or an in-memory
substitute — `.inject()`'d through the actual Fastify app, including the
error-handling middleware, idempotency-key claim/replay logic, and the
cache-aside catalog layer.

**Frontend** (56 tests): cart reducers and selectors, form validation, the
pricing math, `localStorage` cart-state validation, and component tests for
`OrderSummary`, `CartItem`, and the checkout address step.

**Playwright e2e suite** (cart, catalog, checkout; desktop Chrome and
Pixel 5) runs against a real backend. `playwright.config.js` migrates the
database at `E2E_DATABASE_URL`, resets it and the Redis database at
`E2E_REDIS_URL` (`server/src/db/reset-e2e.ts`, which only touches a local
database named `*_e2e`), seeds the catalog, starts the API, and serves the
production build with `VITE_API_URL=/api` proxied to it — the same `/api`
topology as the Vercel deployment. Checkout tests register a throwaway
account through the API per test; no credentials are stored anywhere.

Defaults match docker-compose's Postgres and Redis; create the e2e database
once:

```bash
docker compose up -d postgres redis
docker compose exec postgres createdb -U urbancart urbancart_e2e
npm run test:e2e
```

The backend runs with raised auth rate limits (`AUTH_RATE_LIMIT_MAX` and
friends, see `server/src/config.ts`) because every test comes from one IP;
production uses the defaults.

## Performance

The frontend bundle (`vite build`) was one ~616 KB/200 KB-gzip JS file —
every route, including Stripe's Elements SDK (only needed at `/checkout`;
the app has since dropped Stripe entirely, so these numbers predate that),
loaded eagerly. `src/App.tsx` now lazy-loads every route except the product
listing (the landing page — must stay eager so first paint isn't gated on a
chunk) behind `React.lazy`/`Suspense`.

**Bundle**, from `vite build`'s own output (deterministic, not a lab
measurement):

| | Before | After |
|---|---|---|
| Main chunk | 616.28 KB (200.10 KB gzip) | 580.71 KB (190.24 KB gzip) |
| Page-specific code | bundled into the main chunk | ~39 KB across 7 on-demand chunks (Checkout: 21.9 KB, Cart: 3.0 KB, Product: 3.2 KB, auth pages, confirmation, `OrderSummary`) |

A shopper who never reaches `/checkout` never downloads the checkout wizard.

**Core Web Vitals**, via Lighthouse (desktop, `chrome-launcher`, against a
production build served by `vite preview`; each number is the more
conservative of two repeated runs — see methodology note below):

| | Before | After |
|---|---|---|
| Performance score | 58–66 | 75 |
| Total Blocking Time | ~225 ms | ~65 ms |
| First Contentful Paint | ~2.1 s | ~2.0 s |
| Largest Contentful Paint | 2.5–4.6 s (noisy — see below) | ~2.6 s (stable) |
| Total network bytes (Lighthouse trace) | ~1130 KB | ~225 KB |

TBT is the clearest, most reproducible win — directly explained by less JS
to parse/execute before the page becomes interactive. LCP was noisy on the
*before* build across repeated runs (2.5s vs 4.6s), most likely network
variance fetching product images; it's stable *after* but not meaningfully
different, which is expected — the LCP-critical route (`Products`) was
already eager both before and after, so code-splitting other routes wasn't
expected to move it. Reported honestly rather than picking the more
flattering "before" run. Lighthouse reports Total Blocking Time as its lab
proxy for INP — real INP is a field metric requiring actual user
interactions, which a scripted run can't produce.

Reproduce: `npm run measure-cwv -- <label>` (builds, serves via `vite
preview`, runs Lighthouse, writes `scripts/cwv-<label>.json`).

## Load Testing

k6 scripts in `k6/`, run against the local stack
(`BASE_URL=http://localhost:3001 k6 run k6/catalog.js`).

**Catalog browsing** (`k6/catalog.js`) — demonstrates the Redis cache under
concurrent load:

| Profile | VUs | Result |
|---|---|---|
| In-budget (`k6 run k6/catalog.js`) | 6 | **100%** success, p95 = 8.5 ms, 9.3 req/s sustained |
| Deliberate burst (`VUS=30 k6 run k6/catalog.js`) | 30 | Rate limiter engages correctly: 62% rejected with **`429`** at p95 = 5.1 ms rejection latency — fast-fail, no cascading slowdown |

The burst run is not a failure — every VU in a local k6 run shares this
machine's one source IP, and the backend's global rate limiter (600 req/min
per IP, see [ADR-0005](docs/decisions/0005-global-rate-limit-raised-after-load-test.md))
correctly bounds it. That ADR exists *because* this exact test, at the
original 200 req/min limit, showed the limit was exhausted by a single
realistic shopper session, not just synthetic load.

**Full user journey** (`k6/journey.js`) — register → browse → add to cart →
place an order, 5 concurrent virtual users, one iteration each (not a
sustained ramp — `AUTH_RATE_LIMIT` deliberately permits only 10
register/login calls per 15 minutes per IP as brute-force protection, so a
sustained multi-user auth load from one IP would mostly measure that control
correctly refusing requests, not a realistic journey):

| Step | Result |
|---|---|
| Register | 5/5 succeeded (201) |
| Add to cart | 5/5 succeeded (200) |
| Create order | 5/5 reached the order-creation endpoint correctly (measured while orders still called Stripe; `k6/journey.js` now also exercises the demo pay step) |
| p95 request duration | 465 ms (dominated by bcrypt's deliberately-slow password hashing during register — see `security-and-hardening`'s password-hashing guidance) |

## Deployment

`render.yaml` is a [Render Blueprint](https://render.com/docs/blueprint-spec):
one file provisions the backend (Docker web service) and a Key Value (Redis)
instance. Postgres is a [Neon](https://neon.com) project (Render's free
Postgres expires after its trial), connected through two dashboard-only
variables:

- `DATABASE_URL` — Neon's **pooled** connection string (host ends in
  `-pooler`), for app traffic.
- `DATABASE_URL_UNPOOLED` — Neon's **direct** connection string, used by the
  migrations that run on every boot (`server/src/db/migrate.ts`); schema
  changes over PgBouncer's transaction pooling can fail.

Keep Neon's `?sslmode=require`: `server/src/db/connection.ts` pins it to
`verify-full`, so the certificate and hostname are always verified.

1. Push this branch to GitHub.
2. Render dashboard → **New** → **Blueprint** → select this repo.
3. Render reads `render.yaml` and prompts for the `sync: false` secrets:
   `DATABASE_URL` and `DATABASE_URL_UNPOOLED` (above),
   `JWT_ACCESS_SECRET` (32+ random characters), `SENTRY_DSN` (optional — leave blank to keep
   Sentry a no-op), `CORS_ORIGIN` and `FRONTEND_URL` (wherever the frontend
   ends up hosted).
4. Deploy. `dockerCommand` runs the DB migration before starting the server
   on every deploy (idempotent — drizzle's migrator skips already-applied
   migrations), so no separate manual migration step is needed.
5. Load the catalog **once**, from your own machine. The seed script wipes
   and reloads the products table, so it refuses any non-local database
   unless `ALLOW_REMOTE_SEED` names that exact database (`neondb` is Neon's
   default), and it always refuses `NODE_ENV=production`
   (`server/src/db/seed-guard.ts`). It also fails, harmlessly, once any cart
   or order references a product — it's for an empty database. Use the
   **direct** connection string:

   ```bash
   cd server && npm ci
   read -rs NEON_DIRECT_URL   # paste the direct (non -pooler) URL, then Enter
   DATABASE_URL="$NEON_DIRECT_URL" npx tsx src/db/migrate.ts
   DATABASE_URL="$NEON_DIRECT_URL" ALLOW_REMOTE_SEED=neondb npx tsx src/db/seed.ts
   unset NEON_DIRECT_URL
   ```

   `read -rs` keeps the password out of your shell history.

The frontend isn't part of this Blueprint — it's a static build deployed to
Vercel. It must reach the API **through its own origin**: `vercel.json`
rewrites `/api/*` to the Render backend, and the Vercel project sets
`VITE_API_URL=/api` (a *build*-time value — Vite inlines `import.meta.env.VITE_*`
into the bundle). Calling the backend's `onrender.com` URL directly instead
makes every auth cookie third-party: the frontend can't read `csrf_token`
(so every mutating request 403s), and Safari/Brave/incognito drop the
session cookies outright. `render.yaml` pairs this with
`COOKIE_SAME_SITE=lax` and `COOKIE_PATH_PREFIX=/api`; `CORS_ORIGIN` and
`FRONTEND_URL` stay set to the Vercel URL, because the CSRF check still
compares the browser's `Origin` header (forwarded by the rewrite) against it.

### Setting `TRUST_PROXY_HOPS`

`req.ip` is the rate-limit key, resolved from `X-Forwarded-For` by trusting
`TRUST_PROXY_HOPS` proxies. Too low and every user shares one proxy's
address (one shared login bucket); too high and clients can spoof theirs.
After a deploy, log in once and find the `login client address` line in the
Render logs: it shows `ip` and the raw `xForwardedFor` chain. Compare `ip`
with your own address (`curl ifconfig.me`); if it doesn't match, set
`TRUST_PROXY_HOPS` in `render.yaml` to the count at which `ip` would be your
address (each extra hop moves one entry left in the chain) and redeploy.

### Known limitation: slow first load after idle

`render.yaml` provisions both Render services (`urbancart-redis`,
`urbancart-backend`) on Render's **free** plan; Neon's free plan likewise
suspends idle compute (a first query after idle takes a few hundred ms). A free web
service spins down after 15 minutes with no inbound traffic and cold-starts
on the next request — a shopper landing on the site after a quiet period can
see a multi-second delay before the catalog loads, on that first request
only. This is a hosting-plan trade-off, not something the app can fix in
code; the options are upgrading `urbancart-backend` to a paid plan (removes
spin-down entirely), or accepting it and optionally adding an external
uptime-ping service to keep the free instance warm (burns more of the free
tier's monthly hours in exchange).

Separately — and this one *is* addressed in code — every product image is
hotlinked directly from `fakestoreapi.com` (the third-party product-data
source this demo app seeds from), not served from this app's own storage.
Without lazy-loading, the storefront grid would fire close to 20
simultaneous cross-origin image requests on first paint; `loading="lazy"`
on every below-the-fold image (product grid, cart line items) defers most
of that instead, but the app still has no control over that third-party
host's own latency or uptime.

## Architecture Decisions

Recorded in [`docs/decisions/`](docs/decisions/), each with the alternatives
considered and why they were rejected:

- [ADR-0001](docs/decisions/0001-denormalized-cart-state.md) — the client
  cart snapshots price at add-to-cart time.
- [ADR-0002](docs/decisions/0002-rtk-query-for-catalog.md) — RTK Query for
  catalog reads.
- [ADR-0003](docs/decisions/0003-local-checkout-wizard-state.md) — checkout
  wizard state lives in local `useReducer`, not Redux.
- [ADR-0004](docs/decisions/0004-server-cart-prices-are-always-live.md) — the
  server cart never snapshots price; orders do.
- [ADR-0005](docs/decisions/0005-global-rate-limit-raised-after-load-test.md)
  — the global rate limit, raised from 200 to 600 req/min/IP after the k6
  load test showed the original number was exhausted by a single shopper.
- [ADR-0006](docs/decisions/0006-catalog-cache-ttl-only-no-invalidation.md) —
  the Redis catalog cache is TTL-only; there's no product-write path to
  invalidate against yet.
- [ADR-0007](docs/decisions/0007-cors-origin-frontend-url-single-source-of-truth.md)
  — `CORS_ORIGIN`/`FRONTEND_URL` are reconciled at boot instead of left to
  drift; the drift was silently causing production 403s.
- [ADR-0008](docs/decisions/0008-cookie-secure-decoupled-from-node-env.md) —
  cookie `Secure` follows its own `COOKIE_SECURE` flag instead of
  `NODE_ENV` directly, so prod-parity Docker testing over plain HTTP
  doesn't silently drop every auth cookie.

## CI

`.github/workflows/ci.yml` runs on every pull request and push to `main`:
lint, unit tests with coverage, and a production build in one job; the
Playwright suite in another, against Postgres and Redis service containers
(still `continue-on-error` until it has gone green in CI).

A dependency audit runs alongside as an advisory job, reported rather than
enforced — current advisories are transitive dev-tooling issues (Vite/esbuild,
drizzle-kit) requiring major-version bumps tracked separately.
