import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { Pool } from "pg";
import { withVerifiedTls } from "./connection.js";

// Migrations run over a DIRECT connection when one is configured. Neon's
// pooled URL (the "-pooler" host, used as DATABASE_URL for app traffic)
// goes through PgBouncer in transaction mode, which doesn't keep session
// state; DDL over it can fail in ways that never mention pooling. Neon
// names the direct URL DATABASE_URL_UNPOOLED. Local and CI databases have
// no pooler, so DATABASE_URL alone is fine there.
const connectionString = process.env.DATABASE_URL_UNPOOLED || process.env.DATABASE_URL;

async function main() {
    if (!connectionString) throw new Error("DATABASE_URL (or DATABASE_URL_UNPOOLED) is not set");
    const pool = new Pool({ connectionString: withVerifiedTls(connectionString) });
    try {
        console.log("Running migrations...");
        await migrate(drizzle({ client: pool }), { migrationsFolder: "./drizzle" });
        console.log("Migrations complete.");
    } finally {
        await pool.end();
    }
}

main().catch((err) => {
    console.error("Migration failed:", err);
    process.exit(1);
});
