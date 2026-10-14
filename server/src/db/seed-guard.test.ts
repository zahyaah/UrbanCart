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

    describe("ALLOW_REMOTE_SEED", () => {
        const NEON = "postgresql://neondb_owner:pw@ep-cool-name-a1b2c3.us-west-2.aws.neon.tech/neondb?sslmode=require";

        it("allows a remote database when it names that exact database", () => {
            expect(() => assertSafeSeedTarget({ DATABASE_URL: NEON, ALLOW_REMOTE_SEED: "neondb" })).not.toThrow();
        });

        it.each([
            ["is unset", undefined],
            ["is empty", ""],
            ["is a boolean-style value", "true"],
            ["names a different database", "otherdb"],
            ["differs only in case", "NeonDB"],
        ])("refuses when it %s", (_label, value) => {
            expect(() => assertSafeSeedTarget({ DATABASE_URL: NEON, ALLOW_REMOTE_SEED: value })).toThrow(
                /is not local.*ALLOW_REMOTE_SEED=neondb/
            );
        });

        it("refuses a remote URL with no database name, even with an override set", () => {
            expect(() =>
                assertSafeSeedTarget({ DATABASE_URL: "postgres://u:p@db.example.com", ALLOW_REMOTE_SEED: "" })
            ).toThrow(/is not local/);
        });

        it("still refuses NODE_ENV=production with a matching override", () => {
            expect(() =>
                assertSafeSeedTarget({ NODE_ENV: "production", DATABASE_URL: NEON, ALLOW_REMOTE_SEED: "neondb" })
            ).toThrow(/NODE_ENV=production/);
        });
    });

    it("refuses a missing or malformed DATABASE_URL", () => {
        expect(() => assertSafeSeedTarget({ NODE_ENV: "development" })).toThrow(/not a valid URL/);
        expect(() => assertSafeSeedTarget({ DATABASE_URL: "not a url" })).toThrow(/not a valid URL/);
    });
});
