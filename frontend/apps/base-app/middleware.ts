import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// Routes that don't require authentication
const publicRoutes = ["/login", "/register", "/forgot-password", "/reset-password", "/"];
const apiAuthRoutes = [
  "/api/auth/",
  "/api/v1/auth/login",
  "/api/v1/auth/register",
  "/api/v1/auth/refresh",
  "/api/v1/auth/logout",
];

export function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname;

  // Skip middleware for public routes and API auth endpoints
  if (
    publicRoutes.includes(pathname) ||
    apiAuthRoutes.some((route) => pathname.startsWith(route))
  ) {
    return NextResponse.next();
  }

  // Skip authentication in mock mode (MSW can't set real cookies)
  if (process.env.NODE_ENV === "development" && process.env.NEXT_PUBLIC_MOCK_API === "true") {
    return NextResponse.next();
  }

  // Skip middleware for E2E tests
  // Use regular E2E_TEST env var (not NEXT_PUBLIC_) since middleware runs server-side
  if (
    process.env.NODE_ENV === "test" ||
    process.env.E2E_TEST === "true" ||
    request.headers.get("x-e2e-test") === "true"
  ) {
    return NextResponse.next();
  }

  // Skip middleware for static files, health checks, and API routes
  if (
    pathname.startsWith("/_next") ||
    pathname.startsWith("/static") ||
    pathname.includes(".") ||
    pathname.startsWith("/api/health") ||
    pathname === "/health" ||
    pathname === "/ready"
  ) {
    return NextResponse.next();
  }

  // Check for auth token in cookies
  const token = request.cookies.get("access_token");
  const refreshToken = request.cookies.get("refresh_token");

  // Debug logging for protected routes
  if (pathname.startsWith("/dashboard")) {
    console.log("[Middleware] Dashboard access attempt:", {
      pathname,
      hasToken: !!token,
      hasRefreshToken: !!refreshToken,
      allCookies: Array.from(request.cookies.getAll().map((c) => c.name)),
    });
  }

  // Handle API routes - but skip auth-related endpoints
  // Auth endpoints need cookies to be forwarded as-is to backend
  if (pathname.startsWith("/api/") && !pathname.startsWith("/api/v1/auth/")) {
    if (!token) {
      return NextResponse.json(
        { error: "Unauthorized", message: "No valid authentication token" },
        { status: 401 },
      );
    }

    // Add token to headers for API routes
    const requestHeaders = new Headers(request.headers);
    requestHeaders.set("Authorization", `Bearer ${token.value}`);

    return NextResponse.next({
      request: {
        headers: requestHeaders,
      },
    });
  }

  // Handle protected routes
  if (!token && !refreshToken) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("from", pathname);
    return NextResponse.redirect(url);
  }

  // Token exists but might be expired - let client handle refresh
  if (!token && refreshToken) {
    // Set flag for client to attempt refresh
    const response = NextResponse.next();
    response.headers.set("X-Token-Refresh-Required", "true");
    return response;
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
     * - public folder
     */
    "/((?!_next/static|_next/image|favicon.ico|public).*)",
  ],
};
