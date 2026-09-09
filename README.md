# Urban Cart

A small e-commerce app built with React, Redux Toolkit, and Tailwind CSS. Browse products, manage a cart, and check out through a four-step wizard. Product data comes from the [Fake Store API](https://fakestoreapi.com).

## Stack

- React 18 + Vite
- Redux Toolkit: RTK Query for product data, a plain slice for the cart
- React Router v6
- Tailwind CSS
- Framer Motion

## Running locally

```bash
npm install
npm run dev
```

Opens at `http://localhost:5173`.

```bash
npm run build   # production build
npm run lint    # ESLint
```

## Features

- **Responsive layout.** Every page works at 375px, 768px, and 1280px+, with 44px minimum touch targets on all interactive controls.
- **Cart drawer.** A slide-over panel opens from the nav bar for quick edits, alongside the full `/cart` page.
- **Checkout wizard.** Address, payment (a mock form — no real payment is processed), review, and confirmation steps.
- **Typography.** Space Grotesk for headings, Inter for body text, self-hosted via `@fontsource` for no external font requests and no flash of unstyled text.

## Architecture notes

Cart items store a full product snapshot (`id`, `title`, `price`, `image`, `quantity`) captured at add-to-cart time, not just an id. The cart page reads this straight from Redux with zero network requests — it never has to re-fetch product data to render, which also removes a race condition that existed when the cart stored only ids and looked up prices on every render.

Product catalog data (listing and detail pages) goes through RTK Query, which caches results and handles loading/error state automatically.

The checkout wizard keeps its step state locally (`useReducer` in `Checkout.jsx`) rather than in Redux — it's ephemeral and page-scoped, so a store slice would add ceremony without benefit.

## Live

https://urbancart-blush.vercel.app
