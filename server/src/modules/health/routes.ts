import type { FastifyInstance } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import { z } from "zod";
import { sql } from "drizzle-orm";
import { db } from "../../db/index.js";

export async function healthRoutes(app: FastifyInstance) {
    app.withTypeProvider<ZodTypeProvider>().route({
        method: "GET",
        url: "/health",
        schema: {
            response: {
                200: z.object({ status: z.literal("ok"), db: z.literal("ok") }),
            },
        },
        handler: async () => {
            await db.execute(sql`select 1`);
            return { status: "ok" as const, db: "ok" as const };
        },
    });
}
