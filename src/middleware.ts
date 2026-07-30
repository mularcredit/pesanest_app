import NextAuth from "next-auth"
import { authConfig } from "@/auth.config"

const { auth } = NextAuth(authConfig)

export default auth((req) => {
    const host = req.headers.get("host")
    if (host && host.includes("prudenceapp.fly.dev")) {
        const newUrl = req.nextUrl.clone()
        newUrl.hostname = "capitalpaybooks.pro"
        newUrl.protocol = "https:"
        newUrl.port = ""
        return Response.redirect(newUrl.toString())
    }

    const isLoggedIn = !!req.auth
    const isOnDashboard = req.nextUrl.pathname.startsWith("/dashboard")

    if (isOnDashboard) {
        if (isLoggedIn) return
        return Response.redirect(new URL("/login", req.nextUrl))
    }
})

export const config = {
    matcher: ["/((?!api|_next/static|_next/image|favicon.ico).*)"],
}
