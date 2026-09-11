# Spec: `orders` module

## Objective

Turn a server-side cart into a paid order via Stripe test mode, with
idempotent order creation — the second feature named as worth deliberately
engineering, because a double-clicked "Place Order" must never double-charge.
Depends on `identity` and `cart`.

## Doubt Review

Adversarial review of the first draft of the idempotency-key infrastructure
(shared by `/orders` and `/cart/merge`). Full findings in the session
transcript; reconciliation below. Two findings were classified **critical**
because they broke the mechanism's own stated invariant, not just an edge
case of it.

| # | Finding | Classification | Resolution |
|---|---|---|---|
| 1 | "On `status='failed'`, delete the row then insert fresh" is itself an unprotected check-then-insert race — exactly what the unique constraint exists to prevent. Two concurrent retries can both see `'failed'`, both delete, both insert, both run the handler | Valid, **critical** | Replaced with a single atomic conditional upsert: `INSERT ... ON CONFLICT (user_id, scope, idempotency_key) DO UPDATE SET status='in_progress', request_hash=EXCLUDED.request_hash, response_status=NULL, response_body=NULL, created_at=now() WHERE idempotency_keys.status='failed' RETURNING *`. Postgres serializes this via the row lock: only one concurrent statement can actually flip a `'failed'` row; the loser's `WHERE` no longer matches once the winner commits, so it returns no row and correctly falls through to "someone else has this." |
| 2 | "Do the business logic, then record the outcome" implies two separate statements. If the process crashes between the business-logic write (e.g. the `orders` insert) and the idempotency-row update, the row is stuck `'in_progress'` even though the order was already created — a later retry can create a **second** order | Valid, **critical** | The business-logic writes and the idempotency row's `'succeeded'` update happen in **one** database transaction — both land or neither does. The *claim* (step marking `'in_progress'`) is a separate, immediately-committed transaction (see below) so concurrent callers get a fast `409` instead of blocking for the duration of the Stripe call. |
| 3 | The 5-minute crash-recovery sweep can't distinguish "process crashed" from "request is still legitimately running," and has no heartbeat/lease mechanism | Valid, actionable | No operation behind this mechanism should ever take 5 minutes; the Stripe SDK call is given an explicit request timeout (well under a minute) so a hung external call can't occupy a claim indefinitely. The 5-minute threshold is a documented assumption backed by that timeout, not an unbacked constant. |
| 4 | "Handler calls a helper to record the outcome" relies on every route author remembering to — Fastify's `preHandler`/`handler`/`onSend` are independent hook stages, nothing wraps the handler invocation automatically | Valid, actionable | Implemented as a wrapper function, `withIdempotency(request, reply, scope, fn)`, that a route handler must call to do its work at all — there's no code path that skips outcome-recording, because the business logic only runs *inside* the wrapper's callback. |
| 5 | Request-hash canonicalization ("JSON.stringify with sorted keys") is ambiguous — nested-object sort order, and whether the hash covers more than the body | Valid, actionable | Hash is computed over the **post-Zod-parse** object (already normalized to real types), recursively key-sorted, not the raw request bytes — sidesteps float-formatting/Unicode-normalization differences entirely. Scoped to the body only; documented as correct for these two routes specifically (neither has header- or query-dependent behavior) and as an extension point if a future route needs more. |
| 6 | Replay only restores `response_status`/`response_body`, not headers (e.g. `Location`) | Valid, accepted trade-off | Neither route relies on a response header for client behavior (`/orders` returns `orderId` in the body already). Not building general header-replay for nothing that needs it. |
| 7 | 3-day retention has no safety margin over Stripe's own ~3-day webhook redelivery window — a late redelivery arriving just past expiry finds no record and creates a genuine duplicate | Valid, actionable | Retention raised to **7 days**. |
| 8 | No `CHECK`/enum constraint on `status`; no length/charset bound on the client-supplied key; no index on `expires_at` for the cleanup job | Valid, actionable | `status` is a Postgres enum, not free text. `Idempotency-Key` header validated (non-empty, ≤128 chars, `[A-Za-z0-9-]+`) before touching the DB. Index added on `expires_at`. |
| 9 | `user_id` must come from the authenticated session, never a request field, or this becomes a cross-user replay/IDOR | Valid — already the intent, now stated explicitly | The wrapper reads `request.user.id` from the verified access token; no route ever accepts a `userId` field for this purpose. |
| 10 | `response_body` retained for days may include sensitive data (e.g. a Stripe `client_secret`) | Valid, accepted trade-off | `client_secret` is short-lived, single-use, and scoped by Stripe's own design; storing it for legitimate replay is reasonable. Documented as a boundary: no future route should route raw payment-card data or full PII through this table without reconsidering retention. |
| 11 | Reclaiming a `'failed'` row overwrites it without archiving the failure detail | Valid, accepted trade-off | Structured server logs capture the failure reason already; a full DB audit trail is unneeded ceremony at this scope. |
| 12 | If the Stripe API call succeeds but the local DB transaction then fails, a retry must not create a second Stripe session | Valid, actionable | Stripe's own idempotency key is derived deterministically from ours (`order-create:${idempotencyKey}`) on every Checkout Session creation call — defense in depth independent of our own DB state. A retry that reaches Stripe again with the same derived key gets back the *same* session instead of a new one, even in this specific partial-failure gap. |
| 13 | No `Retry-After` on `409`; no rate limiting on the claim-conflict path | Valid, actionable | `409` responses include `Retry-After: 2`. `@fastify/rate-limit` applies to both idempotency-protected routes. |

## Design

### `idempotency_keys` table

```
id                uuid primary key default gen_random_uuid()
user_id           uuid not null references users(id)
scope             text not null              -- 'orders:create' | 'cart:merge'
idempotency_key   text not null              -- client-supplied, validated shape
request_hash      text not null              -- sha256 of canonicalized parsed body
status            idempotency_status not null -- enum: in_progress | succeeded | failed
response_status   integer
response_body     jsonb
created_at        timestamp not null default now()
expires_at        timestamp not null          -- created_at + 7 days
unique (user_id, scope, idempotency_key)
```

Index on `expires_at` for the nightly cleanup job.

### `withIdempotency` flow

1. Validate the `Idempotency-Key` header shape; missing/malformed → 400.
2. **TX1 (commits immediately):** attempt the conditional upsert described in
   finding #1's resolution.
   - Row returned → claim won (fresh key, or a reclaimed `'failed'` one).
     Proceed to step 3.
   - No row returned → `SELECT` the existing row:
     - `request_hash` mismatch → `422`.
     - `status='in_progress'` → `409` with `Retry-After: 2`.
     - `status='succeeded'` → respond immediately with the stored
       `response_status`/`response_body`; route handler never runs.
3. **TX2 (the actual work, separate from TX1):** run the wrapped handler.
   - `/orders`: compute total from the live server cart, call Stripe with a
     derived idempotency key, then in one transaction insert
     `orders`+`order_items` and mark the idempotency row `'succeeded'` with
     the response body.
   - `/cart/merge`: the `REPEATABLE READ` merge transaction from
     `SPEC-cart.md`, likewise ending by marking the idempotency row
     `'succeeded'` in the same transaction.
   - Any thrown error → a small, immediate statement marks the row
     `'failed'` (not part of the rolled-back business transaction).

### `orders` / `order_items`

Unlike `cart_items`, order rows **snapshot** price at purchase time — cart is
live, order is frozen (see [ADR-0004](../../docs/decisions/0004-server-cart-prices-are-always-live.md)).

```
orders:
  id                       uuid primary key default gen_random_uuid()
  user_id                  uuid not null references users(id)
  status                   order_status not null   -- enum: pending_payment | paid | failed | cancelled
  subtotal_cents           integer not null
  stripe_session_id        text
  shipping_full_name       text not null
  shipping_address_line1   text not null
  shipping_city            text not null
  shipping_region          text                     -- optional (many countries have no state/province)
  shipping_postal_code     text not null
  shipping_country         text not null
  created_at               timestamp not null default now()
  updated_at               timestamp not null default now()

order_items:
  id                uuid primary key default gen_random_uuid()
  order_id          uuid not null references orders(id) on delete cascade
  product_id        uuid not null references products(id)
  title             text not null            -- snapshotted, survives a later product rename
  unit_price_cents  integer not null         -- snapshotted
  quantity          integer not null
```

Money stored as integer cents throughout — avoids float rounding and
Postgres `numeric`-as-string driver quirks (`pg` returns `numeric` columns as
strings by default).

### Shipping address

Unlike the order's items/amount (always server-derived from the live cart —
see security-and-hardening's "never trust client-supplied amounts"), the
shipping address is legitimately client-supplied: the shopper is the only
source of truth for where they want the order delivered. It's validated with
`shippingAddressSchema` (`fullName`/`addressLine1`/`city`/`postalCode`/
`country` required, `region` optional) and stored on the `orders` row —
snapshotted at order-creation time, same as the order items, so a later
change to the user's profile/default address (were one ever added) doesn't
retroactively alter a past order's shipping record.

Because it's part of the client-supplied request body, it's covered by the
idempotency request-hash (finding #5) like the rest of the body: resubmitting
`POST /orders` with the same `Idempotency-Key` but a *different* address is
correctly treated as a different intent and `422`s rather than silently
keeping the first address — the frontend accounts for this by minting a
fresh idempotency key each time the shopper (re-)submits the address step,
not once per checkout-wizard mount.

### Stripe integration

Checkout Sessions, `ui_mode: "elements"` (Stripe's currently-recommended
integration for an embedded Payment Element inside a custom page — confirmed
against `docs.stripe.com/payments/quickstart`; the alternative, raw
PaymentIntents + Elements, is explicitly documented as not recommended
unless a caller has a specific reason to need it, which this project
doesn't). Server creates the session and returns `client_secret`; the
frontend mounts the embedded Payment Element in the existing PaymentStep,
replacing the mock card form.

`checkout.session.completed` / `payment_intent.succeeded` webhooks are the
**only** thing that flips `orders.status` from `pending_payment` to `paid` —
never the client-side redirect alone, since the user can close the tab
before it fires. The webhook handler's own idempotency is a conditional
update (`UPDATE orders SET status='paid' WHERE id=$1 AND status='pending_payment'`),
which is naturally idempotent on Stripe's at-least-once redelivery without
needing the heavier ledger table — the ledger exists specifically because
`/orders` and `/cart/merge` must replay an exact response body to the
*client*; the webhook has no client waiting on a specific response, so a
simple idempotent state transition is the right-sized tool.

## Success Criteria

- A double-submitted `POST /orders` with the same `Idempotency-Key` creates
  exactly one order and one Stripe Checkout Session — regression test for
  findings #1 and #2.
- A simulated crash between the business-logic write and outcome-recording
  cannot be reached, because they're one transaction; test asserts no code
  path can mark `'succeeded'` without the order existing, and vice versa.
- Retrying with the same key after a genuine failure succeeds cleanly
  (reclaim path), and does not create a duplicate Stripe session even when
  the first attempt's Stripe call actually went through — regression test
  for finding #12.
- Reusing a key with a different request body gets `422`, never a silent
  replay of the wrong response.
- A Stripe webhook redelivered days later (simulated) is a no-op, not a
  duplicate charge or duplicate order.
