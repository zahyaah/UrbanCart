# ADR-0008: Cookie `Secure` follows a dedicated COOKIE_SECURE flag, not NODE_ENV directly

## Status

Accepted

## Date

2026-09-19

## Context

`server/src/modules/identity/cookies.ts` sets `access_token`, `refresh_token`,
and `csrf_token` with `secure: config.isProduction`. That's correct for real
production: Render terminates TLS in front of the backend, so
`NODE_ENV=production` really does mean "this connection is HTTPS."

`docker-compose.yml` at the repo root also sets `NODE_ENV: production` — not
to claim the stack is in production, but so the backend runs as the actual
built Docker image with production-parity behavior (logging level,
`trustProxy`, etc.) instead of the dev server. That stack serves everything
over plain `http://localhost:*` with no TLS termination of its own. Browsers
silently discard a `Secure` cookie set over a plain HTTP response — Chrome
does not special-case `localhost` for this the way it does for some other
secure-context APIs. The practical effect: login appeared to succeed
(`Set-Cookie` headers were sent, register/login requests returned 201/200),
but the browser never stored the cookies, so every subsequent authenticated
request 401'd and the guest-cart merge on login failed with no visible cause
beyond "the frontend looks logged out."

## Decision

Added `COOKIE_SECURE` to `server/src/config.ts`: an optional `"true"/"false"`
env var. When unset, `config.cookieSecure` falls back to `isProduction`
(identical behavior to before, so real production is unaffected). When set,
it overrides that default explicitly. `cookies.ts` reads
`config.cookieSecure` instead of `config.isProduction` directly.
`docker-compose.yml`'s backend service sets `COOKIE_SECURE: "false"`.

## Alternatives Considered

### Set `NODE_ENV=development` in docker-compose.yml instead

Rejected: the whole point of this compose stack (per its own top comment) is
to run the actual production Docker image with production-parity behavior —
flipping `NODE_ENV` would also change logging verbosity, `trustProxy`, and
any other `isProduction`-gated behavior, defeating that purpose to fix one
specific symptom.

### Put a real TLS reverse proxy in front of the local compose stack

Rejected as disproportionate: solves the problem "correctly" in the sense of
matching production's actual topology, but adds a certificate/proxy
(mkcert + Caddy/nginx) that every contributor running `docker compose up`
locally now has to understand, for a stack whose stated purpose is testing
the built image and app behavior — not TLS termination, which Render already
handles in real deployments.

## Consequences

- `COOKIE_SECURE` is documented in `server/.env.example`-adjacent comments in
  `config.ts` itself; a deployment that needs to force cookies non-Secure
  over HTTP for some other reason (another local-only environment) now has
  an explicit, discoverable knob instead of needing to touch `cookies.ts`.
- Real production is unaffected: `COOKIE_SECURE` is unset in `render.yaml`,
  so `config.cookieSecure` still just follows `NODE_ENV=production` as
  before.
- Anyone adding a new cookie-setting call site must remember to read
  `config.cookieSecure`, not `config.isProduction`, or they'll reintroduce
  this exact bug for that cookie specifically.
