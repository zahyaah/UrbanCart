import { z } from "zod";
import fixtureData from "./fixtures/products.json" with { type: "json" };

// The fixture is a one-time export of fakestoreapi.com's catalog (fetched
// 2026-09-11), used to seed our own database so the app never calls that
// API again. It's still third-party-sourced data, so it's validated here
// like any other untrusted input before it's allowed anywhere near a query.
const fixtureProductSchema = z.object({
    title: z.string().min(1),
    description: z.string().min(1),
    price: z.number().positive(),
    category: z.string().min(1),
    image: z.url(),
    rating: z.object({
        rate: z.number().min(0).max(5),
        count: z.number().int().nonnegative(),
    }),
});

export interface SeedProduct {
    title: string;
    description: string;
    priceCents: number;
    category: string;
    image: string;
    ratingRate: number;
    ratingCount: number;
}

export function loadSeedProducts(): SeedProduct[] {
    const parsed = z.array(fixtureProductSchema).parse(fixtureData);

    return parsed.map((p) => ({
        title: p.title,
        description: p.description,
        priceCents: Math.round(p.price * 100),
        category: p.category,
        image: p.image,
        ratingRate: Math.round(p.rating.rate * 10),
        ratingCount: p.rating.count,
    }));
}
