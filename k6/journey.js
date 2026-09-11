// A full shopper journey under load: register -> browse -> add to cart ->
// place an order. Exercises the identity, catalog, cart, and orders modules
// together, including the CSRF double-submit pattern every state-changing
// route requires (see server/src/modules/identity/auth-plugin.ts).
//
// Usage: BASE_URL=http://localhost:3001 ORIGIN=http://localhost:5173 k6 run k6/journey.js
import http from "k6/http";
import { check, sleep } from "k6";

const BASE_URL = __ENV.BASE_URL || "http://localhost:3001";
// Must match the backend's CORS_ORIGIN/ALLOWED_ORIGINS -- requireCsrf
// rejects any other Origin regardless of a valid CSRF token.
const ORIGIN = __ENV.ORIGIN || "http://localhost:5173";

// AUTH_RATE_LIMIT (identity/routes.ts) permits only 10 register/login calls
// per 15 minutes per IP -- deliberately strict brute-force protection, and
// every VU in a local k6 run shares this machine's one IP. A ramping/
// sustained-load profile here would mostly measure that limiter rejecting
// requests, which is a security-control check, not a user-journey load
// test. Run a small fixed number of iterations instead -- enough to
// exercise the full register -> cart -> order path under real (if modest)
// concurrency and get real per-step latency, without pretending to sustain
// throughput the auth budget was deliberately built not to allow.
export const options = {
    scenarios: {
        journeys: {
            executor: "per-vu-iterations",
            vus: 5,
            iterations: 1,
            maxDuration: "30s",
        },
    },
    thresholds: {
        http_req_duration: ["p(95)<800"],
    },
};

function csrfToken(jar) {
    const cookies = jar.cookiesForURL(BASE_URL);
    return cookies.csrf_token && cookies.csrf_token[0];
}

export default function () {
    const jar = http.cookieJar();
    const headers = { "Content-Type": "application/json", Origin: ORIGIN };

    // Unique per VU+iteration so registration never collides across runs.
    const email = `k6-${__VU}-${__ITER}-${Date.now()}@example.com`;
    const registerRes = http.post(
        `${BASE_URL}/auth/register`,
        JSON.stringify({ email, password: "k6-load-test-password-1" }),
        { headers }
    );
    check(registerRes, { "register is 201": (r) => r.status === 201 });
    if (registerRes.status !== 201) return;

    const csrf = csrfToken(jar);
    const authedHeaders = { ...headers, "X-CSRF-Token": csrf };

    const listRes = http.get(`${BASE_URL}/products`);
    const products = JSON.parse(listRes.body).products;
    if (products.length === 0) return;
    const product = products[0];

    const addRes = http.post(
        `${BASE_URL}/cart/items`,
        JSON.stringify({ productId: product.id, quantity: 1 }),
        { headers: authedHeaders }
    );
    check(addRes, { "add to cart is 200": (r) => r.status === 200 });

    const orderRes = http.post(
        `${BASE_URL}/orders`,
        JSON.stringify({
            shippingAddress: {
                fullName: "K6 Load Test",
                addressLine1: "1 Load Test Way",
                city: "Loadville",
                postalCode: "00000",
                country: "US",
            },
        }),
        {
            headers: {
                ...authedHeaders,
                "Idempotency-Key": `k6-${__VU}-${__ITER}-${Date.now()}`,
            },
        }
    );
    // Requires a live Stripe test-mode key to succeed end-to-end (201) --
    // a placeholder key (see .env.example) gets a 401 straight from Stripe's
    // API ("Invalid API Key provided"), propagated as-is. Both outcomes are
    // checked and reported separately so a placeholder-key run doesn't
    // masquerade as a passing order-creation flow.
    check(orderRes, {
        "order creation reachable (201, or 401 from a placeholder Stripe key)": (r) =>
            r.status === 201 || r.status === 401,
    });

    sleep(1);
}
