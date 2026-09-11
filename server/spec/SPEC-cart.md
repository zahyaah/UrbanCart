# Spec: `cart` module

## Objective

A server-side cart for authenticated users, plus the guest-cart-merge-on-login
flow named as one of the two features worth deliberately engineering. Depends
on `identity` (auth) and `catalog` (products).

## Scope boundary

No inventory/stock tracking in this phase — a product is `active`
(purchasable) or not (soft-deleted, never hard-deleted; see below). "Active"
and "in stock" are the same concept here; there's no separate stock level to
disagree with it.

## Doubt Review

Adversarial review of the first draft (single-model, fresh context). Full
findings in the session transcript; reconciliation below.

| # | Finding | Classification | Resolution |
|---|---|---|---|
| 1 | `Idempotency-Key` was declared required but never actually wired into the described merge logic; the upsert as written isn't idempotent on retry (re-adds the guest quantity a second time) | Valid, actionable, **critical** | `/cart/merge` routes through the shared idempotency infrastructure (see `SPEC-orders.md`'s `idempotency_keys` design) — same claim/replay mechanism, `scope='cart:merge'`. |
| 2 | Lost-update race: "load existing rows, then compute+write" in app code is a classic read-then-write gap under Postgres's default READ COMMITTED — a concurrent add-to-cart between the read and write is silently overwritten | Valid, actionable, **critical** | Per-item merge is a single atomic statement, not read-then-write: `INSERT ... ON CONFLICT (user_id, product_id) DO UPDATE SET quantity = LEAST(cart_items.quantity + EXCLUDED.quantity, :max)`. The increment is computed by Postgres against the live row, never against an app-level snapshot. |
| 3 | Quantity capping (`MIN(existing+guest, MAX)`) silently clamps without reporting it — contract says every deviation must be visible, not just full drops | Valid, actionable | Response returns `adjustments: [{ productId, reason, requestedQuantity, appliedQuantity }]` for **every** line where the applied result differs from what the client sent — unknown product, invalid quantity, inactive product, *or* capped quantity. Not a binary dropped/kept list. |
| 4 | `droppedItems` shape and client-side surfacing were unspecified | Resolved by #3 | Shape is now the `adjustments` array above. Surfacing it in a toast/banner is a `web-integration` task, recorded so it isn't silently lost. |
| 5 | No cap on request size — a crafted `items` array with thousands of entries is a DoS vector, and this repo's own cart state is explicitly untrusted client input (see ADR-0001) | Valid, actionable | `items` capped at 50 entries by the Zod schema; over the cap → 400 before any DB work. |
| 6 | Duplicate `productId` within one request — behavior unspecified, order-dependent | Valid, actionable | Incoming items are pre-aggregated by `productId` (quantities summed) before validation, so behavior is deterministic regardless of client-side array order. |
| 7 | If the whole request is schema-rejected on one malformed item, that contradicts "drop bad items, keep the rest" — one corrupted localStorage entry could block the entire merge | Valid, actionable | Deliberate divergence from the usual "strict schema at the boundary" default (see `api-and-interface-design`): the transport-level schema only enforces `items` is an array ≤ 50 elements of *roughly* object shape. Each element is parsed individually in application code; a per-item parse failure becomes an `adjustments` entry (`reason: 'invalid_item_shape'`), not a whole-request 400. |
| 8 | Live-price join at merge time reintroduces the exact price-surprise problem [ADR-0001](../../docs/decisions/0001-denormalized-cart-state.md) deliberately eliminated for the pre-login cart — flagged as an unacknowledged tension with an existing project decision | Valid, **the sharpest finding of the three reviews** | Genuine, acknowledged trade-off — not a bug. `cart_items` never stores price; price is always looked up live, because the server cart is the checkout source of truth and must never let a stale or client-influenced price reach payment (`orders`, by contrast, *does* snapshot price at purchase — "cart is live, order is frozen" is the standard split). The UX regression is real, so it's mitigated without adding backend complexity: the *client* already holds its own pre-merge price snapshot (per ADR-0001); comparing that against the server's authoritative merge response is a client-side diff, not a new server concept. Written up as [ADR-0004](../../docs/decisions/0004-server-cart-prices-are-always-live.md); surfacing the diff as a toast is a `web-integration` task. |
| 9 | Read-consistency across the transaction's steps isn't guaranteed under READ COMMITTED — a product could be deactivated mid-transaction between the validate step and the response's live join | Valid, actionable | The whole merge runs in one `REPEATABLE READ` transaction (Postgres per-transaction isolation override), giving a consistent snapshot across validation and the response join. Retried once on a serialization failure (rare — only under genuinely concurrent conflicting writes to the same rows). Products are soft-deleted only (never hard-deleted), so a referenced `product_id` can never vanish out from under an in-flight transaction. |
| 10 | Idempotency-key dedup must be scoped by `(userId, key)`, not global, or one user's cached response could leak to another | Resolved by #1 | Scoped `(user_id, scope, idempotency_key)` — see `SPEC-orders.md`. |
| 11 | "Active" vs. "in stock" ambiguity | Resolved by Scope boundary above | No separate stock concept exists in this phase; documented explicitly rather than left implicit. |
| 12 | No rate limit on an endpoint that fires automatically on every login | Valid, actionable | `@fastify/rate-limit` on `/cart/merge`, same as `/auth/login`. |

## Design

### `cart_items` table

```
user_id     uuid not null references users(id) on delete cascade
product_id  uuid not null references products(id)
quantity    integer not null check (quantity > 0 and quantity <= 10)
created_at  timestamp not null default now()
updated_at  timestamp not null default now()
primary key (user_id, product_id)
```

`MAX_LINE_ITEM_QTY = 10`, enforced both by the `CHECK` constraint (belt) and
the application-level `LEAST(...)` clamp (suspenders — gives a clean
`adjustments` entry instead of a raw constraint-violation error).

### `POST /cart/merge`

- Auth required. `Idempotency-Key` header required (shared infra, see
  `SPEC-orders.md`).
- Body: `{ items: [{ productId: string, quantity: unknown }] }` — quantity is
  typed loosely at the schema boundary specifically so a malformed value
  becomes a per-item `adjustments` entry rather than a whole-request 400 (see
  finding #7).
- Steps inside one `REPEATABLE READ` transaction:
  1. Pre-aggregate by `productId` (finding #6).
  2. Per item: validate product exists + `active`; validate quantity is a
     positive integer. Invalid → `adjustments` entry, skip.
  3. Valid items: `INSERT ... ON CONFLICT (user_id, product_id) DO UPDATE SET
     quantity = LEAST(cart_items.quantity + EXCLUDED.quantity, 10)` (finding
     #2). If the clamp actually reduced the requested amount, add an
     `adjustments` entry (`reason: 'quantity_capped'`).
  4. Join the full resulting cart against `products` for the response
     (finding #9's isolation level makes this consistent with step 2's
     validation).
- Response: `{ items: CartItem[], adjustments: Adjustment[] }`.

## Success Criteria

- Merging a guest cart into an empty server cart, a non-empty server cart
  with overlapping products, and a server cart with capacity-exceeding
  quantities all produce the documented `adjustments`.
- Retrying the identical merge request with the same `Idempotency-Key`
  returns the identical response and does **not** double-apply quantities —
  regression test for finding #1.
- Two concurrent merge requests (simulated) never lose a concurrent
  unrelated `add-to-cart` write — regression test for finding #2.
- A malformed single item never blocks the rest of the merge — regression
  test for finding #7.
