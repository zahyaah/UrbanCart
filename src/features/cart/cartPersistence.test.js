import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";

// loadState() runs once at module-init time, so each case has to seed
// localStorage and then re-import the slice with a fresh module registry.
const importSliceWith = async (rawValue) => {
    vi.resetModules();
    if (rawValue === undefined) {
        localStorage.removeItem("urbancart-cart");
    } else {
        localStorage.setItem("urbancart-cart", rawValue);
    }
    const module = await import("./cartSlice");
    // The initial state is what the reducer returns for an unknown action.
    return module.default(undefined, { type: "@@INIT/probe" });
};

const validItem = {
    id: 1,
    title: "Backpack",
    price: 109.95,
    image: "backpack.jpg",
    quantity: 2,
};

beforeEach(() => {
    localStorage.clear();
});

afterEach(() => {
    vi.restoreAllMocks();
});

describe("cart hydration from localStorage", () => {
    it("starts empty when nothing has been persisted", async () => {
        expect(await importSliceWith(undefined)).toEqual([]);
    });

    it("restores a well-formed persisted cart", async () => {
        expect(await importSliceWith(JSON.stringify([validItem]))).toEqual([validItem]);
    });

    it("recovers from unparsable JSON instead of crashing the app", async () => {
        vi.spyOn(console, "error").mockImplementation(() => {});

        expect(await importSliceWith("{not json")).toEqual([]);
    });

    it("ignores a persisted value that is not an array", async () => {
        expect(await importSliceWith(JSON.stringify({ id: 1 }))).toEqual([]);
    });

    it.each([
        ["a missing title", { ...validItem, title: undefined }],
        ["a non-numeric price", { ...validItem, price: "109.95" }],
        ["a fractional quantity", { ...validItem, quantity: 1.5 }],
        ["a zero quantity", { ...validItem, quantity: 0 }],
        ["a negative quantity", { ...validItem, quantity: -3 }],
        ["a null entry", null],
    ])("drops a persisted entry with %s", async (_label, badItem) => {
        // A malformed entry must never reach the UI: price/quantity feed the
        // money math, and undefined there renders NaN totals.
        expect(await importSliceWith(JSON.stringify([badItem]))).toEqual([]);
    });

    it("keeps the good entries when only some are malformed", async () => {
        const stored = JSON.stringify([validItem, { ...validItem, id: 2, price: null }]);

        expect(await importSliceWith(stored)).toEqual([validItem]);
    });

    it("accepts a string id, as some catalog APIs return", async () => {
        const stringId = { ...validItem, id: "abc-123" };

        expect(await importSliceWith(JSON.stringify([stringId]))).toEqual([stringId]);
    });
});
