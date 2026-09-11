# Urban Cart

A full-stack e-commerce app: React/Redux frontend, a Fastify/Postgres backend
with real authentication, a server-side cart, and Stripe Checkout. Browse
products, manage a cart (merged automatically on login), and pay through an
embedded Stripe Payment Element.

**Live:** not yet deployed — see [Deployment](#deployment) to stand up the
backend on Render; the frontend's hosting target is a separate decision not
made yet.

## Stack

**Frontend:** React 18 + Vite 5 + TypeScript, Redux Toolkit (RTK Query for
every API slice), React Router v6, Tailwind CSS v4 + shadcn/ui, Framer
Motion, Stripe Elements. Vitest + React Testing Library, Playwright.

**Backend** (`server/`): Fastify v5 + TypeScript, Postgres via Drizzle ORM,
Redis (catalog cache + shared rate-limit store), Stripe (Checkout Sessions +
webhooks), Sentry (error reporting), pino structured logging. Vitest against
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
   └── Fastify API (server/) ────┼──── Stripe (Checkout Sessions, webhooks)
         │          │            │
         ▼          ▼            ▼
      Postgres    Redis       Sentry
   (Drizzle ORM) (cache +   (error reporting)
                 rate limit
                    store)
```

The frontend never talks to Postgres, Redis, Stripe, or Sentry directly —
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
docker compose exec backend node dist/db/seed.js   # first run only
```

Frontend at `http://localhost:8080`, backend at `http://localhost:3001`.
Stripe checkout will fail against the placeholder key in `docker-compose.yml`
— override `STRIPE_SECRET_KEY`/`STRIPE_WEBHOOK_SECRET` as shell-exported env
vars (Compose picks them up automatically) to test payment for real.

### Option B: Run frontend and backend directly (faster iteration)

```bash
# Postgres + Redis only, via the same compose file
docker compose up -d postgres redis

cd server
cp .env.example .env   # fill in a real JWT_ACCESS_SECRET; Stripe/Redis/Sentry optional
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
| `npm run test:e2e` | Playwright suite — **currently stale**, see [Testing](#testing) |
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
- **Real checkout.** Stripe Checkout Sessions with an embedded Payment
  Element, idempotency-key-protected order creation (a double-submitted
  "Place Order" click creates exactly one order and one Stripe session), and
  a webhook-driven order-paid state (never the client-side redirect alone).
- **Shipping address**, collected and persisted on the order at purchase
  time.
- **Redis-cached catalog**, cache-aside with a short TTL — see
  [ADR-0006](docs/decisions/0006-catalog-cache-ttl-only-no-invalidation.md).
- **Code-split frontend bundle** — Stripe's SDK, the checkout wizard, and
  auth pages load on demand, not on first paint. See [Performance](#performance).
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

**Playwright e2e suite — currently stale.** It predates the Phase C backend
rewrite: it expects a 4-step wizard with a "Review" step (removed), mock
card-number validation (replaced by real Stripe Elements), and doesn't
account for the auth gate now in front of checkout. Known debt, not
silently broken — see [ADR](docs/decisions/) list for what actually changed
underneath it. Code-splitting the bundle (this phase) was instead verified
with the unit suites plus a manual Playwright smoke pass across every route.

## Performance

The frontend bundle (`vite build`) was one ~616 KB/200 KB-gzip JS file —
every route, including Stripe's Elements SDK (only needed at `/checkout`),
loaded eagerly. `src/App.tsx` now lazy-loads every route except the product
listing (the landing page — must stay eager so first paint isn't gated on a
chunk) behind `React.lazy`/`Suspense`.

**Bundle**, from `vite build`'s own output (deterministic, not a lab
measurement):

| | Before | After |
|---|---|---|
| Main chunk | 616.28 KB (200.10 KB gzip) | 580.71 KB (190.24 KB gzip) |
| Page-specific code | bundled into the main chunk | ~39 KB across 7 on-demand chunks (Checkout: 21.9 KB, Cart: 3.0 KB, Product: 3.2 KB, auth pages, confirmation, `OrderSummary`) |

A shopper who never reaches `/checkout` never downloads Stripe's SDK or the
checkout wizard.

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
| Create order | 5/5 reached the order-creation endpoint correctly (a placeholder Stripe key in local `.env` makes Stripe itself return 401 "Invalid API Key" — expected without a real test-mode key) |
| p95 request duration | 465 ms (dominated by bcrypt's deliberately-slow password hashing during register — see `security-and-hardening`'s password-hashing guidance) |

## Deployment

`render.yaml` is a [Render Blueprint](https://render.com/docs/blueprint-spec):
one file provisions the backend (Docker web service), a managed Postgres
database, and a Key Value (Redis) instance together.

1. Push this branch to GitHub.
2. Render dashboard → **New** → **Blueprint** → select this repo.
3. Render reads `render.yaml` and prompts for the `sync: false` secrets:
   `JWT_ACCESS_SECRET` (32+ random characters), `STRIPE_SECRET_KEY`,
   `STRIPE_WEBHOOK_SECRET`, `SENTRY_DSN` (optional — leave blank to keep
   Sentry a no-op), `CORS_ORIGIN` and `FRONTEND_URL` (wherever the frontend
   ends up hosted).
4. Deploy. `dockerCommand` runs the DB migration before starting the server
   on every deploy (idempotent — drizzle's migrator skips already-applied
   migrations), so no separate manual migration step is needed.
5. Seed the catalog once, from Render's shell for the backend service:
   `node dist/db/seed.js`.

The frontend isn't part of this Blueprint — it's a static build
(`Dockerfile` at the repo root, or any static host) and needs `VITE_API_URL`
pointed at the deployed backend's URL at *build* time (Vite inlines
`import.meta.env.VITE_*` values into the bundle, so this can't be a runtime
env var for a static SPA).

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

## CI

`.github/workflows/ci.yml` runs on every pull request and push to `main`:
lint, unit tests with coverage, and a production build in one job; the
Playwright suite in another (currently red — see [Testing](#testing)).

A dependency audit runs alongside as an advisory job, reported rather than
enforced — current advisories are transitive dev-tooling issues (Vite/esbuild,
drizzle-kit) requiring major-version bumps tracked separately.
