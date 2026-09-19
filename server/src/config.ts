import { z } from "zod";

// Docker Compose and Render both emit an env var as "" rather than omitting
// it when it's left unset -- an optional value should treat that the same
// as genuinely absent, not fail min(1) validation at boot.
const optionalString = () => z.preprocess((v) => (v === "" ? undefined : v), z.string().min(1).optional());

// Validated once at boot. A misconfigured deployment should fail loudly at
// startup, not fail confusingly on the first request that touches the
// missing value.
const envSchema = z.object({
    NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
    PORT: z.coerce.number().int().positive().default(3001),
    DATABASE_URL: z.string().min(1),
    JWT_ACCESS_SECRET: z.string().min(32, "JWT_ACCESS_SECRET must be at least 32 characters"),
    CORS_ORIGIN: z.string().min(1),
    COOKIE_SAME_SITE: z.enum(["lax", "none", "strict"]).default("lax"),
    STRIPE_SECRET_KEY: z.string().min(1),
    STRIPE_WEBHOOK_SECRET: z.string().min(1),
    FRONTEND_URL: z.string().min(1),
    // Optional: absent means catalog caching is a no-op and rate limiting
    // falls back to its in-memory store -- fine for local dev without
    // Docker, wrong once more than one instance is running. See lib/redis.ts.
    REDIS_URL: optionalString(),
    SENTRY_DSN: optionalString(),
});

const parsed = envSchema.safeParse(process.env);
if (!parsed.success) {
    console.error("Invalid environment configuration:");
    console.error(parsed.error.format());
    process.exit(1);
}

// A browser's Origin header is always a bare `scheme://host[:port]`.
// new URL(...).origin canonicalizes away things an operator might paste in
// by habit -- a trailing slash, a path, mixed-case scheme/host -- that
// would otherwise silently never match request.headers.origin.
function parseOrigin(raw: string, envVarName: string): string {
    try {
        return new URL(raw).origin;
    } catch {
        console.error(`Invalid ${envVarName}: "${raw}" is not a valid URL`);
        process.exit(1);
    }
}

const corsOrigins = parsed.data.CORS_ORIGIN.split(",")
    .map((s) => s.trim())
    .filter(Boolean)
    .map((s) => parseOrigin(s, "CORS_ORIGIN"));

const frontendOrigin = parseOrigin(parsed.data.FRONTEND_URL, "FRONTEND_URL");

// @fastify/cors (app.ts) and the CSRF Origin check (auth-plugin.ts) both
// read corsOrigins as their allowlist -- one source of truth, so the two
// checks can't drift apart from each other. FRONTEND_URL is also used
// separately to build the Stripe checkout returnUrl (orders/routes.ts), so
// it isn't silently folded into corsOrigins here: doing that would let
// FRONTEND_URL silently *widen* what CORS trusts whenever it didn't
// already agree with CORS_ORIGIN, changing the CORS trust boundary based
// on which env var an operator happened to remember to update. Failing
// loudly instead turns a stale/missing entry into a deploy-time error
// instead of a silent Origin-check 403 discovered in production days later.
if (!corsOrigins.includes(frontendOrigin)) {
    console.error(
        `FRONTEND_URL ("${frontendOrigin}") is not included in CORS_ORIGIN (${corsOrigins.join(", ")}). ` +
            "Add it to CORS_ORIGIN so CORS and the CSRF Origin check agree on what the frontend's origin is."
    );
    process.exit(1);
}

export const config = {
    ...parsed.data,
    isProduction: parsed.data.NODE_ENV === "production",
    corsOrigins,
};
