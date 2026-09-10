# ADR-0001: Store a product snapshot in cart state

## Status

Accepted

## Date

2026-09-09

## Context

The cart slice originally stored only product ids and quantities. Everything the
cart needed to render — title, price, image — was fetched from the Fake Store API
at render time, once per line item.

That produced a race condition. Each quantity change re-rendered the cart, which
re-issued a fetch per item. Those requests could resolve out of order, so a
response for a stale quantity could land after a newer one and overwrite it.
Clicking the quantity stepper quickly enough left the displayed quantity and the
computed total disagreeing with each other and with the store.

The cart also depended on network availability to display items the user had
already chosen, and the price shown at checkout was whatever the API returned at
that moment rather than the price the user saw when they added the item.

## Decision

Store a full product snapshot in cart state at add-to-cart time:
`{ id, title, price, image, quantity }`. The cart renders entirely from Redux and
issues no network requests.

## Alternatives considered

### Keep ids, add request cancellation

Abort in-flight fetches when a newer one starts (`AbortController`, or RTK
Query's own request deduplication).

Rejected: this mitigates the symptom while keeping the cart on the network path.
It leaves the cart unable to render offline, and it still shows live prices
rather than the price the user agreed to.

### Keep ids, derive from the RTK Query catalog cache

Read product details out of the catalog cache the listing page already populates.

Rejected: the cache is not a guaranteed store. Entries expire, and a user who
lands directly on `/cart` (a reload, a bookmark, a shared link) has no populated
cache, so the cart would have to fetch anyway. It also reintroduces the live-price
problem.

### Normalize, with a separate products slice as the source of truth

Rejected as over-engineering for a catalog of twenty items. It adds a
synchronisation problem — keeping the products slice populated for whatever the
cart references — to solve a duplication problem the app does not have.

## Consequences

- The race condition is removed by construction rather than mitigated: there is
  no async work on the cart path to interleave.
- The cart renders offline and survives a reload, since state persists to
  `localStorage` and is complete on its own.
- The price is fixed at add-to-cart time, which is the behaviour a shopper
  expects.
- Cart state duplicates catalog data. If a product's price or title changes
  server-side, an existing cart keeps the old values. For this app that is the
  desired behaviour; a real checkout would re-price against the server at order
  placement, and this ADR would need revisiting.
- Persisted cart entries are untrusted input. `cartSlice` validates the shape of
  every entry read back from `localStorage` and drops malformed ones, so a
  corrupt entry cannot reach the money math and render `NaN` totals.
