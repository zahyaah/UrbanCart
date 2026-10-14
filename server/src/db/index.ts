import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "./schema.js";
import { withVerifiedTls } from "./connection.js";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
    throw new Error("DATABASE_URL is not set");
}

export const pool = new Pool({ connectionString: withVerifiedTls(connectionString) });

export const db = drizzle({ client: pool, schema });
