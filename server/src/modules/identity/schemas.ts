import { z } from "zod";

// bcrypt silently truncates input past 72 bytes -- capping here means a
// long password's *whole* value matters, not just its first 72 bytes.
export const credentialsSchema = z.object({
    email: z.string().trim().toLowerCase().email().max(255),
    password: z.string().min(8).max(72),
});

export const userResponseSchema = z.object({
    user: z.object({
        id: z.uuid(),
        email: z.string(),
    }),
});
