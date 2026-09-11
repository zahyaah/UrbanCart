import { defineConfig } from "drizzle-kit";

// https://orm.drizzle.team/docs/drizzle-config-file
export default defineConfig({
    dialect: "postgresql",
    schema: "./src/db/schema.ts",
    out: "./drizzle",
    dbCredentials: {
        url: process.env.DATABASE_URL ?? "postgres://urbancart:urbancart_dev_only@localhost:5433/urbancart",
    },
});
