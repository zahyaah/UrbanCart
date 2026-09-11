import type { FastifyInstance } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import { z } from "zod";
import { credentialsSchema, userResponseSchema } from "./schemas.js";
import { register, login, refresh, logout } from "./service.js";
import { setAuthCookies, clearAuthCookies } from "./cookies.js";
import { authenticate, requireCsrf } from "./auth-plugin.js";
import { Errors } from "../../lib/errors.js";
import { db } from "../../db/index.js";
import { users } from "../../db/schema.js";
import { eq } from "drizzle-orm";

const AUTH_RATE_LIMIT = { max: 10, timeWindow: "15 minutes" };

export async function identityRoutes(app: FastifyInstance) {
    const typedApp = app.withTypeProvider<ZodTypeProvider>();

    typedApp.route({
        method: "POST",
        url: "/auth/register",
        config: { rateLimit: AUTH_RATE_LIMIT },
        schema: { body: credentialsSchema, response: { 201: userResponseSchema } },
        handler: async (request, reply) => {
            const { email, password } = request.body;
            const tokens = await register(email, password);
            setAuthCookies(reply, tokens);
            const user = await db.query.users.findFirst({ where: eq(users.email, email) });
            reply.status(201);
            return { user: { id: user!.id, email: user!.email } };
        },
    });

    typedApp.route({
        method: "POST",
        url: "/auth/login",
        config: { rateLimit: AUTH_RATE_LIMIT },
        schema: { body: credentialsSchema, response: { 200: userResponseSchema } },
        handler: async (request, reply) => {
            const { email, password } = request.body;
            const tokens = await login(email, password);
            setAuthCookies(reply, tokens);
            const user = await db.query.users.findFirst({ where: eq(users.email, email) });
            return { user: { id: user!.id, email: user!.email } };
        },
    });

    typedApp.route({
        method: "POST",
        url: "/auth/refresh",
        config: { rateLimit: AUTH_RATE_LIMIT },
        preValidation: [requireCsrf],
        schema: { response: { 200: z.object({ ok: z.literal(true) }) } },
        handler: async (request, reply) => {
            const rawToken = request.cookies.refresh_token;
            if (!rawToken) throw Errors.unauthorized();

            const result = await refresh(rawToken);
            if (result === "invalid" || result === "theft") {
                clearAuthCookies(reply);
                throw Errors.unauthorized();
            }

            setAuthCookies(reply, result);
            return { ok: true as const };
        },
    });

    typedApp.route({
        method: "POST",
        url: "/auth/logout",
        preValidation: [requireCsrf],
        schema: { response: { 200: z.object({ ok: z.literal(true) }) } },
        handler: async (request, reply) => {
            const rawToken = request.cookies.refresh_token;
            if (rawToken) await logout(rawToken);
            clearAuthCookies(reply);
            return { ok: true as const };
        },
    });

    typedApp.route({
        method: "GET",
        url: "/auth/me",
        preValidation: [authenticate],
        schema: { response: { 200: userResponseSchema } },
        handler: async (request) => {
            const user = await db.query.users.findFirst({ where: eq(users.id, request.user!.id) });
            if (!user) throw Errors.unauthorized();
            return { user: { id: user.id, email: user.email } };
        },
    });
}
