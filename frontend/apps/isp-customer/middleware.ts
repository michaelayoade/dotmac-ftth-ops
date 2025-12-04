import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

/**
 * Customer Portal Authentication Middleware
 *
 * Protects portal routes and redirects unauthenticated users to login.
 * Note: This is edge-based middleware - actual token validation happens client-side.
 */

const PUBLIC_PATHS = [
  "/login",
  "/forgot-password",
  "/reset-password",
  "/register",
  "/terms",
  "/privacy",
];

const STATIC_PATHS = [
  "/_next",
  "/api",
  "/favicon.ico",
  "/logo.svg",
  "/images",
  "/fonts",
];

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Allow static assets and API routes
  if (STATIC_PATHS.some((path) => pathname.startsWith(path))) {
    return NextResponse.next();
  }

  // Allow public paths
  if (PUBLIC_PATHS.some((path) => pathname === path || pathname.startsWith(path))) {
    return NextResponse.next();
  }

  // Check for customer token cookie
  // Note: This is a soft check - real auth validation happens in CustomerAuthContext
  const token = request.cookies.get("customer_access_token");

  // If no token and trying to access protected routes, redirect to login
  if (!token && pathname.startsWith("/portal")) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("redirect", pathname);
    return NextResponse.redirect(loginUrl);
  }

  // Root path redirects to portal if authenticated, login if not
  if (pathname === "/") {
    if (token) {
      return NextResponse.redirect(new URL("/portal", request.url));
    } else {
      return NextResponse.redirect(new URL("/login", request.url));
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public folder files
     */
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
