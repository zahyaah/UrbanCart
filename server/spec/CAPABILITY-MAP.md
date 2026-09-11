# Capability Map: UrbanCart Backend (Phase C)

Replaces fakestoreapi.com entirely with an owned Node/Fastify + TypeScript +
Postgres backend. Bundles several independently testable capabilities, so per
`spec-driven-development`'s Phase 0 scope check, this map precedes any module
spec.

| Module id | Responsibility | Depends on |
|---|---|---|
| `infra` | Fastify app skeleton, config/env loading, DB connection, migrations tooling, structured error responses, logging | — |
| `identity` | User registration/login, password hashing, JWT issuance via httpOnly cookies, refresh-token rotation + reuse detection | `infra` |
| `catalog` | Products table, seed data, list/detail endpoints (replaces fakestoreapi) | `infra` |
| `cart` | Server-side cart + cart_items, **guest-cart-merge-on-login** | `infra`, `identity`, `catalog` |
| `orders` | Orders + order_items, Stripe test-mode Checkout Session, **idempotent order creation** | `infra`, `identity`, `cart` |
| `web-integration` | Point the existing frontend at this API: auth screens, `productsApi` base URL swap, cart wired to the server post-login, Stripe Payment Element replacing the mock checkout form | `catalog`, `cart`, `orders` |

**Build order:** `infra` → `identity`, `catalog` → `cart` → `orders` → `web-integration`

## Notes

- `identity`, `cart`, and `orders` each get their own module spec
  (`SPEC-identity.md`, `SPEC-cart.md`, `SPEC-orders.md`). `infra` is plumbing,
  not an independently shippable capability — its contract is folded into
  `SPEC-identity.md` as bootstrap work, since identity is the first module
  that needs the running skeleton. `catalog` is simple enough (two read
  endpoints, a seed script) that it doesn't need a standalone spec — its
  contract is captured directly in its task list.
- `web-integration` isn't specced up front: its contract *is* the API
  surface the other module specs already define. It becomes a task list once
  the API is implemented and stable, not a design document written against
  an API that doesn't exist yet.
- The two features called out for deliberate design ("worth engineering
  because they're excellent interview material") are `cart`'s guest-merge
  and `orders`' idempotent creation. Both got an adversarial doubt-driven
  review before implementation — see the "Doubt Review" section in each
  module's spec.
