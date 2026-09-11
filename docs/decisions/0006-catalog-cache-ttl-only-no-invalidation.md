# ADR-0006: Catalog cache is TTL-only, with no invalidation path

## Status

Accepted

## Date

2026-09-11

## Context

Phase D adds a Redis cache in front of `listProducts()`/`getProductById()`
(`server/src/modules/catalog/service.ts`) to reduce Postgres load under the
concurrent catalog-browsing traffic k6 exercises (`k6/catalog.js`). A cache
needs an invalidation strategy, and the honest starting fact is: **no route
in this codebase writes to `products`.** The catalog is populated once via
`db:seed` and is otherwise read-only from the API's perspective.

## Decision

Cache-aside with a short TTL (60s for the list, 300s for a single product)
and no invalidation logic of any kind. A cache entry simply expires and the
next request repopulates it from Postgres. `redis` being unset (local dev
without Docker) makes every call an always-miss no-op — the same code path,
not a special case.

## Alternatives Considered

### Write-through cache with explicit invalidation on product write

Rejected: there is no product-write path to hook an invalidation call into.
Building the invalidation mechanism now means designing it against a write
path that doesn't exist yet, guessing at its shape (single-product update?
bulk re-seed? admin bulk edit?) rather than building it against the real one
when it arrives.

### Pub/sub or key-tagging invalidation scheme for future-proofing

Rejected as speculative complexity — matches
`incremental-implementation`'s Rule 0 (simplicity first) directly: three
similar lines beat a premature abstraction, and an invalidation framework
with zero current callers is exactly that.

## Consequences

- **A product write, whenever one is added, will not be immediately visible**
  through `GET /products`/`GET /products/:id` — callers will see stale data
  for up to the TTL window (worst case 300s for a single product). Anyone
  building an admin product-edit feature needs to read this ADR first and
  either add real invalidation (`redis.del` the affected keys on write) or
  consciously accept the staleness window.
- The 404-for-unknown-id case is cached too (`cached()` stores `null` just
  like any other value) — this is deliberate cache-penetration protection
  (repeated requests for a bad/guessed ID don't all reach Postgres), not an
  oversight, but it means a product `id` that starts existing mid-TTL-window
  (impossible today, relevant again once writes exist) would 404 briefly
  after creation too.
- TTLs (60s/300s) were chosen as reasonable defaults for a low-churn catalog,
  not derived from a specific measurement — revisit if a real write path
  changes how "low-churn" this data actually is.
