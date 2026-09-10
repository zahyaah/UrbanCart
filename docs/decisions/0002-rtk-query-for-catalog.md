# ADR-0002: Fetch the product catalog with RTK Query

## Status

Accepted

## Date

2026-09-09

## Context

Product listing and detail pages read from the Fake Store API. The original
implementation used `useEffect` + `fetch` in each component, with local
`useState` for data, loading and error.

That pattern was duplicated across two components and handled the failure cases
inconsistently: neither guarded against setting state after unmount, the detail
page had no error branch at all, and navigating between the listing and a product
refetched data already retrieved moments earlier.

Redux Toolkit was already a dependency, since the cart uses a slice.

## Decision

Use RTK Query (`productsApi`) for all catalog reads — `getProducts` and
`getProductById`.

## Alternatives considered

### Keep `useEffect` + `fetch`, extract a `useFetch` hook

Pros: no new concepts; the smallest possible change.

Rejected: a hand-rolled hook has to reimplement caching, deduplication and
cancellation to match what RTK Query gives for free, and getting those right is
exactly where the original bugs were.

### TanStack Query

A better-featured data-fetching library, and the more common choice generally.

Rejected: it would be a second state-management dependency alongside a Redux
store the app already runs for the cart. RTK Query ships inside Redux Toolkit,
so it adds no new dependency and puts server cache and client state under one
store and one set of devtools.

### Load the catalog once into a Redux slice at startup

Rejected: it makes every route wait on a full catalog fetch, and it hand-rolls
the loading and error handling that RTK Query already provides.

## Consequences

- Loading and error states come from the hook rather than being re-derived per
  component, so both pages handle failure the same way.
- Navigating back to the listing serves the cached response instead of refetching.
- Requests for the same product are deduplicated automatically.
- The store gains a second reducer and the API middleware — configured once in
  `redux/store.js`.
- The catalog cache is deliberately not the cart's source of truth; see
  [ADR-0001](0001-denormalized-cart-state.md).
