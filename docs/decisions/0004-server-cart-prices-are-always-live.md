# ADR-0004: The server-side cart never snapshots price; orders do

## Status

Accepted

## Date

2026-09-11

## Context

[ADR-0001](0001-denormalized-cart-state.md) established that the *client*
cart snapshots a product's price at add-to-cart time, specifically so the
price a shopper sees in their cart is the price they agreed to, not
whatever the API happens to return by the time they check out.

Phase C introduces a server-side cart (`cart_items`) as the authoritative
store once a user is logged in, populated in part by the guest-cart-merge
flow. The question is whether `cart_items` should carry the same
snapshotted-price model as the client cart, or always resolve price live
from `products` at read time.

This was flagged directly by an adversarial design review of the merge
endpoint (see `server/spec/SPEC-cart.md`): joining live prices at merge time
reintroduces the exact price-surprise problem ADR-0001 went out of its way
to eliminate. A guest who added an item at $20 could log in and see it
merged at $25 with no warning.

## Decision

`cart_items` stores only `product_id` and `quantity`. Price is always
resolved live from `products` — never snapshotted, never accepted from the
client. `orders` and `order_items`, by contrast, **do** snapshot price
(`unit_price_cents`) at the moment an order is created, alongside the
product's title at that time.

## Alternatives considered

### Snapshot price in `cart_items`, matching the client's model exactly

Rejected: the server cart is the direct input to payment. A snapshotted
price sitting in the database is a stale price waiting to happen — one a
compromised or buggy client could also attempt to submit directly, and the
security posture for anything upstream of "how much do we charge this card"
has to be "recompute from the source of truth," not "trust a stored value,"
regardless of who could theoretically influence it.

### Snapshot price in `cart_items`, but always recompute at checkout anyway

This is close to a distinction without a difference — if checkout ignores
the snapshot and recomputes live regardless, the snapshot in `cart_items` is
dead data with no consumer, kept only to make the merge response look like
ADR-0001's client model. Rejected as complexity with no behavior behind it.

## Consequences

- The server cart's displayed price can differ from what a guest saw before
  logging in. This is a deliberate, acknowledged UX regression relative to
  ADR-0001's guarantee — mitigated on the client, not the server: the
  frontend already holds its own pre-merge price snapshot (per ADR-0001) and
  can diff it against the server's merge response to show "the price of X
  changed since you added it" rather than silently swapping the number.
  Implementing that diff is a `web-integration` task, not a backend one.
- `orders` snapshotting price means a later product price change, rename, or
  deactivation never rewrites a past order's receipt — `order_items.title`
  and `unit_price_cents` are frozen at purchase, independent of what
  `products` says afterward.
- Money is stored as integer cents throughout (`unit_price_cents`,
  `subtotal_cents`), not `numeric`/decimal — avoids float rounding and the
  `pg` driver's default of returning `numeric` columns as strings.
