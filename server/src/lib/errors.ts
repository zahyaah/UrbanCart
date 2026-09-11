// Every error response follows one shape: { error: { code, message, details? } }.
// See server/spec -- api-and-interface-design's "Consistent Error Semantics."
export class ApiError extends Error {
    constructor(
        public statusCode: number,
        public code: string,
        message: string,
        public details?: unknown
    ) {
        super(message);
        this.name = "ApiError";
    }
}

export const Errors = {
    validation: (details?: unknown) => new ApiError(422, "VALIDATION_ERROR", "Invalid input", details),
    badRequest: (message: string) => new ApiError(400, "BAD_REQUEST", message),
    unauthorized: (message = "Authentication required") => new ApiError(401, "UNAUTHORIZED", message),
    forbidden: (message = "Not authorized to perform this action") => new ApiError(403, "FORBIDDEN", message),
    notFound: (message = "Resource not found") => new ApiError(404, "NOT_FOUND", message),
    conflict: (message: string) => new ApiError(409, "CONFLICT", message),
    idempotencyKeyReused: () =>
        new ApiError(422, "IDEMPOTENCY_KEY_REUSED", "Idempotency-Key reused with a different request body"),
    tooManyRequests: (message = "Too many requests") => new ApiError(429, "TOO_MANY_REQUESTS", message),
    internal: (message = "An unexpected error occurred") => new ApiError(500, "INTERNAL_ERROR", message),
};
