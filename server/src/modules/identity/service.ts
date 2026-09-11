import { eq, and, isNull } from "drizzle-orm";
import { db } from "../../db/index.js";
import { users, refreshTokens } from "../../db/schema.js";
import { hashPassword, verifyPassword } from "./passwords.js";
import {
    signAccessToken,
    generateRefreshToken,
    hashRefreshToken,
    generateCsrfToken,
    REFRESH_TOKEN_TTL_DAYS,
    REFRESH_REUSE_GRACE_MS,
} from "./tokens.js";
import { Errors } from "../../lib/errors.js";

interface SessionTokens {
    accessToken: string;
    refreshToken: string;
    csrfToken: string;
}

async function issueNewSession(userId: string, sessionCreatedAt: Date): Promise<SessionTokens> {
    const rawRefreshToken = generateRefreshToken();
    const expiresAt = new Date(Date.now() + REFRESH_TOKEN_TTL_DAYS * 24 * 60 * 60 * 1000);

    await db.insert(refreshTokens).values({
        userId,
        tokenHash: hashRefreshToken(rawRefreshToken),
        sessionCreatedAt,
        expiresAt,
    });

    return {
        accessToken: await signAccessToken(userId),
        refreshToken: rawRefreshToken,
        csrfToken: generateCsrfToken(),
    };
}

export async function register(email: string, password: string): Promise<SessionTokens> {
    const existing = await db.query.users.findFirst({ where: eq(users.email, email) });
    if (existing) {
        throw Errors.conflict("An account with this email already exists");
    }

    const passwordHash = await hashPassword(password);
    const [user] = await db.insert(users).values({ email, passwordHash }).returning();
    if (!user) throw Errors.internal();

    return issueNewSession(user.id, new Date());
}

// A genuine bcrypt hash of a fixed, never-used password. Compared against
// on every login for an email that doesn't exist, so verifyPassword's
// timing looks the same whether or not the account is registered.
const DUMMY_HASH_FOR_TIMING_SAFETY = "$2b$12$CHuB7rC0.d6W7aeV8mDgXOHb0zwhL9wqQz6lUDrSnPzRUUM3Cw2dC";

export async function login(email: string, password: string): Promise<SessionTokens> {
    const user = await db.query.users.findFirst({ where: eq(users.email, email) });
    const hashToCompare = user?.passwordHash ?? DUMMY_HASH_FOR_TIMING_SAFETY;
    const valid = await verifyPassword(password, hashToCompare);

    if (!user || !valid) {
        throw Errors.unauthorized("Invalid email or password");
    }

    return issueNewSession(user.id, new Date());
}

type RefreshResult = SessionTokens | "invalid" | "theft";

export async function refresh(rawToken: string): Promise<RefreshResult> {
    const tokenHash = hashRefreshToken(rawToken);
    const row = await db.query.refreshTokens.findFirst({ where: eq(refreshTokens.tokenHash, tokenHash) });

    if (!row) return "invalid";

    const sessionAgeMs = Date.now() - row.sessionCreatedAt.getTime();
    if (row.expiresAt < new Date() || sessionAgeMs > REFRESH_TOKEN_TTL_DAYS * 24 * 60 * 60 * 1000) {
        return "invalid"; // hard-expired, regardless of activity -- SPEC-identity.md finding #6
    }

    if (row.revokedAt) {
        // The grace window only applies to a genuine rotation -- one that
        // recorded a successor token (replacedByHash). A row revoked with
        // no successor was killed by a theft response or a logout, not
        // rotated; granting a grace-period pass there would let a stolen
        // token (or a logged-out session) keep working for up to 30s right
        // after the account was locked down, defeating the entire point of
        // "revoke everything." That path is dead immediately, no leniency.
        if (!row.replacedByHash) {
            return "invalid";
        }

        // Genuinely rotated. Reuse within the grace window is a benign
        // race (multi-tab, retry) -- mint a fresh sibling rotation rather
        // than erroring. Outside the window, treat it as a stolen-token
        // signal.
        const revokedAgoMs = Date.now() - row.revokedAt.getTime();
        if (revokedAgoMs <= REFRESH_REUSE_GRACE_MS) {
            return issueNewSession(row.userId, row.sessionCreatedAt);
        }
        await revokeAllSessionsForUser(row.userId);
        return "theft";
    }

    // Atomic conditional claim -- not a read-then-write. If two concurrent
    // requests both present this same live token, only one UPDATE can
    // affect a row (Postgres serializes on the row lock); the loser sees
    // 0 rows and falls into the same grace-window path above rather than a
    // naive double-rotation.
    const newRawToken = generateRefreshToken();
    const [claimed] = await db
        .update(refreshTokens)
        .set({ revokedAt: new Date(), replacedByHash: hashRefreshToken(newRawToken) })
        .where(and(eq(refreshTokens.id, row.id), isNull(refreshTokens.revokedAt)))
        .returning();

    if (!claimed) {
        // Lost the race to a concurrent refresh of the exact same token.
        // That rotation just happened, so this is within-grace by
        // definition -- mint a fresh sibling rather than erroring.
        return issueNewSession(row.userId, row.sessionCreatedAt);
    }

    const expiresAt = new Date(Date.now() + REFRESH_TOKEN_TTL_DAYS * 24 * 60 * 60 * 1000);
    await db.insert(refreshTokens).values({
        userId: row.userId,
        tokenHash: hashRefreshToken(newRawToken),
        sessionCreatedAt: row.sessionCreatedAt,
        expiresAt,
    });

    return {
        accessToken: await signAccessToken(row.userId),
        refreshToken: newRawToken,
        csrfToken: generateCsrfToken(),
    };
}

async function revokeAllSessionsForUser(userId: string) {
    await db
        .update(refreshTokens)
        .set({ revokedAt: new Date() })
        .where(and(eq(refreshTokens.userId, userId), isNull(refreshTokens.revokedAt)));
}

export async function logout(rawToken: string): Promise<void> {
    const tokenHash = hashRefreshToken(rawToken);
    await db
        .update(refreshTokens)
        .set({ revokedAt: new Date() })
        .where(and(eq(refreshTokens.tokenHash, tokenHash), isNull(refreshTokens.revokedAt)));
}
