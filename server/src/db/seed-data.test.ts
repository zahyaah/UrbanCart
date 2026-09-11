import { describe, it, expect } from "vitest";
import { loadSeedProducts } from "./seed-data.js";

describe("loadSeedProducts", () => {
    it("loads the fixture and converts price/rating to storage units", () => {
        const products = loadSeedProducts();

        expect(products.length).toBeGreaterThan(0);
        const backpack = products.find((p) => p.title.includes("Fjallraven"));
        expect(backpack).toBeDefined();
        expect(backpack?.priceCents).toBe(10995); // $109.95
        expect(Number.isInteger(backpack!.priceCents)).toBe(true);
        expect(Number.isInteger(backpack!.ratingRate)).toBe(true);
    });

    it("every loaded product has all required fields non-empty", () => {
        const products = loadSeedProducts();

        for (const p of products) {
            expect(p.title.length).toBeGreaterThan(0);
            expect(p.image.length).toBeGreaterThan(0);
            expect(p.priceCents).toBeGreaterThan(0);
        }
    });
});
