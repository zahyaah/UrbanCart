// The seed script wipes and reloads the products table. By default it only
// touches a disposable local database: never production, never anything
// reached over the network. "postgres" is the database's service name in
// docker-compose.yml.
//
// One deliberate exception: a remote database can be seeded when
// ALLOW_REMOTE_SEED names that exact database (e.g. ALLOW_REMOTE_SEED=neondb
// for Neon's default). Naming the database, rather than flipping a boolean,
// means a stale shell variable or copy-pasted command can't wipe whatever
// remote DATABASE_URL happens to be set. NODE_ENV=production is still
// refused either way: run the one-time seed from a workstation, not from
// inside the deployed service.
const LOCAL_DATABASE_HOSTS = new Set(["localhost", "127.0.0.1", "::1", "[::1]", "postgres"]);

export function isLocalHost(host: string): boolean {
    return LOCAL_DATABASE_HOSTS.has(host);
}

export function assertSafeSeedTarget(env: {
    NODE_ENV?: string;
    DATABASE_URL?: string;
    ALLOW_REMOTE_SEED?: string;
}): void {
    if (env.NODE_ENV === "production") {
        throw new Error("Refusing to seed with NODE_ENV=production: the seed script wipes the product catalog.");
    }

    let url: URL;
    try {
        url = new URL(env.DATABASE_URL ?? "");
    } catch {
        throw new Error("Refusing to seed: DATABASE_URL is missing or not a valid URL.");
    }

    if (isLocalHost(url.hostname)) return;

    const dbName = decodeURIComponent(url.pathname.slice(1));
    if (dbName && env.ALLOW_REMOTE_SEED === dbName) return;

    throw new Error(
        `Refusing to seed: database host "${url.hostname}" is not local ` +
            `(allowed: ${[...LOCAL_DATABASE_HOSTS].join(", ")}). The seed script wipes the product catalog. ` +
            `To seed this remote database deliberately, set ALLOW_REMOTE_SEED=${dbName || "<database name>"}.`
    );
}
