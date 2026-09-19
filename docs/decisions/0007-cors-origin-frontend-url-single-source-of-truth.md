# ADR-0007: CORS_ORIGIN and FRONTEND_URL are reconciled at boot, not left to drift

## Status

Accepted

## Date

2026-09-19

## Context

`@fastify/cors` (`server/src/app.ts`) and the CSRF double-submit check
(`requireCsrf` in `server/src/modules/identity/auth-plugin.ts`) both need to
know the frontend's origin(s), but they read two independently-set env vars:
`CORS_ORIGIN` (a comma-separated allowlist) and `FRONTEND_URL` (a single
canonical value, also used to build the Stripe checkout `returnUrl` in
`server/src/modules/orders/routes.ts`). Before this change, `@fastify/cors`
only saw `CORS_ORIGIN`, while `requireCsrf` separately unioned in
`FRONTEND_URL`.

An operator updating one var without the other (e.g. redeploying the
frontend to a new URL and only updating `FRONTEND_URL`, or vice versa) made
the two checks silently disagree. In production this manifested as
`POST /cart/items` and `POST /cart/merge` 403ing with no server-side trace —
4xx responses weren't logged, so the failure was invisible in Render logs and
looked identical to a guest-cart-merge bug from the frontend's side.

## Decision

`server/src/config.ts` normalizes every `CORS_ORIGIN` entry via
`new URL(...).origin` (so a trailing slash or mixed-case scheme/host can't
silently fail to match a browser's `Origin` header) and exits at boot
(`process.exit(1)`) if `FRONTEND_URL`'s origin isn't already a member of
`corsOrigins`. `@fastify/cors` and `requireCsrf` both read the same
`config.corsOrigins` array — one source of truth, so they cannot drift apart
from each other again. `FRONTEND_URL` itself is left untouched as a separate
field for the Stripe `returnUrl` build.

`requireCsrf` also now logs a warning (with the rejected `Origin`) whenever
it rejects a request that presented an `Origin`/`Referer` that didn't match —
the missing server-side trace that made the original bug hard to diagnose.

## Alternatives Considered

### Auto-merge `FRONTEND_URL` into `corsOrigins`

Silently union `FRONTEND_URL` into the CORS allowlist instead of failing at
boot. Rejected: this would let `FRONTEND_URL` silently *widen* what
`@fastify/cors` trusts whenever it didn't already agree with `CORS_ORIGIN`,
making the CORS trust boundary depend on which of the two env vars an
operator happened to remember to set. A security boundary should not move
based on an accident of configuration order — caught in review before
shipping.

### Leave the two vars independent, just add logging

Rejected: logging turns a silent failure into a *diagnosable* one, but the
underlying drift is still possible and still breaks production the same way
until someone reads the logs. Failing loudly at deploy time is cheaper than
debugging it after the fact.

## Consequences

- A `render.yaml` (or any deployment) that sets `FRONTEND_URL` to a value not
  present in `CORS_ORIGIN` will fail to boot, with a clear error naming both
  values — this is deliberate; the alternative is a silent production 403.
- Adding a second allowed frontend origin (e.g. a staging deployment) means
  adding it to `CORS_ORIGIN` as a comma-separated entry; `FRONTEND_URL` stays
  a single canonical value and doesn't need to change.
- Rejected-origin CSRF failures now show up in logs at `warn` level, keyed on
  the actual `Origin` header received — useful for catching a stale
  `CORS_ORIGIN` after a frontend redeploy.
