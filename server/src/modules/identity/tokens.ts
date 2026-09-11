import { SignJWT, jwtVerify } from "jose";
import { randomBytes, createHash } from "node:crypto";
import { config } from "../../config.js";

const secretKey = new TextEncoder().encode(config.JWT_ACCESS_SECRET);

export const ACCESS_TOKEN_TTL_SECONDS = 15 * 60; // 15 min
export const REFRESH_TOKEN_TTL_DAYS = 30;
export const REFRESH_REUSE_GRACE_MS = 30_000; // doubt review finding #1

export async function signAccessToken(userId: string): Promise<string> {
    return new SignJWT({ type: "access" })
        .setProtectedHeader({ alg: "HS256" })
        .setSubject(userId)
        .setIssuedAt()
        .setExpirationTime(`${ACCESS_TOKEN_TTL_SECONDS}s`)
        .sign(secretKey);
}

export async function verifyAccessToken(token: string): Promise<{ userId: string }> {
    // Pinning `algorithms` explicitly is what prevents algorithm-confusion --
    // jose never falls back to trusting the token's own `alg` header alone.
    const { payload } = await jwtVerify(token, secretKey, { algorithms: ["HS256"] });
    if (payload.type !== "access" || typeof payload.sub !== "string") {
        throw new Error("Not an access token");
    }
    return { userId: payload.sub };
}

/** Opaque refresh token: a bare random secret, not a JWT -- nothing client-side
 * ever needs to read its claims, and a bare secret is simpler to revoke. */
export function generateRefreshToken(): string {
    return randomBytes(32).toString("base64url");
}

export function hashRefreshToken(raw: string): string {
    return createHash("sha256").update(raw).digest("hex");
}

export function generateCsrfToken(): string {
    return randomBytes(24).toString("base64url");
}
