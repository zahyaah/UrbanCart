import { describe, it, expect } from "vitest";
import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import {
    computeRequestHash,
    claimIdempotencyKey,
    recordIdempotencySuccess,
    recordIdempotencyFailure,
    isValidIdempotencyKey,
} from "./idempotency.js";
import { db } from "../db/index.js";
import { users, idempotencyKeys } from "../db/schema.js";

async function seedUser() {
    const [user] = await db
        .insert(users)
        .values({ email: `${randomUUID()}@test.com`, passwordHash: "x" })
        .returning();
    if (!user) throw new Error("seed failed");
    return user.id;
}

describe("isValidIdempotencyKey", () => {
    it.each([
        ["a uuid-shaped value", randomUUID(), true],
        ["empty string", "", false],
        ["over 128 chars", "a".repeat(129), false],
        ["contains spaces", "abc def", false],
        ["contains special chars", "abc;drop table", false],
    ])("%s -> %s", (_label, value, expected) => {
        expect(isValidIdempotencyKey(value)).toBe(expected);
    });
});

describe("computeRequestHash", () => {
    it("is stable regardless of key order", () => {
        const a = computeRequestHash({ x: 1, y: 2 });
        const b = computeRequestHash({ y: 2, x: 1 });
        expect(a).toBe(b);
    });

    it("differs for different content", () => {
        expect(computeRequestHash({ x: 1 })).not.toBe(computeRequestHash({ x: 2 }));
    });

    it("recursively sorts nested object keys", () => {
        const a = computeRequestHash({ outer: { b: 1, a: 2 } });
        const b = computeRequestHash({ outer: { a: 2, b: 1 } });
        expect(a).toBe(b);
    });
});

describe("claimIdempotencyKey", () => {
    it("claims a fresh key", async () => {
        const userId = await seedUser();

        const result = await claimIdempotencyKey({
            userId,
            scope: "test:scope",
            idempotencyKey: "key-1",
            requestHash: "hash-a",
        });

        expect(result.outcome).toBe("claimed");
    });

    it("regression: two concurrent claims of the same fresh key -- exactly one wins", async () => {
        // The atomicity guarantee the doubt review's finding #1 exists for:
        // no separate check-then-insert, the unique constraint itself
        // decides the winner.
        const userId = await seedUser();
        const params = { userId, scope: "test:scope", idempotencyKey: "race-key", requestHash: "hash-a" };

        const [a, b] = await Promise.all([claimIdempotencyKey(params), claimIdempotencyKey(params)]);

        const outcomes = [a.outcome, b.outcome].sort();
        expect(outcomes).toEqual(["claimed", "conflict"]);
    });

    it("returns conflict for a same-key, same-hash retry while the first is still in progress", async () => {
        const userId = await seedUser();
        const params = { userId, scope: "test:scope", idempotencyKey: "key-2", requestHash: "hash-a" };
        await claimIdempotencyKey(params);

        const result = await claimIdempotencyKey(params);

        expect(result.outcome).toBe("conflict");
    });

    it("returns hash_mismatch for a reused key with a different request body", async () => {
        const userId = await seedUser();
        await claimIdempotencyKey({ userId, scope: "test:scope", idempotencyKey: "key-3", requestHash: "hash-a" });

        const result = await claimIdempotencyKey({
            userId,
            scope: "test:scope",
            idempotencyKey: "key-3",
            requestHash: "hash-b",
        });

        expect(result.outcome).toBe("hash_mismatch");
    });

    it("replays the stored response for a succeeded key", async () => {
        const userId = await seedUser();
        const params = { userId, scope: "test:scope", idempotencyKey: "key-4", requestHash: "hash-a" };
        const claim = await claimIdempotencyKey(params);
        if (claim.outcome !== "claimed") throw new Error("expected claimed");

        await db.transaction(async (tx) => {
            await recordIdempotencySuccess(tx, claim.id, 201, { orderId: "abc-123" });
        });

        const replay = await claimIdempotencyKey(params);

        expect(replay).toEqual({ outcome: "replay", status: 201, body: { orderId: "abc-123" } });
    });

    it("regression: a failed key can be reclaimed by a fresh attempt (no leftover check-then-insert race)", async () => {
        const userId = await seedUser();
        const params = { userId, scope: "test:scope", idempotencyKey: "key-5", requestHash: "hash-a" };
        const firstClaim = await claimIdempotencyKey(params);
        if (firstClaim.outcome !== "claimed") throw new Error("expected claimed");
        await recordIdempotencyFailure(firstClaim.id);

        const retryClaim = await claimIdempotencyKey(params);

        expect(retryClaim.outcome).toBe("claimed");
    });

    it("scopes claims independently by scope -- the same key string in a different scope is a separate claim", async () => {
        const userId = await seedUser();
        await claimIdempotencyKey({ userId, scope: "orders:create", idempotencyKey: "shared-key", requestHash: "h" });

        const result = await claimIdempotencyKey({
            userId,
            scope: "cart:merge",
            idempotencyKey: "shared-key",
            requestHash: "h",
        });

        expect(result.outcome).toBe("claimed");
    });

    it("scopes claims independently by user -- one user's key never collides with another's", async () => {
        const userA = await seedUser();
        const userB = await seedUser();
        await claimIdempotencyKey({ userId: userA, scope: "test:scope", idempotencyKey: "same-key", requestHash: "h" });

        const result = await claimIdempotencyKey({
            userId: userB,
            scope: "test:scope",
            idempotencyKey: "same-key",
            requestHash: "h",
        });

        expect(result.outcome).toBe("claimed");
    });
});

describe("recordIdempotencySuccess", () => {
    it("must run inside the caller's own transaction -- rolling that transaction back also rolls back the success record", async () => {
        const userId = await seedUser();
        const params = { userId, scope: "test:scope", idempotencyKey: "key-6", requestHash: "hash-a" };
        const claim = await claimIdempotencyKey(params);
        if (claim.outcome !== "claimed") throw new Error("expected claimed");

        await expect(
            db.transaction(async (tx) => {
                await recordIdempotencySuccess(tx, claim.id, 200, { ok: true });
                throw new Error("simulated failure after recording success");
            })
        ).rejects.toThrow();

        const row = await db.query.idempotencyKeys.findFirst({ where: eq(idempotencyKeys.id, claim.id) });
        expect(row?.status).toBe("in_progress"); // the success record never actually committed
    });
});
