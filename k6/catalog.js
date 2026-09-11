// Catalog browsing under load -- the scenario the Redis cache (see
// server/src/modules/catalog/service.ts) exists for. Run against a fresh
// backend to see the cache's effect: the first handful of iterations across
// all VUs pay the Postgres query cost, everything after that within the
// 60s/300s TTL window is served from Redis.
//
// Usage: BASE_URL=http://localhost:3001 k6 run k6/catalog.js
import http from "k6/http";
import { check, sleep } from "k6";

const BASE_URL = __ENV.BASE_URL || "http://localhost:3001";
// Every VU in a local k6 run shares this machine's one source IP, and the
// backend's global rate limiter (600 req/min per IP -- see ADR-0005) counts
// by IP, not by VU. Default stays comfortably under that shared budget for a
// clean throughput/latency read; set VUS higher (e.g. 20) to deliberately
// exceed it instead and verify the limiter engages -- see README's Load
// Testing section for both numbers.
const VUS = Number(__ENV.VUS) || 6;

export const options = {
    stages: [
        { duration: "15s", target: VUS },
        { duration: "30s", target: VUS },
        { duration: "10s", target: 0 },
    ],
    thresholds: {
        http_req_duration: ["p(95)<500"],
        http_req_failed: ["rate<0.01"],
    },
};

export default function () {
    const listRes = http.get(`${BASE_URL}/products`);
    const ok = check(listRes, { "GET /products is 200": (r) => r.status === 200 });

    // A non-200 (e.g. 429 from the global rate limiter, see app.ts) has an
    // { error: {...} } body, not { products: [...] } -- bail out to sleep()
    // rather than let JSON.parse's shape mismatch throw and skip the sleep,
    // which would otherwise spin the VU into a tight retry loop with no
    // backoff and make a transient rate-limit response self-amplifying.
    if (ok) {
        const products = JSON.parse(listRes.body).products;
        if (products.length > 0) {
            const random = products[Math.floor(Math.random() * products.length)];
            const detailRes = http.get(`${BASE_URL}/products/${random.id}`);
            check(detailRes, { "GET /products/:id is 200": (r) => r.status === 200 });
        }
    }

    sleep(1);
}
