import type { FetchBaseQueryError } from "@reduxjs/toolkit/query/react";
import type { SerializedError } from "@reduxjs/toolkit";

/** Extracts a human-readable message from an RTK Query mutation rejection,
 * matching the backend's `{ error: { code, message } }` response shape
 * (see server/src/lib/errors.ts). Falls back to a generic message for
 * anything that isn't that shape (a network failure, a 5xx with no body). */
export function getApiErrorMessage(error: FetchBaseQueryError | SerializedError | undefined): string {
    if (!error) return "Something went wrong. Please try again.";

    if ("data" in error && error.data && typeof error.data === "object" && "error" in error.data) {
        const body = error.data as { error?: { message?: string } };
        if (body.error?.message) return body.error.message;
    }

    return "Something went wrong. Please try again.";
}
