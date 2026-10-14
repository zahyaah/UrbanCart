import { describe, it, expect } from "vitest";
import { assertSafeSeedTarget } from "./seed-guard.js";

const LOCAL_URL = "postgres://urbancart:pw@localhost:5433/urbancart";

describe("assertSafeSeedTarget", () => {
    it.each([
        "postgres://u:p@localhost:5433/db",
        "postgres://u:p@127.0.0.1/db",
        "postgres://u:p@[::1]:5432/db",
        "postgres://u:p@postgres:5432/db", // docker-compose service name
    ])("allows a local database: %s", (url) => {
        expect(() => assertSafeSeedTarget({ NODE_ENV: "development", DATABASE_URL: url })).not.toThrow();
    });

    it("refuses NODE_ENV=production even against a local database", () => {
        expect(() => assertSafeSeedTarget({ NODE_ENV: "production", DATABASE_URL: LOCAL_URL })).toThrow(
            /NODE_ENV=production/
        );
    });

    it.each([
        "postgres://u:p@dpg-abc123-a.oregon-postgres.render.com/db",
        "postgres://u:p@10.0.0.5:5432/db",
        "postgres://u:p@localhost.attacker.example/db",
    ])("refuses a non-local host: %s", (url) => {
        expect(() => assertSafeSeedTarget({ NODE_ENV: "development", DATABASE_URL: url })).toThrow(/is not local/);
    });

    it("refuses a missing or malformed DATABASE_URL", () => {
        expect(() => assertSafeSeedTarget({ NODE_ENV: "development" })).toThrow(/not a valid URL/);
        expect(() => assertSafeSeedTarget({ DATABASE_URL: "not a url" })).toThrow(/not a valid URL/);
    });
});
