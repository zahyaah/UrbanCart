import type { FastifyInstance } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import { listProducts, getProductById } from "./service.js";
import { productListResponseSchema, productResponseSchema, productIdParamsSchema } from "./schemas.js";
import { Errors } from "../../lib/errors.js";

export async function catalogRoutes(app: FastifyInstance) {
    const typedApp = app.withTypeProvider<ZodTypeProvider>();

    typedApp.route({
        method: "GET",
        url: "/products",
        schema: { response: { 200: productListResponseSchema } },
        handler: async () => {
            return { products: await listProducts() };
        },
    });

    typedApp.route({
        method: "GET",
        url: "/products/:id",
        schema: { params: productIdParamsSchema, response: { 200: productResponseSchema } },
        handler: async (request) => {
            const product = await getProductById(request.params.id);
            if (!product) throw Errors.notFound("Product not found");
            return product;
        },
    });
}
