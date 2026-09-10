# Urban Cart

A small e-commerce app built with React, Redux Toolkit, and Tailwind CSS. Browse products, manage a cart, and check out through a four-step wizard. Product data comes from the [Fake Store API](https://fakestoreapi.com).

**Live:** https://urbancart-blush.vercel.app

## Stack

- React 18 + Vite 5
- Redux Toolkit: RTK Query for product data, a plain slice for the cart
- React Router v6
- Tailwind CSS v4 + shadcn/ui
- Framer Motion
- Vitest + React Testing Library, Playwright

## Running locally

```bash
npm install
npm run dev
```

Opens at `http://localhost:5173`.

## Commands

| Command | Description |
|---|---|
| `npm run dev` | Development server |
| `npm run build` | Production build |
| `npm run lint` | ESLint |
| `npm test` | Unit tests (Vitest) |
| `npm run test:watch` | Unit tests in watch mode |
| `npm run coverage` | Unit tests with a coverage report |
| `npm run test:e2e` | End-to-end tests (Playwright) |

The E2E suite builds the app and serves it with `vite preview`, so it runs
against the production bundle rather than the dev server. First run needs
browsers: `npx playwright install chromium`.

## Features

- **Responsive layout.** Every page works at 375px, 768px, and 1280px+, with 44px minimum touch targets on all interactive controls. Mobile uses a two-column grid so four products are visible at once.
- **Light and dark themes.** Toggled from the nav bar, persisted to `localStorage`, and initialised from `prefers-color-scheme` on first visit.
- **Cart sheet.** A slide-over panel opens from the nav bar for quick edits, alongside the full `/cart` page.
- **Checkout wizard.** Address, payment (a mock form — no real payment is processed), review, and confirmation steps.
- **Typography.** Stint Ultra Expanded for display type, Unica One for body text, self-hosted via `@fontsource` for no external font requests and no flash of unstyled text.

## Testing

Unit tests cover the logic worth guarding: the cart reducers, the memoised
selectors, form validation, the pricing math, and the shape validation applied to
cart state read back from `localStorage`. Presentational components and the
vendored shadcn primitives are deliberately not covered.

The Playwright suite runs against Chromium at desktop and mobile viewports, and
covers the catalog at three breakpoints in both themes, the cart, the sheet's
focus trap, and the checkout flow end to end.

Two tests exist specifically as regression guards and are worth leaving alone:

- **Rapid increment bursts** (`cartSlice.test.js`, `cart.spec.js`) — the original
  race condition, see [ADR-0001](docs/decisions/0001-denormalized-cart-state.md).
- **Cart-to-confirmation checkout** (`checkout.spec.js`) — reaches checkout by
  clicking through from the cart rather than navigating directly, which is what
  makes it catch the page-transition double-mount described in
  `Layout.jsx`.

## Architecture

Three decisions carry most of the design, each recorded in `docs/decisions/`:

- [ADR-0001](docs/decisions/0001-denormalized-cart-state.md) — cart items store a full product snapshot taken at add-to-cart time, so the cart renders with no network requests. This removed a race condition rather than mitigating it.
- [ADR-0002](docs/decisions/0002-rtk-query-for-catalog.md) — catalog reads go through RTK Query for caching, deduplication, and consistent loading/error handling.
- [ADR-0003](docs/decisions/0003-local-checkout-wizard-state.md) — the checkout wizard keeps step state in a local `useReducer`, not Redux: it is page-scoped, should not persist, and holds card details.

## CI

`.github/workflows/ci.yml` runs on every pull request and push to `main`: lint,
unit tests with coverage, and a production build in one job; the Playwright suite
in another, with browser binaries cached against the resolved Playwright version.

A dependency audit runs alongside as an advisory job. It is reported rather than
enforced — the current high-severity advisories are transitive dev-tooling issues
whose fixes require major-version bumps of `vite` and `react-router-dom`.
