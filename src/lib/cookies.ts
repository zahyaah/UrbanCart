/** Reads a single cookie by name from document.cookie. Used to read the
 * csrf_token cookie, which is deliberately NOT httpOnly -- its whole role is
 * being readable by same-origin JS so it can be echoed back as a header
 * (the double-submit CSRF pattern the backend expects; see the server's
 * SPEC-identity.md). */
export function getCookie(name: string): string | null {
    const match = document.cookie.match(new RegExp(`(?:^|; )${name}=([^;]*)`));
    return match ? decodeURIComponent(match[1]) : null;
}
