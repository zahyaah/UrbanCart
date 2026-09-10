# ADR-0003: Keep checkout wizard state local to the route

## Status

Accepted

## Date

2026-09-09

## Context

Checkout is a four-step flow — address, payment, review, confirmation. It needs
to track the current step, the values collected by earlier steps, and a snapshot
of the order once placed.

The obvious default in a Redux app is to put that in the store. The question was
whether this state actually belongs there.

The state has three properties that argue against it: nothing outside
`/checkout` reads it, it should not survive leaving the route (a half-filled
payment form must not reappear days later), and it holds card details that should
not be written to the persisted store.

## Decision

Keep wizard state in a `useReducer` inside `Checkout.jsx`. Each step is a
controlled form driven by the shared `useCheckoutForm` hook; step components
receive values and submit handlers as props and hold no cross-step state.

## Alternatives considered

### A `checkout` slice in Redux

Pros: consistent with how the cart is managed; visible in devtools.

Rejected: it makes page-scoped, deliberately ephemeral state global. It would
need explicit reset-on-unmount logic to avoid a stale form reappearing, and the
store subscriber persists state to `localStorage` — writing card details there is
not acceptable. The state has no consumer outside this route, so the ceremony
buys nothing.

### `useState` per field in each step

Rejected: step transitions have to move values between steps, so the parent needs
them anyway. A reducer keeps the legal transitions in one place instead of
scattering them across four components.

### A form library (react-hook-form + zod)

Rejected as over-engineering for two forms of five and four fields. The
validation rules are a handful of `if` statements; `useCheckoutForm` is roughly
twenty lines and returns the errors object so a failed submit can focus the first
invalid field.

### URL-driven steps (`/checkout/address`, `/checkout/payment`, ...)

Pros: deep-linkable, and the back button moves between steps.

Rejected: deep-linking into step three is meaningless without the data from steps
one and two, so every step would need a guard redirecting back to the start. The
in-page Back buttons already provide the navigation this flow needs.

## Consequences

- Leaving `/checkout` discards the flow, which is the intended behaviour.
- Card details never reach the Redux store and are never persisted.
- The browser back button leaves checkout entirely rather than stepping back one
  stage; the wizard provides its own Back buttons.
- `handlePlaceOrder` captures the order into `state.placedOrder` *before*
  dispatching `clearCart()`, because the confirmation step must still render
  after the cart it was built from is emptied. The empty-cart guard is written to
  allow the `confirmation` step through for the same reason. This ordering is
  load-bearing and covered by an end-to-end test.
