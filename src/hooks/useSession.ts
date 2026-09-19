import { useGetMeQuery, type User } from "../features/auth/authApi";

/** The one place that turns the getMe query into "is anyone logged in right
 * now". RTK Query keeps the last *successful* `data` around even after a
 * later refetch errors -- logging out invalidates the "Session" tag and
 * re-triggers getMe, which correctly 401s, but `data` doesn't clear to
 * undefined on its own. Reading `data` directly reports a just-logged-out
 * visitor as still logged in for every consumer, for as long as the stale
 * value sits in cache. Every one of getMe's several call sites
 * (AuthMenu, useCart, Checkout) needs this -- routing them all through one
 * hook means the fix can't drift out of sync at a site added later. */
export function useSession(): { user: User | undefined; isLoading: boolean } {
    const { data, isLoading, isError } = useGetMeQuery();
    return { user: isError ? undefined : data, isLoading };
}
