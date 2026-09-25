/**
 * NextAuth calls `new URL(...)` on NEXTAUTH_URL internally — a bare domain
 * like "pesanestapp.com" (missing the "https://" scheme) throws
 * ERR_INVALID_URL from deep inside NextAuth on every request that touches
 * auth(), which is effectively the whole app. That's an easy deployment
 * mistake (setting the env var to just the domain), so normalize it
 * defensively before NextAuth ever reads it, rather than let a missing
 * prefix take down every route.
 *
 * Pure string/regex — no Node-only APIs — so it's safe to call from both
 * src/auth.ts (Node runtime) and src/middleware.ts (Edge runtime, its own
 * separate NextAuth instance via auth.config.ts).
 */
export function normalizeAuthUrlEnv() {
    if (process.env.NEXTAUTH_URL && !/^https?:\/\//i.test(process.env.NEXTAUTH_URL)) {
        process.env.NEXTAUTH_URL = `https://${process.env.NEXTAUTH_URL}`;
    }
}
