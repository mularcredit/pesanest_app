import type { NextAuthConfig } from "next-auth"

// Edge-safe config — no Node.js-only imports.
// Used by middleware; full auth.ts extends this.
export const authConfig: NextAuthConfig = {
    trustHost: true,
    pages: {
        signIn: '/login',
    },
    providers: [],
    callbacks: {
        authorized({ auth, request: { nextUrl } }) {
            const isLoggedIn = !!auth?.user;
            const isOnDashboard = nextUrl.pathname.startsWith('/dashboard');
            if (isOnDashboard) {
                if (isLoggedIn) return true;
                return false;
            }
            return true;
        },
    },
}
