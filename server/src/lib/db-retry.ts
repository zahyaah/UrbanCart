/** Retries once on a Postgres serialization failure (error code 40001:
 * "could not serialize access due to concurrent update"), which is the
 * expected, correct way to handle a REPEATABLE READ transaction that lost a
 * genuine write conflict -- not a bug, a signal to redo the whole
 * transaction. See SPEC-cart.md's doubt review, finding #9. */
export async function runWithSerializationRetry<T>(fn: () => Promise<T>): Promise<T> {
    try {
        return await fn();
    } catch (err) {
        if (isSerializationFailure(err)) {
            return fn();
        }
        throw err;
    }
}

function isSerializationFailure(err: unknown): boolean {
    return typeof err === "object" && err !== null && "code" in err && (err as { code: unknown }).code === "40001";
}
