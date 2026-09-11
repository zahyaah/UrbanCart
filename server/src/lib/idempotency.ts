import { createHash } from "node:crypto";
import { and, eq, or, lt, sql } from "drizzle-orm";
import { db } from "../db/index.js";
import { idempotencyKeys } from "../db/schema.js";

export const IDEMPOTENCY_KEY_HEADER = "idempotency-key";
const IDEMPOTENCY_KEY_PATTERN = /^[A-Za-z0-9-]{1,128}$/;
const RETENTION_DAYS = 7; // outlives Stripe's ~3-day webhook redelivery window with margin

// No operation behind this mechanism should ever run longer than this
// (routes calling out to Stripe pass an explicit request timeout well under
// this). A row still 'in_progress' past this age means the process that
// claimed it crashed before recording an outcome -- reclaim it lazily, on
// the next actual retry, rather than running a separate sweep job for
// something that only matters exactly when a client retries anyway.
const STALE_IN_PROGRESS_MS = 5 * 60 * 1000;

export function isValidIdempotencyKey(value: unknown): value is string {
    return typeof value === "string" && IDEMPOTENCY_KEY_PATTERN.test(value);
}

// Computed via Postgres's own now(), not JS Date.now() -- createdAt is
// stamped by the same `now()` default, so comparing against a cutoff from
// the same clock avoids any app/DB clock-skew edge case (unlike a bound
// parameter computed in JS, this is a SQL expression evaluated per-row).
function staleInProgressCutoff() {
    return sql`now() - (${STALE_IN_PROGRESS_MS}::int * interval '1 millisecond')`;
}

/** Recursively key-sorted JSON, hashed with sha256. Operates on the
 * post-Zod-parse body (already normalized to real types), not raw request
 * bytes -- sidesteps float-formatting/Unicode-normalization differences
 * that a raw-bytes hash would be vulnerable to. */
export function computeRequestHash(body: unknown): string {
    return createHash("sha256").update(canonicalize(body)).digest("hex");
}

function canonicalize(value: unknown): string {
    if (value === null || typeof value !== "object") {
        return JSON.stringify(value);
    }
    if (Array.isArray(value)) {
        return `[${value.map(canonicalize).join(",")}]`;
    }
    const keys = Object.keys(value as Record<string, unknown>).sort();
    const entries = keys.map((k) => `${JSON.stringify(k)}:${canonicalize((value as Record<string, unknown>)[k])}`);
    return `{${entries.join(",")}}`;
}

export type ClaimResult =
    | { outcome: "claimed"; id: string }
    | { outcome: "replay"; status: number; body: unknown }
    | { outcome: "conflict" }
    | { outcome: "hash_mismatch" };

/** Atomically claims an idempotency key: fresh key, or a reclaimed 'failed'
 * one. Never a separate check-then-insert -- the unique constraint on
 * (user_id, scope, idempotency_key) is what serializes concurrent claims of
 * the same key. See server/spec/SPEC-orders.md's doubt review, finding #1. */
export async function claimIdempotencyKey(params: {
    userId: string;
    scope: string;
    idempotencyKey: string;
    requestHash: string;
}): Promise<ClaimResult> {
    const { userId, scope, idempotencyKey, requestHash } = params;
    const expiresAt = new Date(Date.now() + RETENTION_DAYS * 24 * 60 * 60 * 1000);

    const [claimed] = await db
        .insert(idempotencyKeys)
        .values({ userId, scope, idempotencyKey, requestHash, status: "in_progress", expiresAt })
        .onConflictDoUpdate({
            target: [idempotencyKeys.userId, idempotencyKeys.scope, idempotencyKeys.idempotencyKey],
            set: {
                status: "in_progress",
                requestHash,
                responseStatus: null,
                responseBody: null,
                createdAt: sql`now()`,
                expiresAt,
            },
            // Reclaim a row that failed outright, OR one stuck 'in_progress'
            // past STALE_IN_PROGRESS_MS (a crash mid-request, not a genuine
            // still-running operation -- see the constant's comment). A
            // fresh 'in_progress' or a 'succeeded' row is left untouched.
            setWhere: or(
                eq(idempotencyKeys.status, "failed"),
                and(eq(idempotencyKeys.status, "in_progress"), lt(idempotencyKeys.createdAt, staleInProgressCutoff()))
            ),
        })
        .returning();

    if (claimed) {
        return { outcome: "claimed", id: claimed.id };
    }

    // Lost the race, or the existing row is 'in_progress'/'succeeded' --
    // either way, read its current state to decide what to tell the caller.
    const existing = await db.query.idempotencyKeys.findFirst({
        where: and(
            eq(idempotencyKeys.userId, userId),
            eq(idempotencyKeys.scope, scope),
            eq(idempotencyKeys.idempotencyKey, idempotencyKey)
        ),
    });

    if (!existing) {
        // Vanishingly unlikely (would mean it was deleted between the
        // failed upsert and this read), but fail safe rather than crash.
        return { outcome: "conflict" };
    }

    if (existing.requestHash !== requestHash) {
        return { outcome: "hash_mismatch" };
    }

    if (existing.status === "succeeded") {
        return { outcome: "replay", status: existing.responseStatus ?? 200, body: existing.responseBody };
    }

    return { outcome: "conflict" };
}

/** Must be called inside the SAME transaction as the business-logic writes
 * it's recording the outcome of -- see doubt review finding #2. A separate
 * transaction here would let a crash between the two leave an order (or a
 * cart merge) committed with no matching 'succeeded' record, so a retry
 * could redo it. */
export async function recordIdempotencySuccess(
    tx: Parameters<Parameters<typeof db.transaction>[0]>[0],
    id: string,
    responseStatus: number,
    responseBody: unknown
): Promise<void> {
    await tx
        .update(idempotencyKeys)
        .set({ status: "succeeded", responseStatus, responseBody })
        .where(eq(idempotencyKeys.id, id));
}

/** Deliberately NOT part of the business-logic transaction -- if that
 * transaction rolled back, there's nothing to record it alongside. This
 * always runs standalone, immediately. */
export async function recordIdempotencyFailure(id: string): Promise<void> {
    await db.update(idempotencyKeys).set({ status: "failed" }).where(eq(idempotencyKeys.id, id));
}
