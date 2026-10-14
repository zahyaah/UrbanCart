// Neon (and most hosted Postgres) hand out URLs with ?sslmode=require. In
// pg 8.x that already means full certificate + hostname verification, but
// only as a deprecated alias: pg 9 / pg-connection-string 3 switch
// `require` to libpq semantics (encrypt, but verify nothing). Pinning the
// strict mode here keeps verification on across that upgrade instead of
// silently dropping it. `disable`/`allow` (local Postgres) pass through.
const UPGRADE_TO_VERIFY_FULL = new Set(["prefer", "require", "verify-ca"]);

export function withVerifiedTls(connectionString: string): string {
    let url: URL;
    try {
        url = new URL(connectionString);
    } catch {
        return connectionString; // let pg report the malformed string itself
    }
    const mode = url.searchParams.get("sslmode");
    if (!mode || !UPGRADE_TO_VERIFY_FULL.has(mode) || url.searchParams.has("uselibpqcompat")) {
        return connectionString;
    }
    url.searchParams.set("sslmode", "verify-full");
    return url.toString();
}
