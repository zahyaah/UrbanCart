# Spec: `identity` module (+ `infra` bootstrap)

## Objective

Replace fakestoreapi.com's implicit "no auth" model with real accounts:
register, login, logout, and silent session renewal — without ever putting a
JWT where client-side JS (or an XSS payload) can read it.

## Doubt Review

A fresh-context adversarial review (`doubt-driven-development`) ran against
the first draft of this design before any code was written. Full review
findings are in the session transcript; this section records the
reconciliation — what changed and why, or why a finding was accepted as a
documented trade-off rather than fixed.

| # | Finding | Classification | Resolution |
|---|---|---|---|
| 1 | Refresh rotation + reuse-detection has a false-positive race: two near-simultaneous refreshes (multi-tab, or a flaky-network retry) both read the same `jti`; whichever completes second gets flagged as "reuse" and the whole account is logged out | Valid, actionable | Grace window: rotating a `jti` records `replaced_by_jti` instead of just `revoked_at`. A reuse of an already-rotated token *within 30s* of rotation replays the same new pair instead of raising theft. Reuse *outside* the window is still treated as theft. |
| 2 | "No client-side token handling at all" hides real complexity: silent renewal needs a single-flight refresh + request queue on 401 | Valid, actionable | Documented explicitly below as the `web-integration` contract, not hand-waved. |
| 3 | `SameSite=Lax` silently breaks if frontend and API aren't same-site (real risk here — this repo deploys the frontend to Vercel) | Valid, actionable for dev; trade-off for prod | Cookie `sameSite` is env-configurable (`lax` default, `none` opt-in). Documented as an open deployment question in `docs/decisions/` once a prod host is chosen — not solved here, since it's a deployment decision, not a backend-architecture one. |
| 4 | `Secure` cookies assumed to "just work" in dev; only `localhost` (mainly Chrome) gets the HTTPS carve-out | Valid, actionable | `secure: process.env.NODE_ENV === 'production'`. Dev cookies are never marked `Secure`, so this is a non-issue locally regardless of browser/hostname. |
| 5 | Reuse detection is reactive — an attacker who uses a stolen token *before* the legitimate user's next refresh becomes the "legitimate" chain, and the real user trips the alarm | Valid, accepted trade-off | Inherent to rotation-based reuse detection generally (how most production implementations work). Documented, not solved — full mitigation needs device binding/behavioral signals, out of scope. |
| 6 | Sliding 30-day window + no absolute cap means a persistent-XSS session (which doesn't need to *read* the cookie, only ride it) never expires | Valid, actionable | Refresh tokens carry `session_created_at` (copied forward on every rotation). Rotation refuses to extend past 30 days from the *original* login, not from last use. |
| 7 | No instant revocation for already-issued access tokens (up to 15 min window after logout/theft-response) | Valid, accepted trade-off | Standard for stateless short-lived access tokens; a blocklist checked on every request defeats the point of statelessness. Kept short (15 min) specifically to bound this window. |
| 8 | CSRF: SameSite+Origin doesn't cover GET-mutation routes, missing-Origin requests, sibling-subdomain compromise, in-app browsers | Valid, actionable (partial) | Invariant: **no GET route ever mutates state** (enforced by convention + reviewed in every PR). Origin check falls back to `Referer` when `Origin` is absent; both absent on a mutating request → reject (fail closed). Additionally adopted a double-submit CSRF token (see below) specifically because it closes the sibling-subdomain and missing-Origin gaps that Origin-checking alone can't. In-app-browser SameSite inconsistency is accepted residual risk. |
| 9 | Operational gaps: unbounded `refresh_tokens` growth, no rate limiting on `/auth/login`\|`/auth/refresh`, no explicit algorithm pinning | Valid, actionable | Nightly cleanup deletes expired/revoked rows past a retention window. `@fastify/rate-limit` on both routes. `jose`'s `jwtVerify` requires the caller to pass `algorithms: ['HS256']` explicitly — there is no implicit "trust the token's own `alg` header" mode, which is exactly the algorithm-confusion class this closes by construction. |
| 10 | "Revoke ALL sessions on detected reuse" logs a user out of every device on one false positive | Valid, resolved by fix #1 | The grace window eliminates the *ordinary* false-positive source (races). Genuine reuse *outside* the window revoking everything is the textbook-correct response, kept as intentional. |

## Design

### Tokens

- **Access token**: JWT (`jose`, HS256), 15 min TTL, `{ sub: userId, type: 'access' }`.
- **Refresh token**: opaque random 32-byte value (not a JWT — a bare secret is
  simpler to revoke/rotate than a signed token whose claims nobody needs to
  read client-side). Stored server-side hashed (sha256) in `refresh_tokens`;
  the raw value goes in the cookie only.
- Both set as `httpOnly`, `sameSite` (env-configurable, default `lax`),
  `secure: NODE_ENV==='production'` cookies. **Never** in a JSON response
  body, never in `localStorage`, never in Redux.

### `refresh_tokens` table

```
id                uuid primary key default gen_random_uuid()
user_id           uuid not null references users(id) on delete cascade
token_hash        text not null unique         -- sha256(raw refresh token)
session_created_at timestamp not null           -- copied forward on rotation; absolute 30-day cap
replaced_by_hash  text                          -- set on rotation; enables the reuse grace window
revoked_at        timestamp
created_at        timestamp not null default now()
expires_at        timestamp not null
```

Index on `expires_at` (nightly cleanup) and `user_id` (revoke-all-on-theft).

### `POST /auth/refresh` flow

1. Read `refresh_token` cookie. Missing → 401.
2. Hash it, look up by `token_hash`.
3. Not found → 401 (unknown/garbage token).
4. `revoked_at` is set:
   - `replaced_by_hash` is **null** → this row was killed by a theft
     response or a logout, not a genuine rotation. No grace period applies
     — reusing it is immediately `401`, full stop. (This was tightened
     during implementation: an earlier draft let *any* revoked-and-reused
     token through the grace window regardless of why it was revoked, which
     meant a token from an account that had just been locked down for
     suspected theft could still work for up to 30 more seconds — the exact
     opposite of what "revoke everything" is supposed to mean. Caught by the
     test asserting a sibling token dies immediately after a theft
     response, not just the reused token itself.)
   - `replaced_by_hash` is set (a genuine prior rotation) **and** it
     happened within the last 30s → benign race: mint a fresh sibling
     rotation from this same row rather than erroring. (Also tightened: the
     original idea of literally replaying the *same* reissued pair doesn't
     work — only the token's hash is ever stored, so there's no raw value
     left to replay. A fresh sibling rotation is functionally equivalent —
     the user ends up with a valid session either way — without needing to
     retain a raw secret anywhere.)
   - `replaced_by_hash` is set but the rotation was **more than 30s ago** →
     theft response: revoke every `refresh_tokens` row for this `user_id`,
     clear cookies, `401`.
5. `expires_at` passed, or `now() - session_created_at > 30 days` → 401,
   clear cookies (session hard-expired regardless of activity).
6. Otherwise: rotate. Generate a new refresh token, insert it carrying
   forward `session_created_at`; set this row's `replaced_by_hash` and
   `revoked_at = now()`. Issue a new access token. Set both new cookies.

### CSRF

Double-submit token: on login, also set a **non-httpOnly** `csrf_token`
cookie (random value, same lifetime as the access token). Every
state-changing request (`POST`/`PATCH`/`DELETE`) must carry a matching
`X-CSRF-Token` header, checked against the cookie value. Combined with the
`Origin`/`Referer` check (§8 above), this is the primary CSRF defense — the
cookie's own `SameSite` is defense-in-depth on top, not the sole line.

### `web-integration` contract (not built in this module, but specified here so it isn't lost)

- All `fetch` calls use `credentials: 'include'`.
- A single-flight refresh: concurrent 401s trigger exactly one
  `/auth/refresh` call; other in-flight requests queue on its result and
  retry once; a failed refresh redirects to login.
- The frontend reads the `csrf_token` cookie (it's deliberately not
  `httpOnly`) and attaches it as `X-CSRF-Token` on every mutating request.

## Success Criteria

- Register, login, logout, and silent refresh all work end to end against a
  real Postgres instance (integration tests, not mocks).
- A stolen-and-reused refresh token (simulated in a test by presenting an
  already-rotated, out-of-grace-window token) revokes the whole session.
- A race (two refreshes within the grace window) does **not** revoke the
  session — regression test for review finding #1.
- No JWT or refresh token ever appears in a JSON response body (grep-able
  guarantee, asserted in tests).
