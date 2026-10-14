// Shared by the catalog cache (service.ts) and the seed script, which
// deletes every key under this prefix after reloading products. Kept free
// of imports so the seed script can use it without loading app config.
export const CATALOG_CACHE_PREFIX = "catalog:";
export const catalogListKey = `${CATALOG_CACHE_PREFIX}products`;
export const catalogProductKey = (id: string) => `${CATALOG_CACHE_PREFIX}product:${id}`;
