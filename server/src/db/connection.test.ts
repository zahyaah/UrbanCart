import { describe, it, expect } from "vitest";
import { parse } from "pg-connection-string";
import { withVerifiedTls } from "./connection.js";

const NEON =
    "postgresql://neondb_owner:p%40ss@ep-cool-name-a1b2c3-pooler.us-west-2.aws.neon.tech/neondb?sslmode=require&channel_binding=require";

describe("withVerifiedTls", () => {
    it("pins sslmode=require (Neon's default) to verify-full, keeping every other part", () => {
        const url = new URL(withVerifiedTls(NEON));

        expect(url.searchParams.get("sslmode")).toBe("verify-full");
        expect(url.searchParams.get("channel_binding")).toBe("require");
        expect(url.hostname).toBe("ep-cool-name-a1b2c3-pooler.us-west-2.aws.neon.tech");
        expect(url.username).toBe("neondb_owner");
        expect(decodeURIComponent(url.password)).toBe("p@ss");
        expect(url.pathname).toBe("/neondb");
    });

    it.each(["prefer", "verify-ca"])("pins sslmode=%s to verify-full", (mode) => {
        expect(new URL(withVerifiedTls(`postgres://u:p@h/db?sslmode=${mode}`)).searchParams.get("sslmode")).toBe(
            "verify-full"
        );
    });

    it("never turns certificate verification off", () => {
        const ssl = parse(withVerifiedTls(NEON)).ssl;

        expect(ssl).toBeTruthy();
        expect(typeof ssl === "object" ? ssl.rejectUnauthorized : undefined).not.toBe(false);
    });

    it.each([
        "postgres://u:p@localhost:5433/db", // local, no sslmode
        "postgres://u:p@localhost:5433/db?sslmode=disable",
        "postgres://u:p@h/db?sslmode=verify-full",
        "postgres://u:p@h/db?sslmode=require&uselibpqcompat=true", // operator opted into libpq semantics
    ])("leaves %s unchanged", (url) => {
        expect(withVerifiedTls(url)).toBe(url);
    });
});
