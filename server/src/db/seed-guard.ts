// The seed script wipes and reloads the products table. It must only ever
// touch a disposable local database: never production, never anything
// reached over the network. "postgres" is the database's service name in
// docker-compose.yml.
const LOCAL_DATABASE_HOSTS = new Set(["localhost", "127.0.0.1", "::1", "[::1]", "postgres"]);

export function isLocalHost(host: string): boolean {
    return LOCAL_DATABASE_HOSTS.has(host);
}

export function assertSafeSeedTarget(env: { NODE_ENV?: string; DATABASE_URL?: string }): void {
    if (env.NODE_ENV === "production") {
        throw new Error("Refusing to seed with NODE_ENV=production: the seed script wipes the product catalog.");
    }

    let host: string;
    try {
        host = new URL(env.DATABASE_URL ?? "").hostname;
    } catch {
        throw new Error("Refusing to seed: DATABASE_URL is missing or not a valid URL.");
    }

    if (!isLocalHost(host)) {
        throw new Error(
            `Refusing to seed: database host "${host}" is not local ` +
                `(allowed: ${[...LOCAL_DATABASE_HOSTS].join(", ")}). The seed script wipes the product catalog.`
        );
    }
}
