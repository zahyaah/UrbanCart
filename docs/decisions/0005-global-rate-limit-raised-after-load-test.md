# ADR-0005: Global rate limit raised from 200/min to 600/min per IP

## Status

Accepted

## Date

2026-09-11

## Context

Phase C set the global rate limit (`@fastify/rate-limit`, applied to every
route via `app.ts`) at 200 requests/minute per IP, alongside a much stricter
`AUTH_RATE_LIMIT` of 10 requests/15 minutes scoped to
register/login/refresh. The global number was a reasonable-looking default
at the time, chosen without load-test evidence.

Phase D's k6 load test (`k6/catalog.js`) exercised catalog browsing at 20
concurrent virtual users against a local backend and immediately hit the
global limit: 99.9% of requests came back `429`. Investigating showed this
wasn't a test artifact — 200/min per IP (3.3 req/s) is exhausted by ordinary
single-shopper behavior, not just synthetic load:

- `ConfirmationPage` polls `GET /orders/:id` every 2 seconds
  (`server/spec/SPEC-orders.md`) — 30 requests/minute from one open tab,
  before counting anything else that tab does.
- The rate limiter keys by IP (`@fastify/rate-limit`'s default
  `keyGenerator`), not by session or user. Any shared-IP scenario — an
  office NAT, a corporate proxy, a household's shared connection — pools
  every concurrent shopper behind it into the same 200/min budget.

The k6 run's own timing data showed the limiter itself responds fast when
triggered (`p(95)=2.3ms` on the rejected requests) — the limiter mechanism
works correctly. The number it was configured with was the problem.

## Decision

Raise the global limit to 600 requests/minute per IP. Leave `AUTH_RATE_LIMIT`
(10/15min on register/login/refresh) unchanged — it exists specifically to
slow credential-stuffing/brute-force attempts and is deliberately far
stricter than general browsing traffic needs; the global limit's job is
coarse abuse/DoS protection, not authentication security, and those two
concerns shouldn't share one number.

## Alternatives Considered

### Key by session/user instead of IP

Would fix the shared-IP over-counting problem directly, but requires a
signed-in session to exist before rate limiting can apply — an unauthenticated
shopper browsing the catalog (the exact traffic that hit this limit first)
has no session to key on. Rejected as solving a narrower problem than the one
observed, and as a bigger change than the evidence justified.

### Raise the limit further (e.g. 2000/min) to leave more headroom

Rejected for now: 600/min (10 req/s per IP) already clears the observed
single-shopper ceiling with real margin, and the point of a rate limit is to
bound worst-case load, not to be maximized. Revisit with another load test if
real traffic patterns turn out to need more.

### Leave it at 200/min and fix the polling interval instead

`ConfirmationPage`'s 2s poll is one contributor, not the root cause — the
same 200/min ceiling is reachable by ordinary concurrent browsing alone, with
or without that poll. Narrowing the fix to one caller would leave the
underlying per-IP-pooling problem for the next feature that happens to make a
few requests in quick succession.

## Consequences

- A shared-IP scenario (office/NAT) with many concurrent real shoppers can
  still exhaust 600/min in principle; this is a coarse DoS/abuse guard, not a
  precise per-user budget, and that trade-off is accepted rather than solved
  here (see "key by session" above).
- Any future change to this number should be backed by a k6 run, not
  intuition — this ADR exists specifically because the original number
  wasn't, and looked fine until it was actually measured.
