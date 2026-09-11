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

export const config = {
    ...parsed.data,
    isProduction: parsed.data.NODE_ENV === "production",
    corsOrigins: parsed.data.CORS_ORIGIN.split(",").map((s) => s.trim()),
};
